"use strict";
const fs = require("node:fs");
const SECTOR = 2048;
// This is bounded structural inspection, never firmware or boot acceptance.
function inspectIso(file, size) {
  const fd = fs.openSync(file, "r");
  function read(offset, bytes) {
    if (!Number.isSafeInteger(offset) || offset < 0 || offset + bytes > size) return null;
    const buffer = Buffer.alloc(bytes);
    return fs.readSync(fd, buffer, 0, bytes, offset) === bytes ? buffer : null;
  }
  try {
    let primary = null, catalogLba = null;
    for (let sector = 16; sector < 80; sector++) {
      const descriptor = read(sector * SECTOR, SECTOR);
      if (!descriptor || descriptor.toString("ascii", 1, 6) !== "CD001" || descriptor[6] !== 1) break;
      if (descriptor[0] === 1) primary = descriptor;
      if (descriptor[0] === 0 && descriptor.toString("ascii", 7, 30).replace(/\0.*$/, "").trim() === "EL TORITO SPECIFICATION") catalogLba = descriptor.readUInt32LE(71);
      if (descriptor[0] === 255) break;
    }
    if (!primary) return null;
    const volumeSectors = primary.readUInt32LE(80), logicalBlockBytes = primary.readUInt16LE(128);
    const descriptorValid = volumeSectors > 0 && primary.readUInt32BE(84) === volumeSectors && logicalBlockBytes === SECTOR && primary.readUInt16BE(130) === logicalBlockBytes;
    const declaredBytes = volumeSectors * logicalBlockBytes;
    const catalog = catalogLba === null ? null : read(catalogLba * SECTOR, 64);
    let checksum = 0;
    if (catalog) for (let i = 0; i < 32; i += 2) checksum = (checksum + catalog.readUInt16LE(i)) & 0xffff;
    const validationChecksumValid = !!catalog && catalog[0] === 1 && catalog[30] === 0x55 && catalog[31] === 0xaa && checksum === 0;
    const bootImageLba = catalog ? catalog.readUInt32LE(40) : null;
    const bootEntryValid = validationChecksumValid && catalog[32] === 0x88 && bootImageLba > 0 && bootImageLba * SECTOR < size;
    return { descriptorValid, volumeSectors, logicalBlockBytes, declaredBytes, withinImage: descriptorValid && declaredBytes <= size,
      elTorito: { present: catalogLba !== null, catalogLba, validationChecksumValid, bootEntryValid, platformId: catalog?.[1] ?? null, bootImageLba }, bootVerified: false };
  } finally { fs.closeSync(fd); }
}
module.exports = { inspectIso };
