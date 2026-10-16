#pragma once
#include <windows.h>
#include <algorithm>
#include <map>
#include <string>
#include <vector>
#include <stdexcept>

// Structural admission for broker-generated DOCX/EPUB ZIPs. Does not extract data
// or claim to inflate/check every compressed member. The document reader follows.
namespace zip_directory {
inline void check(bool condition) { if (!condition) throw std::runtime_error("DOCUMENT_PACKAGE_UNAVAILABLE"); }
inline unsigned u16(const BYTE* p) { return unsigned(p[0]) | (unsigned(p[1]) << 8); }
inline DWORD u32(const BYTE* p) { return DWORD(p[0]) | (DWORD(p[1]) << 8) | (DWORD(p[2]) << 16) | (DWORD(p[3]) << 24); }
inline std::vector<BYTE> read(HANDLE file, ULONGLONG offset, DWORD count) {
  LARGE_INTEGER position{}; position.QuadPart = static_cast<LONGLONG>(offset);
  check(SetFilePointerEx(file, position, nullptr, FILE_BEGIN) != 0);
  std::vector<BYTE> bytes(count); DWORD actual = 0;
  check(ReadFile(file, bytes.data(), count, &actual, nullptr) && actual == count); return bytes;
}
inline std::string member(const std::vector<BYTE>& bytes) {
  check(!bytes.empty() && bytes.size() <= 512); std::string result;
  for (BYTE c : bytes) { check(c >= 32 && c < 127 && c != '\\' && c != ':' && c != '<' && c != '>' && c != '"' && c != '|' && c != '?' && c != '*'); result += static_cast<char>(c); }
  check(result.front() != '/'); size_t start = 0; unsigned depth = 0;
  while (start < result.size()) {
    const size_t slash = result.find('/', start), end = slash == std::string::npos ? result.size() : slash;
    const std::string part = result.substr(start, end - start);
    check(!part.empty() && part != "." && part != ".." && part.back() != '.' && part.back() != ' ' && ++depth <= 32);
    std::string base = part.substr(0, part.find('.'));
    while (!base.empty() && (base.back() == ' ' || base.back() == '.')) base.pop_back();
    for (char& c : base) if (c >= 'a' && c <= 'z') c = static_cast<char>(c - 'a' + 'A');
    check(base != "CON" && base != "PRN" && base != "AUX" && base != "NUL" && base != "CONIN$" && base != "CONOUT$" && base != "CLOCK$");
    check(!(base.size() == 4 && (base.substr(0, 3) == "COM" || base.substr(0, 3) == "LPT") && base[3] >= '1' && base[3] <= '9'));
    if (slash == std::string::npos) break; start = slash + 1;
  }
  return result;
}
struct Entry { std::string name; bool directory; DWORD offset, data, size, compressed; unsigned method; ULONGLONG end; };
inline unsigned validate(HANDLE file, const std::wstring& format) {
  LARGE_INTEGER info{}; check(GetFileSizeEx(file, &info) && info.QuadPart >= 22 && info.QuadPart <= 128ll * 1024 * 1024);
  const ULONGLONG length = static_cast<ULONGLONG>(info.QuadPart);
  const auto footer = read(file, length - 22, 22);
  check(u32(footer.data()) == 0x06054b50 && u16(footer.data() + 4) == 0 && u16(footer.data() + 6) == 0 && u16(footer.data() + 20) == 0);
  const unsigned count = u16(footer.data() + 10); check(count > 0 && count <= 4096 && u16(footer.data() + 8) == count);
  const DWORD centralBytes = u32(footer.data() + 12), centralOffset = u32(footer.data() + 16);
  check(ULONGLONG(centralOffset) + centralBytes == length - 22);
  ULONGLONG cursor = centralOffset, total = 0; std::vector<Entry> entries; std::map<std::string, bool> names;
  for (unsigned index = 0; index < count; ++index) {
    check(cursor + 46 <= length - 22); const auto central = read(file, cursor, 46); const BYTE* c = central.data();
    check(u32(c) == 0x02014b50 && u16(c + 6) <= 20 && u16(c + 30) == 0 && u16(c + 32) == 0 && u16(c + 34) == 0);
    const unsigned flags = u16(c + 8), method = u16(c + 10), nameLength = u16(c + 28);
    check((flags & ~0x080eu) == 0 && (method == 0 || method == 8) && nameLength > 0 && nameLength <= 512);
    const DWORD checksum = u32(c + 16), compressed = u32(c + 20), size = u32(c + 24), offset = u32(c + 42);
    check(size <= 128u * 1024 * 1024 && compressed <= 128u * 1024 * 1024 && offset < centralOffset);
    total += size; check(total <= 256ull * 1024 * 1024);
    check(cursor + 46 + nameLength <= length - 22);
    const auto nameBytes = read(file, cursor + 46, nameLength); const std::string name = member(nameBytes);
    const bool directory = name.back() == '/'; std::string key = directory ? name.substr(0, name.size() - 1) : name;
    for (char& value : key) if (value >= 'A' && value <= 'Z') value = static_cast<char>(value - 'A' + 'a');
    check(names.emplace(key, directory).second);
    check(key.find("vbaproject.bin") == std::string::npos && key.find("activex/") == std::string::npos);
    const unsigned mode = (u32(c + 38) >> 16) & 0170000u;
    check(mode == 0 || mode == 0100000u || mode == 0040000u);
    check(mode != 0040000u || directory); check(mode != 0100000u || !directory);
    check(!(u32(c + 38) & 0x10) || directory);
    check(!directory || (size == 0 && compressed == 0));
    check(ULONGLONG(offset) + 30 <= centralOffset); const auto local = read(file, offset, 30); const BYTE* l = local.data();
    check(u32(l) == 0x04034b50 && u16(l + 4) == u16(c + 6) && u16(l + 6) == flags && u16(l + 8) == method && u16(l + 26) == nameLength && u16(l + 28) == 0);
    check(read(file, ULONGLONG(offset) + 30, nameLength) == nameBytes);
    const ULONGLONG data = ULONGLONG(offset) + 30 + nameLength, end = data + compressed;
    check(end <= centralOffset);
    ULONGLONG recordEnd = end;
    if (flags & 8) {
      check((u32(l + 14) == 0 || u32(l + 14) == checksum) && (u32(l + 18) == 0 || u32(l + 18) == compressed) && (u32(l + 22) == 0 || u32(l + 22) == size));
      check(end + 12 <= centralOffset); auto descriptor = read(file, end, 12); const BYTE* d = descriptor.data();
      if (u32(d) == 0x08074b50) { check(end + 16 <= centralOffset); descriptor = read(file, end + 4, 12); d = descriptor.data(); recordEnd += 4; }
      check(u32(d) == checksum && u32(d + 4) == compressed && u32(d + 8) == size); recordEnd += 12;
    } else check(u32(l + 14) == checksum && u32(l + 18) == compressed && u32(l + 22) == size);
    check(method != 0 || size == compressed);
    entries.push_back({ name, directory, offset, static_cast<DWORD>(data), size, compressed, method, recordEnd });
    cursor += 46 + nameLength;
  }
  check(cursor == length - 22);
  std::sort(entries.begin(), entries.end(), [](const Entry& a, const Entry& b) { return a.offset < b.offset; });
  ULONGLONG previous = 0;
  for (const auto& entry : entries) {
    check(entry.offset == previous); previous = entry.end;
    std::string key = entry.name; for (char& value : key) if (value >= 'A' && value <= 'Z') value = static_cast<char>(value - 'A' + 'a');
    for (size_t slash = key.find('/'); slash != std::string::npos; slash = key.find('/', slash + 1)) {
      auto found = names.find(key.substr(0, slash)); check(found == names.end() || found->second);
    }
  }
  check(previous == centralOffset);
  if (format == L"docx") {
    check(names.count("[content_types].xml") && names.count("_rels/.rels") && names.count("word/document.xml"));
  } else {
    check(format == L"epub" && names.count("mimetype") && names.count("meta-inf/container.xml"));
    bool package = false;
    for (const auto& entry : entries) {
      if (entry.name.size() >= 4 && entry.name.substr(entry.name.size() - 4) == ".opf") package = true;
      if (entry.name == "mimetype") {
        check(entry.offset == 0 && entry.method == 0 && entry.size == 20 && entry.compressed == 20);
        const auto mime = read(file, entry.data, 20); check(std::string(mime.begin(), mime.end()) == "application/epub+zip");
      }
    }
    check(package);
  }
  return count;
}
}
