"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

function fail(code) {
  throw Object.assign(new Error("Selected file is unavailable."), { code });
}
function inspect(absolute) {
  try {
    return require("./file-grants.cjs").inspectCanonicalPath(absolute);
  } catch {
    fail("UNSAFE_PATH");
  }
}

/** Session authority comes only from the native picker, never renderer paths. */
function createToolFiles({ dialog, parentWindow, purpose = "server" }) {
  if (!["server", "external-tree"].includes(purpose))
    throw new TypeError("Unknown directory purpose.");
  const records = new Map();
  let choosing = false,
    closed = false;
  return Object.freeze({
    async choose({ access, kind }) {
      if (closed) fail("UNAVAILABLE");
      if (
        !["read", "write"].includes(access) ||
        !["file", "directory"].includes(kind)
      )
        fail("INVALID_REQUEST");
      if (choosing) fail("PICKER_BUSY");
      if (records.size >= 512) fail("LIMIT_REACHED");
      choosing = true;
      try {
        let selected;
        if (access === "write" && kind === "file") {
          const result = await dialog.showSaveDialog(parentWindow, {
            title: "Choose a new output file",
            properties: ["dontAddToRecent"],
          });
          if (result.canceled || !result.filePath) fail("CANCELLED");
          selected = result.filePath;
          if (fs.existsSync(selected)) fail("OUTPUT_ALREADY_EXISTS");
        } else {
          const result = await dialog.showOpenDialog(parentWindow, {
            title:
              kind === "directory"
                ? purpose === "external-tree"
                  ? "Choose a prepared Buildroot external tree"
                  : "Choose the server working directory"
                : "Choose an input file",
            properties: [
              kind === "directory" ? "openDirectory" : "openFile",
              "dontAddToRecent",
            ],
          });
          if (result.canceled || result.filePaths?.length !== 1)
            fail("CANCELLED");
          selected = result.filePaths[0];
        }
        if (closed) fail("UNAVAILABLE");
        const newOutput = access === "write" && kind === "file";
        if (
          typeof selected !== "string" ||
          path.resolve(selected) !== selected ||
          /[\x00-\x1f]/.test(selected)
        )
          fail("UNSAFE_PATH");
        const chain = inspect(newOutput ? path.dirname(selected) : selected);
        if (
          newOutput &&
          (!path.basename(selected) ||
            /[<>:"|?*]/.test(path.basename(selected)) ||
            /[. ]$/.test(path.basename(selected)) ||
            /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(path.basename(selected)))
        )
          fail("UNSAFE_PATH");
        if (!newOutput) {
          const stat = fs.lstatSync(selected);
          if (kind === "directory" ? !stat.isDirectory() : !stat.isFile())
            fail("UNSAFE_PATH");
        }
        if (kind === "directory" && access === "write") {
          if (selected === path.parse(selected).root) fail("UNSAFE_PATH");
          if (purpose === "server") {
            const review = await dialog.showMessageBox(parentWindow, {
              type: "warning",
              title: "Authorize this server directory",
              message:
                "Allow the server manager to modify and run server files in this directory?",
              detail: `${selected}\n\nServer software and plugins execute code with your account permissions. Choose a directory whose contents you trust. This permission lasts until the application closes.`,
              buttons: ["Cancel", "Authorize directory"],
              defaultId: 0,
              cancelId: 0,
              noLink: true,
            });
            if (review.response !== 1) fail("SOURCE_CONSENT_REQUIRED");
          }
        }
        if (closed) fail("UNAVAILABLE");
        const id = randomUUID();
        records.set(id, { selected, chain, access, kind, newOutput });
        return { id, name: path.basename(selected), kind };
      } finally {
        choosing = false;
      }
    },
    release(ids) {
      if (!Array.isArray(ids) || ids.length > 200 || ids.some(id => typeof id !== "string")) fail("INVALID_REQUEST");
      for (const id of ids) records.delete(id);
      return {released:ids.length};
    },
    async chooseBatch({format}) {
      if (closed) fail("UNAVAILABLE");
      if (!/^(png|jpg|webp|mp3|wav|flac|mp4|webm|pdf|docx|html|epub|zip|json|csv|txt|base64|hex)$/.test(format || "")) fail("INVALID_REQUEST");
      if (choosing) fail("PICKER_BUSY");
      choosing = true;
      const added = [];
      try {
        const picked = await dialog.showOpenDialog(parentWindow, {title:"Choose up to 100 source files for this batch",properties:["openFile","multiSelections","dontAddToRecent"]});
        if (picked.canceled) fail("CANCELLED");
        if (!picked.filePaths?.length || picked.filePaths.length > 100) fail("BATCH_PAGE_LIMIT");
        if (records.size + picked.filePaths.length * 2 > 512) fail("LIVE_GRANT_LIMIT");
        const target = await dialog.showOpenDialog(parentWindow, {title:"Choose the output folder for new converted files",properties:["openDirectory","dontAddToRecent"]});
        if (target.canceled || target.filePaths?.length !== 1) fail("CANCELLED");
        const folder = target.filePaths[0], parentChain = inspect(folder);
        if (!fs.lstatSync(folder).isDirectory()) fail("UNSAFE_PATH");
        const names = new Set(), items = [];
        for (const selected of picked.filePaths) {
          const chain = inspect(selected);
          if (!fs.lstatSync(selected).isFile()) fail("UNSAFE_PATH");
          const name = path.basename(selected) + "." + format;
          if (names.has(name.toLowerCase())) fail("DUPLICATE_OUTPUT_NAME");
          names.add(name.toLowerCase());
          const output = path.join(folder,name);
          if (fs.existsSync(output)) fail("OUTPUT_ALREADY_EXISTS");
          const sourceId=randomUUID(), destinationId=randomUUID();
          records.set(sourceId,{selected,chain,access:"read",kind:"file",newOutput:false});
          records.set(destinationId,{selected:output,chain:parentChain,access:"write",kind:"file",newOutput:true});
          added.push(sourceId,destinationId);
          items.push({source:{id:sourceId,name:path.basename(selected),kind:"file"},destination:{id:destinationId,name,kind:"file"}});
        }
        if (closed) fail("UNAVAILABLE");
        return {items};
      } catch(error) { for (const id of added) records.delete(id); throw error; }
      finally {choosing=false;}
    },
    resolve(id, mode) {
      if (closed) fail("UNAVAILABLE");
      const record = records.get(id);
      if (
        !record ||
        !["read", "write"].includes(mode) ||
        (mode === "write" && record.access !== "write")
      )
        fail("FILE_GRANT_REQUIRED");
      try {
        const current = inspect(
          record.newOutput ? path.dirname(record.selected) : record.selected,
        );
        if (JSON.stringify(current) !== JSON.stringify(record.chain))
          fail("GRANT_CHANGED");
        if (record.newOutput) {
          if (mode !== "write") fail("FILE_GRANT_REQUIRED");
          if (fs.existsSync(record.selected)) fail("OUTPUT_ALREADY_EXISTS");
        }
        return record.selected;
      } catch (error) {
        if (error.message === "Selected file is unavailable.") throw error;
        fail("GRANT_CHANGED");
      }
    },
    serverAuthorized(id) {
      const record = records.get(id);
      if (
        purpose !== "server" ||
        !record ||
        record.kind !== "directory" ||
        record.access !== "write"
      )
        return false;
      this.resolve(id, "write");
      return true;
    },
    dispose() {
      closed = true;
      records.clear();
    },
  });
}
module.exports = { createToolFiles };
