#pragma once
#include <windows.h>
#include <bcrypt.h>
#include <array>
#include <string>
#include <vector>
#include <stdexcept>

// One fixed safe ZIP member, stored without compression. No extraction or paths.
namespace zip_store {
inline void check(bool condition) { if (!condition) throw std::runtime_error("ZIP_OPERATION_UNAVAILABLE"); }
inline void start(HANDLE file) { LARGE_INTEGER zero{}; check(SetFilePointerEx(file, zero, nullptr, FILE_BEGIN) != 0); }
inline void write(HANDLE file, const BYTE* data, DWORD size) { DWORD written = 0; check(WriteFile(file, data, size, &written, nullptr) && written == size); }
inline void read(HANDLE file, BYTE* data, DWORD size) { DWORD actual = 0; check(ReadFile(file, data, size, &actual, nullptr) && actual == size); }
inline void u16(std::vector<BYTE>& bytes, unsigned value) { bytes.push_back(static_cast<BYTE>(value)); bytes.push_back(static_cast<BYTE>(value >> 8)); }
inline void u32(std::vector<BYTE>& bytes, DWORD value) { u16(bytes, value & 65535); u16(bytes, value >> 16); }
inline DWORD number(const BYTE* bytes) { return DWORD(bytes[0]) | (DWORD(bytes[1]) << 8) | (DWORD(bytes[2]) << 16) | (DWORD(bytes[3]) << 24); }
inline DWORD crc(DWORD state, const BYTE* bytes, DWORD count) {
  static const std::array<DWORD, 256> table = [] {
    std::array<DWORD, 256> result{};
    for (DWORD index = 0; index < 256; ++index) { DWORD value = index; for (unsigned bit = 0; bit < 8; ++bit) value = value & 1 ? (value >> 1) ^ 0xedb88320 : value >> 1; result[index] = value; }
    return result;
  }();
  for (DWORD index = 0; index < count; ++index) state = (state >> 8) ^ table[(state ^ bytes[index]) & 255];
  return state;
}
inline std::vector<BYTE> local(DWORD size, DWORD checksum) {
  std::vector<BYTE> result; u32(result, 0x04034b50); u16(result, 20); u16(result, 0x0800); u16(result, 0);
  u16(result, 0); u16(result, 0x21); u32(result, checksum); u32(result, size); u32(result, size); u16(result, 9); u16(result, 0);
  const std::string name = "input.bin"; result.insert(result.end(), name.begin(), name.end()); return result;
}
inline std::vector<BYTE> central(DWORD size, DWORD checksum) {
  std::vector<BYTE> result; u32(result, 0x02014b50); u16(result, 20); u16(result, 20); u16(result, 0x0800); u16(result, 0);
  u16(result, 0); u16(result, 0x21); u32(result, checksum); u32(result, size); u32(result, size); u16(result, 9); u16(result, 0);
  u16(result, 0); u16(result, 0); u16(result, 0); u32(result, 0); u32(result, 0);
  const std::string name = "input.bin"; result.insert(result.end(), name.begin(), name.end());
  u32(result, 0x06054b50); u16(result, 0); u16(result, 0); u16(result, 1); u16(result, 1); u32(result, 55); u32(result, size + 39); u16(result, 0);
  return result;
}
inline void create(HANDLE source, HANDLE output) {
  LARGE_INTEGER length{}; check(GetFileSizeEx(source, &length) && length.QuadPart >= 0 && length.QuadPart <= 64ll * 1024 * 1024);
  const DWORD size = static_cast<DWORD>(length.QuadPart); start(source);
  BYTE buffer[65536]; DWORD checksum = 0xffffffff, remaining = size;
  while (remaining) { DWORD count = remaining < sizeof(buffer) ? remaining : static_cast<DWORD>(sizeof(buffer)); read(source, buffer, count); checksum = crc(checksum, buffer, count); remaining -= count; }
  checksum ^= 0xffffffff; const auto header = local(size, checksum); write(output, header.data(), static_cast<DWORD>(header.size()));
  start(source); remaining = size;
  while (remaining) { DWORD count = remaining < sizeof(buffer) ? remaining : static_cast<DWORD>(sizeof(buffer)); read(source, buffer, count); write(output, buffer, count); remaining -= count; }
  const auto end = central(size, checksum); write(output, end.data(), static_cast<DWORD>(end.size()));
}
inline void validate(HANDLE source, const std::string& expectedHash) {
  check(expectedHash.size() == 64 && expectedHash.find_first_not_of("0123456789abcdef") == std::string::npos);
  LARGE_INTEGER length{}; check(GetFileSizeEx(source, &length) && length.QuadPart >= 116 && length.QuadPart <= 64ll * 1024 * 1024 + 116);
  start(source); BYTE bytes[30]; read(source, bytes, sizeof(bytes));
  const DWORD size = number(bytes + 18), checksum = number(bytes + 14); check(size <= 64u * 1024 * 1024 && length.QuadPart == LONGLONG(size) + 116);
  const auto header = local(size, checksum); std::vector<BYTE> actual(header.size()); start(source); read(source, actual.data(), static_cast<DWORD>(actual.size())); check(actual == header);
  BCRYPT_ALG_HANDLE algorithm = nullptr; BCRYPT_HASH_HANDLE hash = nullptr;
  struct Cleanup { BCRYPT_ALG_HANDLE& a; BCRYPT_HASH_HANDLE& h; ~Cleanup() { if (h) BCryptDestroyHash(h); if (a) BCryptCloseAlgorithmProvider(a, 0); } } cleanup{algorithm, hash};
  check(BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) >= 0);
  check(BCryptCreateHash(algorithm, &hash, nullptr, 0, nullptr, 0, 0) >= 0);
  BYTE buffer[65536]; DWORD remaining = size, actualCrc = 0xffffffff;
  while (remaining) {
    const DWORD count = remaining < sizeof(buffer) ? remaining : static_cast<DWORD>(sizeof(buffer)); read(source, buffer, count);
    actualCrc = crc(actualCrc, buffer, count); check(BCryptHashData(hash, buffer, count, 0) >= 0); remaining -= count;
  }
  check((actualCrc ^ 0xffffffff) == checksum);
  BYTE digest[32]; check(BCryptFinishHash(hash, digest, sizeof(digest), 0) >= 0);
  const char* hex = "0123456789abcdef"; std::string actualHash;
  for (BYTE value : digest) { actualHash += hex[value >> 4]; actualHash += hex[value & 15]; } check(actualHash == expectedHash);
  const auto end = central(size, checksum); actual.resize(end.size()); read(source, actual.data(), static_cast<DWORD>(actual.size())); check(actual == end);
}
}
