"use strict";
const { fail } = require("./runtime.cjs");
function csvRows(input) {
  const rows = []; let row = [], cell = "", quoted = false, closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) { if (c === '"') { if (input[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } } else cell += c; }
    else if (c === '"') { if (cell || closed) fail("INVALID_CSV"); quoted = true; }
    else if (c === ',' || c === '\n' || c === '\r') {
      row.push(cell); cell = ""; closed = false;
      if (c !== ',') { if (c === '\r' && input[i + 1] === '\n') i++; rows.push(row); row = []; }
    } else { if (closed) fail("INVALID_CSV"); cell += c; }
    if (rows.length > 100000 || row.length > 1000 || cell.length > 1048576) fail("STRUCTURED_LIMIT");
  }
  if (quoted) fail("INVALID_CSV");
  if (cell || row.length || closed) { row.push(cell); rows.push(row); }
  if (!rows.length || rows.some(r => r.length !== rows[0].length)) fail("INVALID_CSV");
  return rows;
}
function convertNative(bytes, category, format) {
  if (category === "binary") return bytes.toString(format);
  let input;
  try { input = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { fail("UNSUPPORTED_ENCODING"); }
  if (input.includes('\0')) fail("UNSUPPORTED_SOURCE");
  if (category === "text") return input;
  let value;
  try { value = JSON.parse(input); } catch { value = csvRows(input); }
  if (format === "json") return JSON.stringify(value, null, 2);
  if (!Array.isArray(value) || !value.length || value.length > 100000) fail("TABULAR_DATA_REQUIRED");
  let rows;
  if (value.every(Array.isArray)) rows = value;
  else if (value.every(v => v && typeof v === "object" && !Array.isArray(v))) {
    const columns = [...new Set(value.flatMap(v => Object.keys(v)))];
    if (columns.length > 1000) fail("STRUCTURED_LIMIT");
    rows = [columns, ...value.map(v => columns.map(k => v[k] ?? ""))];
  } else fail("TABULAR_DATA_REQUIRED");
  if (rows.some(r => r.length !== rows[0].length || r.length > 1000)) fail("TABULAR_DATA_REQUIRED");
  return rows.map(row => row.map(v => {
    if (v !== null && typeof v === "object") fail("NESTED_DATA_NOT_SUPPORTED");
    const s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s)) fail("SPREADSHEET_FORMULA_NOT_SUPPORTED");
    return /[",\r\n]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
  }).join(',')).join('\r\n') + '\r\n';
}
module.exports = { csvRows, convertNative };
