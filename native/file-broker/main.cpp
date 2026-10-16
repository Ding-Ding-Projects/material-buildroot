#define WIN32_LEAN_AND_MEAN
#define _WIN32_WINNT 0x0A00
#include <windows.h>
#include <userenv.h>
#include <sddl.h>
#include <aclapi.h>
#include <vector>
#include <string>
#include <stdexcept>
#include <cstdio>
#include <cwctype>
#include <objbase.h>
#include <bcrypt.h>
#include <cstring>
#include <cstddef>
#include <memory>
#include "qpdf-json.hpp"
#include "zip-store.hpp"

// Host-only protocol. No renderer command line is accepted by this executable.
// argv: operation, input, new output, private payload root, executable basename, input identity, output-parent identity.
namespace {
struct Handle {
  HANDLE value = INVALID_HANDLE_VALUE;
  explicit Handle(HANDLE v = INVALID_HANDLE_VALUE) : value(v) {}
  ~Handle() { if (value != INVALID_HANDLE_VALUE && value != nullptr) CloseHandle(value); }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
};
[[noreturn]] void stop() { throw std::runtime_error("BROKER_UNAVAILABLE"); }
void require(bool value) { if (!value) stop(); }
std::wstring full(const std::wstring& value) {
  require(value.size() >= 3 && value.size() <= 4096 && value[1] == L':' && value[2] == L'\\');
  require(value[0] >= L'A' && value[0] <= L'Z');
  require(value.find_first_of(L"\r\n\t") == std::wstring::npos);
  wchar_t buffer[4097];
  DWORD size = GetFullPathNameW(value.c_str(), 4097, buffer, nullptr);
  require(size > 0 && size < 4097 && value == buffer);
  return value;
}
void safeName(const std::wstring& value) {
  require(!value.empty() && value != L"." && value != L"..");
  require(value.find_first_of(L"\\/:<>\"|?*") == std::wstring::npos);
  require(value.back() != L'.' && value.back() != L' ');
  for (wchar_t c : value) require(c >= 32);
  std::wstring base = value.substr(0, value.find(L'.'));
  for (auto& c : base) c = static_cast<wchar_t>(towupper(c));
  require(base != L"CON" && base != L"PRN" && base != L"AUX" && base != L"NUL");
  require(!(base.size() == 4 && (base.substr(0, 3) == L"COM" || base.substr(0, 3) == L"LPT") && base[3] >= L'1' && base[3] <= L'9'));
}
void inspect(HANDLE handle, const std::wstring& expected, bool directory) {
  FILE_ATTRIBUTE_TAG_INFO tag{};
  require(GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &tag, sizeof(tag)) != 0);
  require(!(tag.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT));
  require(bool(tag.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) == directory);
  BY_HANDLE_FILE_INFORMATION info{};
  require(GetFileInformationByHandle(handle, &info) != 0);
  require(directory || info.nNumberOfLinks == 1);
  wchar_t buffer[8192];
  DWORD size = GetFinalPathNameByHandleW(handle, buffer, 8192, FILE_NAME_NORMALIZED | VOLUME_NAME_DOS);
  require(size > 4 && size < 8192 && std::wstring(buffer, size) == L"\\\\?\\" + expected);
}
// Keeping ancestors open without FILE_SHARE_DELETE prevents junction substitution
// or directory renaming between validation and the final handle open.
std::vector<HANDLE> parents(const std::wstring& absolute) {
  full(absolute);
  std::vector<HANDLE> result;
  try {
    size_t end = 2;
    while (end != std::wstring::npos) {
      std::wstring component = absolute.substr(0, end == 2 ? 3 : end);
      HANDLE handle = CreateFileW(component.c_str(), FILE_READ_ATTRIBUTES,
        FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING,
        FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
      require(handle != INVALID_HANDLE_VALUE);
      result.push_back(handle);
      inspect(handle, component, true);
      const size_t next = absolute.find(L'\\', end + 1);
      if (next == std::wstring::npos) break;
      safeName(absolute.substr(end + 1, next - end - 1));
      end = next;
    }
    safeName(absolute.substr(absolute.find_last_of(L'\\') + 1));
    return result;
  } catch (...) { for (auto h : result) CloseHandle(h); throw; }
}
struct ParentLocks {
  std::vector<HANDLE> values;
  explicit ParentLocks(const std::wstring& path) : values(parents(path)) {}
  ~ParentLocks() { for (auto h : values) CloseHandle(h); }
};
std::wstring quote(const std::wstring& value) {
  require(value.find(L'"') == std::wstring::npos && (value.empty() || value.back() != L'\\'));
  return L"\"" + value + L"\"";
}
void acl(const std::wstring& path, PSID sid, bool directory, bool executable = true) {
  LPWSTR sidText = nullptr;
  require(ConvertSidToStringSidW(sid, &sidText) != 0);
  std::wstring descriptor = L"D:P(A;;FA;;;SY)(A;;FA;;;OW)(A;;";
  descriptor += directory || executable ? L"GRGX" : L"GR";
  descriptor += L";;;" + std::wstring(sidText) + L")";
  LocalFree(sidText);
  PSECURITY_DESCRIPTOR security = nullptr;
  require(ConvertStringSecurityDescriptorToSecurityDescriptorW(descriptor.c_str(), SDDL_REVISION_1, &security, nullptr) != 0);
  const BOOL success = SetFileSecurityW(path.c_str(), DACL_SECURITY_INFORMATION | PROTECTED_DACL_SECURITY_INFORMATION, security);
  LocalFree(security);
  require(success != 0);
}
struct Profile {
  std::wstring name;
  PSID sid = nullptr;
  Profile() {
    GUID id{}; require(CoCreateGuid(&id) == S_OK);
    wchar_t text[40]; require(StringFromGUID2(id, text, 40) > 0);
    name = L"MaterialBuildroot." + std::wstring(text + 1, 36);
    require(SUCCEEDED(CreateAppContainerProfile(name.c_str(), L"Material Buildroot decoder", L"Temporary offline decoder", nullptr, 0, &sid)));
  }
  ~Profile() { if (sid) { FreeSid(sid); DeleteAppContainerProfile(name.c_str()); } }
};
void payload(const std::wstring& root, PSID sid, unsigned& count, ULONGLONG& bytes) {
  ParentLocks locked(root + L"\\entry");
  Handle directory(CreateFileW(root.c_str(), FILE_READ_ATTRIBUTES, FILE_SHARE_READ | FILE_SHARE_WRITE,
    nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
  require(directory.value != INVALID_HANDLE_VALUE); inspect(directory.value, root, true);
  acl(root, sid, true);
  WIN32_FIND_DATAW item{};
  HANDLE search = FindFirstFileW((root + L"\\*").c_str(), &item);
  require(search != INVALID_HANDLE_VALUE);
  try {
    do {
      std::wstring name(item.cFileName);
      if (name == L"." || name == L"..") continue;
      safeName(name); require(!(item.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT));
      require(++count <= 4096);
      auto path = root + L"\\" + name;
      if (item.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) payload(path, sid, count, bytes);
      else {
        Handle file(CreateFileW(path.c_str(), FILE_READ_ATTRIBUTES, FILE_SHARE_READ, nullptr,
          OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
        require(file.value != INVALID_HANDLE_VALUE); inspect(file.value, path, false);
        bytes += (ULONGLONG(item.nFileSizeHigh) << 32) | item.nFileSizeLow;
        require(bytes <= 1024ull * 1024 * 1024); acl(path, sid, false);
      }
    } while (FindNextFileW(search, &item));
    require(GetLastError() == ERROR_NO_MORE_FILES);
    FindClose(search);
  } catch (...) { FindClose(search); throw; }
}
std::wstring arguments(const std::wstring& operation) {
  if (operation == L"imagemagick-png") return L" -regard-warnings -limit width 16384 -limit height 16384 -limit list-length 256 -limit memory 128MiB -limit map 0 -limit disk 0 - png:-";
  if (operation == L"imagemagick-jpg") return L" -regard-warnings -limit width 16384 -limit height 16384 -limit list-length 256 -limit memory 128MiB -limit map 0 -limit disk 0 - jpg:-";
  if (operation == L"imagemagick-webp") return L" -regard-warnings -limit width 16384 -limit height 16384 -limit list-length 256 -limit memory 128MiB -limit map 0 -limit disk 0 - webp:-";
  if (operation == L"ffmpeg-wav") return L" -nostdin -hide_banner -loglevel error -xerror -err_detect explode -threads 1 -filter_threads 1 -protocol_whitelist pipe -i pipe:0 -map_metadata -1 -f wav pipe:1";
  if (operation == L"ffmpeg-mp3") return L" -nostdin -hide_banner -loglevel error -xerror -err_detect explode -threads 1 -filter_threads 1 -protocol_whitelist pipe -i pipe:0 -map_metadata -1 -f mp3 pipe:1";
  if (operation == L"ffmpeg-flac") return L" -nostdin -hide_banner -loglevel error -xerror -err_detect explode -threads 1 -filter_threads 1 -protocol_whitelist pipe -i pipe:0 -map_metadata -1 -f flac pipe:1";
  if (operation == L"ffmpeg-mp4") return L" -nostdin -hide_banner -loglevel error -xerror -err_detect explode -threads 1 -filter_threads 1 -protocol_whitelist pipe -i pipe:0 -map 0:v:0 -map 0:a:0? -map_metadata -1 -map_metadata:s -1 -map_chapters -1 -sn -dn -threads 1 -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -movflags +frag_keyframe+empty_moov+default_base_moof -f mp4 pipe:1";
  if (operation == L"ffmpeg-webm") return L" -nostdin -hide_banner -loglevel error -xerror -err_detect explode -threads 1 -filter_threads 1 -protocol_whitelist pipe -i pipe:0 -map 0:v:0 -map 0:a:0? -map_metadata -1 -map_metadata:s -1 -map_chapters -1 -sn -dn -threads 1 -c:v libvpx-vp9 -deadline realtime -cpu-used 8 -row-mt 0 -c:a libopus -f webm pipe:1";
  if (operation == L"qpdf-extract" || operation == L"qpdf-reorder" || operation == L"qpdf-merge" || operation == L"qpdf-rotate" || operation == L"qpdf-metadata") return L"";
  if (operation == L"zipstore-zip") return L" --zip-worker";
  stop();
}
}
namespace {
std::string ascii(const std::wstring& value) {
  std::string result;
  for (wchar_t character : value) { require(character < 128); result += static_cast<char>(character); }
  return result;
}
void rewindFile(HANDLE handle) {
  LARGE_INTEGER zero{}; require(SetFilePointerEx(handle, zero, nullptr, FILE_BEGIN) != 0);
}
std::string sha256(HANDLE handle) {
  BCRYPT_ALG_HANDLE algorithm = nullptr; BCRYPT_HASH_HANDLE hash = nullptr;
  require(BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) >= 0);
  struct Cleanup { BCRYPT_ALG_HANDLE& a; BCRYPT_HASH_HANDLE& h; ~Cleanup() { if (h) BCryptDestroyHash(h); if (a) BCryptCloseAlgorithmProvider(a, 0); } } cleanup{ algorithm, hash };
  require(BCryptCreateHash(algorithm, &hash, nullptr, 0, nullptr, 0, 0) >= 0);
  rewindFile(handle);
  BYTE buffer[65536]; DWORD read = 0;
  while (true) {
    require(ReadFile(handle, buffer, sizeof(buffer), &read, nullptr) != 0);
    if (!read) break;
    require(BCryptHashData(hash, buffer, read, 0) >= 0);
  }
  BYTE digest[32]; require(BCryptFinishHash(hash, digest, sizeof(digest), 0) >= 0);
  const char* hex = "0123456789abcdef";
  std::string result; result.reserve(64);
  for (BYTE value : digest) { result += hex[value >> 4]; result += hex[value & 15]; }
  rewindFile(handle); return result;
}
void signature(HANDLE handle, const std::wstring& operation) {
  rewindFile(handle); BYTE bytes[16]{}; DWORD read = 0;
  require(ReadFile(handle, bytes, sizeof(bytes), &read, nullptr) && read >= 12);
  bool matches = false;
  if (operation == L"imagemagick-png") {
    const BYTE magic[] = {137,80,78,71,13,10,26,10}; matches = std::memcmp(bytes, magic, sizeof(magic)) == 0;
  } else if (operation == L"imagemagick-jpg") matches = bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255;
  else if (operation == L"imagemagick-webp") matches = std::memcmp(bytes, "RIFF", 4) == 0 && std::memcmp(bytes + 8, "WEBP", 4) == 0;
  else if (operation == L"ffmpeg-wav") matches = std::memcmp(bytes, "RIFF", 4) == 0 && std::memcmp(bytes + 8, "WAVE", 4) == 0;
  else if (operation == L"ffmpeg-flac") matches = std::memcmp(bytes, "fLaC", 4) == 0;
  else if (operation == L"ffmpeg-mp3") matches = std::memcmp(bytes, "ID3", 3) == 0 || (bytes[0] == 255 && (bytes[1] & 224) == 224);
  else if (operation == L"ffmpeg-mp4") matches = std::memcmp(bytes + 4, "ftyp", 4) == 0;
  else if (operation == L"ffmpeg-webm") {
    const BYTE magic[] = {0x1a,0x45,0xdf,0xa3}; matches = std::memcmp(bytes, magic, sizeof(magic)) == 0;
  }
  else if (operation.rfind(L"qpdf-", 0) == 0) matches = std::memcmp(bytes, "%PDF-", 5) == 0;
  else if (operation == L"zipstore-zip") { const BYTE magic[] = {0x50,0x4b,0x03,0x04}; matches = std::memcmp(bytes, magic, sizeof(magic)) == 0; }
  require(matches); rewindFile(handle);
}
std::wstring validationArguments(const std::wstring& operation) {
  if (operation.rfind(L"imagemagick-", 0) == 0) {
    const std::wstring format = operation.substr(12);
    require(format == L"png" || format == L"jpg" || format == L"webp");
    return L" -regard-warnings -limit width 16384 -limit height 16384 -limit list-length 256 -limit memory 128MiB -limit map 0 -limit disk 0 " + format + L":- null:";
  }
  require(operation == L"ffmpeg-wav" || operation == L"ffmpeg-mp3" || operation == L"ffmpeg-flac" || operation == L"ffmpeg-mp4" || operation == L"ffmpeg-webm");
  const std::wstring demuxer = operation == L"ffmpeg-mp4" ? L"mov" : operation == L"ffmpeg-webm" ? L"matroska" : operation.substr(7);
  const std::wstring streams = operation == L"ffmpeg-mp4" || operation == L"ffmpeg-webm" ? L" -map 0:v:0 -map 0:a:0? -sn -dn" : L" -map 0:a:0 -vn -sn -dn";
  return L" -nostdin -hide_banner -loglevel error -xerror -err_detect explode -threads 1 -filter_threads 1 -protocol_whitelist pipe -f " + demuxer + L" -i pipe:0" + streams + L" -f null pipe:1";
}
void tokenAdmission(HANDLE process, PSID expectedSid, HANDLE job) {
  HANDLE raw = nullptr; require(OpenProcessToken(process, TOKEN_QUERY, &raw) != 0); Handle token(raw);
  DWORD value = 0, size = 0;
  require(GetTokenInformation(token.value, TokenIsAppContainer, &value, sizeof(value), &size) && value != 0);
  value = 0;
  // Unsupported token-query semantics fail closed. No permissive fallback is used.
  require(GetTokenInformation(token.value, TokenIsLessPrivilegedAppContainer, &value, sizeof(value), &size) && value != 0);
  size = 0; GetTokenInformation(token.value, TokenAppContainerSid, nullptr, 0, &size);
  require(size >= sizeof(TOKEN_APPCONTAINER_INFORMATION) && size < 65536);
  std::vector<BYTE> sid(size);
  require(GetTokenInformation(token.value, TokenAppContainerSid, sid.data(), size, &size) != 0);
  require(EqualSid(reinterpret_cast<TOKEN_APPCONTAINER_INFORMATION*>(sid.data())->TokenAppContainer, expectedSid) != 0);
  size = 0; GetTokenInformation(token.value, TokenCapabilities, nullptr, 0, &size);
  require(size >= sizeof(DWORD) && size < 65536);
  std::vector<BYTE> groups(size);
  require(GetTokenInformation(token.value, TokenCapabilities, groups.data(), size, &size) != 0);
  require(reinterpret_cast<TOKEN_GROUPS*>(groups.data())->GroupCount == 0);
  BOOL assigned = FALSE; require(IsProcessInJob(process, job, &assigned) && assigned);
}
void decoder(const std::wstring& executable, const std::wstring& args, const std::wstring& root,
    PSID sid, HANDLE job, HANDLE input, HANDLE output, HANDLE outputInspection, HANDLE errors, ULONGLONG deadline,
    LONGLONG outputLimit = 128ll * 1024 * 1024) {
  HANDLE inputRaw = nullptr, outputRaw = nullptr;
  require(DuplicateHandle(GetCurrentProcess(), input, GetCurrentProcess(), &inputRaw, GENERIC_READ, TRUE, 0) != 0);
  Handle childInput(inputRaw);
  require(DuplicateHandle(GetCurrentProcess(), output, GetCurrentProcess(), &outputRaw, GENERIC_WRITE, TRUE, 0) != 0);
  Handle childOutput(outputRaw);
  STARTUPINFOEXW startup{}; startup.StartupInfo.cb = sizeof(startup);
  startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
  startup.StartupInfo.hStdInput = childInput.value; startup.StartupInfo.hStdOutput = childOutput.value; startup.StartupInfo.hStdError = errors;
  SIZE_T attributeBytes = 0; InitializeProcThreadAttributeList(nullptr, 3, 0, &attributeBytes);
  std::vector<BYTE> storage(attributeBytes);
  startup.lpAttributeList = reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(storage.data());
  require(InitializeProcThreadAttributeList(startup.lpAttributeList, 3, 0, &attributeBytes) != 0);
  struct Attributes { LPPROC_THREAD_ATTRIBUTE_LIST value; ~Attributes() { DeleteProcThreadAttributeList(value); } } attributes{startup.lpAttributeList};
  SECURITY_CAPABILITIES capabilities{}; capabilities.AppContainerSid = sid;
  require(UpdateProcThreadAttribute(startup.lpAttributeList, 0, PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES, &capabilities, sizeof(capabilities), nullptr, nullptr) != 0);
  HANDLE inherited[] = { childInput.value, childOutput.value, errors };
  require(UpdateProcThreadAttribute(startup.lpAttributeList, 0, PROC_THREAD_ATTRIBUTE_HANDLE_LIST, inherited, sizeof(inherited), nullptr, nullptr) != 0);
  DWORD packagePolicy = PROCESS_CREATION_ALL_APPLICATION_PACKAGES_OPT_OUT;
  require(UpdateProcThreadAttribute(startup.lpAttributeList, 0, PROC_THREAD_ATTRIBUTE_ALL_APPLICATION_PACKAGES_POLICY, &packagePolicy, sizeof(packagePolicy), nullptr, nullptr) != 0);
  std::wstring command = quote(executable) + args;
  wchar_t windowsPath[MAX_PATH]; const UINT windowsLength = GetWindowsDirectoryW(windowsPath, MAX_PATH);
  require(windowsLength > 0 && windowsLength < MAX_PATH);
  std::wstring environment = L"PATH=" + std::wstring(windowsPath) + L"\\System32";
  environment.push_back(L'\0'); environment += L"SystemRoot=" + std::wstring(windowsPath);
  environment.push_back(L'\0'); environment.push_back(L'\0');
  PROCESS_INFORMATION process{};
  require(CreateProcessW(executable.c_str(), command.data(), nullptr, nullptr, TRUE,
    EXTENDED_STARTUPINFO_PRESENT | CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW,
    environment.data(), root.c_str(), &startup.StartupInfo, &process) != 0);
  Handle child(process.hProcess), thread(process.hThread);
  try {
    require(AssignProcessToJobObject(job, child.value) != 0);
    tokenAdmission(child.value, sid, job);
    require(ResumeThread(thread.value) != DWORD(-1));
    DWORD wait = WAIT_TIMEOUT;
    while ((wait = WaitForSingleObject(child.value, 20)) == WAIT_TIMEOUT) {
      DWORD available = 0; LARGE_INTEGER size{};
      require(PeekNamedPipe(GetStdHandle(STD_INPUT_HANDLE), nullptr, 0, nullptr, &available, nullptr) && !available);
      require(GetTickCount64() < deadline && GetFileSizeEx(outputInspection, &size) && size.QuadPart <= outputLimit);
    }
    require(wait == WAIT_OBJECT_0);
    DWORD exitCode = 1; require(GetExitCodeProcess(child.value, &exitCode) && exitCode == 0);
    JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting{};
    require(QueryInformationJobObject(job, JobObjectBasicAccountingInformation, &accounting, sizeof(accounting), nullptr) && accounting.ActiveProcesses == 0);
  } catch (...) {
    TerminateJobObject(job, 1); TerminateProcess(child.value, 1);
    WaitForSingleObject(child.value, 5000); throw;
  }
}
void publish(HANDLE output, HANDLE parent, const std::wstring& finalName) {
  safeName(finalName);
  const DWORD bytes = static_cast<DWORD>(finalName.size() * sizeof(wchar_t));
  const DWORD size = static_cast<DWORD>(offsetof(FILE_RENAME_INFO, FileName)) + bytes;
  std::vector<BYTE> buffer(size, 0);
  auto info = reinterpret_cast<FILE_RENAME_INFO*>(buffer.data());
  info->ReplaceIfExists = FALSE; info->RootDirectory = parent; info->FileNameLength = bytes;
  std::memcpy(info->FileName, finalName.data(), bytes);
  require(SetFileInformationByHandle(output, FileRenameInfo, info, size) != 0);
}
std::vector<unsigned> selectedPages(const std::wstring& value) {
  require(!value.empty() && value.size() <= 6000);
  std::vector<unsigned> pages; unsigned number = 0, digits = 0;
  for (size_t i = 0; i <= value.size(); ++i) {
    const wchar_t character = i == value.size() ? L',' : value[i];
    if (character == L',') {
      require(digits > 0 && number > 0 && number <= 10000 && pages.size() < 1000);
      pages.push_back(number); number = 0; digits = 0;
    } else {
      require(character >= L'0' && character <= L'9' && digits < 5);
      number = number * 10 + static_cast<unsigned>(character - L'0'); ++digits;
    }
  }
  return pages;
}
// Only fixed broker-generated names are used. The decoder sees a read-only copy,
// not authority to reopen the original source or selected output by path.
HANDLE stageReadOnly(HANDLE source, const std::wstring& destination, PSID sid, const std::string& expectedHash) {
  BY_HANDLE_FILE_INFORMATION created{};
  {
    Handle writer(CreateFileW(destination.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr,
      CREATE_NEW, FILE_FLAG_OPEN_REPARSE_POINT, nullptr)); require(writer.value != INVALID_HANDLE_VALUE);
    rewindFile(source); BYTE buffer[65536]; DWORD read = 0; ULONGLONG total = 0;
    while (true) {
      require(ReadFile(source, buffer, sizeof(buffer), &read, nullptr) != 0); if (!read) break;
      total += read; require(total <= 128ull * 1024 * 1024);
      DWORD written = 0; require(WriteFile(writer.value, buffer, read, &written, nullptr) && written == read);
    }
    require(FlushFileBuffers(writer.value) != 0);
    require(sha256(writer.value) == expectedHash);
    require(GetFileInformationByHandle(writer.value, &created) != 0);
    acl(destination, sid, false, false);
  }
  HANDLE reader = CreateFileW(destination.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr,
    OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  require(reader != INVALID_HANDLE_VALUE);
  try {
    inspect(reader, destination, false);
    BY_HANDLE_FILE_INFORMATION reopened{}; require(GetFileInformationByHandle(reader, &reopened) != 0);
    require(created.dwVolumeSerialNumber == reopened.dwVolumeSerialNumber && created.nFileIndexHigh == reopened.nFileIndexHigh && created.nFileIndexLow == reopened.nFileIndexLow);
    require(sha256(reader) == expectedHash); rewindFile(source); return reader;
  } catch (...) { CloseHandle(reader); throw; }
}
unsigned readPageCount(HANDLE handle) {
  LARGE_INTEGER size{}; require(GetFileSizeEx(handle, &size) && size.QuadPart > 0 && size.QuadPart <= 32);
  rewindFile(handle); char bytes[33]{}; DWORD read = 0;
  require(ReadFile(handle, bytes, 32, &read, nullptr) && read == static_cast<DWORD>(size.QuadPart));
  unsigned result = 0, digits = 0; bool ending = false;
  for (DWORD i = 0; i < read; ++i) {
    if (bytes[i] == '\r' || bytes[i] == '\n') { ending = true; continue; }
    require(!ending && bytes[i] >= '0' && bytes[i] <= '9' && digits < 5);
    result = result * 10 + static_cast<unsigned>(bytes[i] - '0'); ++digits;
  }
  require(digits > 0 && result > 0 && result <= 10000); return result;
}
std::string boundedReport(HANDLE handle) {
  LARGE_INTEGER size{}; require(GetFileSizeEx(handle, &size) && size.QuadPart > 0 && size.QuadPart <= 1024 * 1024);
  rewindFile(handle); std::string result(static_cast<size_t>(size.QuadPart), '\0'); DWORD read = 0;
  require(ReadFile(handle, result.data(), static_cast<DWORD>(result.size()), &read, nullptr) && read == result.size());
  return result;
}
std::string fileIdentity(HANDLE handle) {
  BY_HANDLE_FILE_INFORMATION identity{}; require(GetFileInformationByHandle(handle, &identity) != 0);
  const ULONGLONG index = (ULONGLONG(identity.nFileIndexHigh) << 32) | identity.nFileIndexLow;
  return std::to_string(identity.dwVolumeSerialNumber) + ":" + std::to_string(index);
}
void isolatedWorkerAdmission() {
  HANDLE raw = nullptr; require(OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &raw) != 0); Handle token(raw);
  DWORD value = 0, size = 0;
  require(GetTokenInformation(token.value, TokenIsAppContainer, &value, sizeof(value), &size) && value != 0);
  value = 0; require(GetTokenInformation(token.value, TokenIsLessPrivilegedAppContainer, &value, sizeof(value), &size) && value != 0);
  size = 0; GetTokenInformation(token.value, TokenCapabilities, nullptr, 0, &size); require(size >= sizeof(DWORD) && size < 65536);
  std::vector<BYTE> groups(size); require(GetTokenInformation(token.value, TokenCapabilities, groups.data(), size, &size) != 0);
  require(reinterpret_cast<TOKEN_GROUPS*>(groups.data())->GroupCount == 0);
  BOOL inJob = FALSE; require(IsProcessInJob(GetCurrentProcess(), nullptr, &inJob) && inJob);
}
}
int wmain(int argc, wchar_t** argv) {
  std::wstring temporaryName;
  bool published = false;
  try {
    if (argc == 2 && std::wstring(argv[1]) == L"--zip-worker") {
      isolatedWorkerAdmission(); zip_store::create(GetStdHandle(STD_INPUT_HANDLE), GetStdHandle(STD_OUTPUT_HANDLE)); return 0;
    }
    if (argc == 3 && std::wstring(argv[1]) == L"--zip-validate") {
      isolatedWorkerAdmission(); zip_store::validate(GetStdHandle(STD_INPUT_HANDLE), ascii(argv[2])); return 0;
    }
    require(argc >= 8 && argc <= 23);
    std::wstring operation(argv[1]); const auto args = arguments(operation);
    const bool pdf = operation.rfind(L"qpdf-", 0) == 0;
    const bool zip = operation == L"zipstore-zip";
    const bool merge = operation == L"qpdf-merge", rotate = operation == L"qpdf-rotate", metadata = operation == L"qpdf-metadata";
    require(pdf ? (merge ? argc >= 9 && (argc - 9) % 2 == 0 : rotate ? argc == 10 : argc == 9) : argc == 8);
    if (merge) require(std::wstring(argv[8]) == L"merge");
    if (metadata) require(std::wstring(argv[8]) == L"remove");
    const std::wstring selection = pdf && !merge && !metadata ? argv[8] : L"";
    const auto pages = !selection.empty() ? selectedPages(selection) : std::vector<unsigned>{};
    unsigned degrees = 0;
    if (rotate) {
      const std::wstring value(argv[9]); require(value == L"90" || value == L"180" || value == L"270");
      degrees = static_cast<unsigned>(std::stoul(value)); require(std::set<unsigned>(pages.begin(), pages.end()).size() == pages.size());
    }
    const std::wstring input = full(argv[2]), output = full(argv[3]);
    const std::wstring root = full(argv[4]), executableName(argv[5]); safeName(executableName);
    require(input != output && input.rfind(root + L"\\", 0) != 0 && output.rfind(root + L"\\", 0) != 0);
    ParentLocks inputParents(input), outputParents(output);
    const std::wstring parentPath = output.substr(0, output.find_last_of(L'\\'));
    Handle parent(CreateFileW((parentPath.size() == 2 ? parentPath + L"\\" : parentPath).c_str(),
      FILE_LIST_DIRECTORY | FILE_ADD_FILE | FILE_READ_ATTRIBUTES | SYNCHRONIZE, FILE_SHARE_READ | FILE_SHARE_WRITE,
      nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    require(parent.value != INVALID_HANDLE_VALUE);
    BY_HANDLE_FILE_INFORMATION parentIdentity{}; require(GetFileInformationByHandle(parent.value, &parentIdentity) != 0);
    const ULONGLONG parentIndex = (ULONGLONG(parentIdentity.nFileIndexHigh) << 32) | parentIdentity.nFileIndexLow;
    require(std::to_wstring(parentIdentity.dwVolumeSerialNumber) + L":" + std::to_wstring(parentIndex) == argv[7]);
    Handle source(CreateFileW(input.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr,
      OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    require(source.value != INVALID_HANDLE_VALUE); inspect(source.value, input, false);
    BY_HANDLE_FILE_INFORMATION sourceIdentity{}; require(GetFileInformationByHandle(source.value, &sourceIdentity) != 0);
    const ULONGLONG fileIndex = (ULONGLONG(sourceIdentity.nFileIndexHigh) << 32) | sourceIdentity.nFileIndexLow;
    require(std::to_wstring(sourceIdentity.dwVolumeSerialNumber) + L":" + std::to_wstring(fileIndex) == argv[6]);
    LARGE_INTEGER size{}; require(GetFileSizeEx(source.value, &size) && size.QuadPart <= 64ll * 1024 * 1024);
    const std::string inputDigest = sha256(source.value);
    std::vector<std::unique_ptr<ParentLocks>> additionalParents;
    std::vector<std::unique_ptr<Handle>> additionalSources;
    std::vector<HANDLE> sources{source.value};
    std::vector<std::string> inputDigests{inputDigest};
    LONGLONG totalInputBytes = size.QuadPart;
    if (merge) for (int index = 9; index < argc; index += 2) {
      const auto selected = full(argv[index]); require(selected != output && selected.rfind(root + L"\\", 0) != 0);
      additionalParents.push_back(std::make_unique<ParentLocks>(selected));
      auto handle = std::make_unique<Handle>(CreateFileW(selected.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr,
        OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr)); require(handle->value != INVALID_HANDLE_VALUE);
      inspect(handle->value, selected, false); require(fileIdentity(handle->value) == ascii(argv[index + 1]));
      require(GetFileSizeEx(handle->value, &size) && size.QuadPart >= 0 && size.QuadPart <= 64ll * 1024 * 1024);
      totalInputBytes += size.QuadPart; require(totalInputBytes <= 64ll * 1024 * 1024);
      inputDigests.push_back(sha256(handle->value)); sources.push_back(handle->value); additionalSources.push_back(std::move(handle));
    }
    GUID temporaryId{}; require(CoCreateGuid(&temporaryId) == S_OK);
    wchar_t guid[40]; require(StringFromGUID2(temporaryId, guid, 40) > 0);
    const std::wstring candidate = L".material-incomplete-" + std::wstring(guid + 1, 36) + L".tmp";
    const std::wstring temporaryPath = parentPath + L"\\" + candidate;
    Handle destination(CreateFileW(temporaryPath.c_str(), GENERIC_READ | GENERIC_WRITE | DELETE, 0,
      nullptr, CREATE_NEW, FILE_ATTRIBUTE_NORMAL | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    require(destination.value != INVALID_HANDLE_VALUE); temporaryName = candidate;
    inspect(destination.value, temporaryPath, false);
    Profile profile; unsigned entries = 0; ULONGLONG payloadBytes = 0; payload(root, profile.sid, entries, payloadBytes);
    const std::wstring executable = root + L"\\" + executableName;
    ParentLocks executableParents(executable);
    Handle image(CreateFileW(executable.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr,
      OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    require(image.value != INVALID_HANDLE_VALUE); inspect(image.value, executable, false);
    SECURITY_ATTRIBUTES inheritance{ sizeof(SECURITY_ATTRIBUTES), nullptr, TRUE };
    Handle errors(CreateFileW(L"NUL", GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE,
      &inheritance, OPEN_EXISTING, 0, nullptr)); require(errors.value != INVALID_HANDLE_VALUE);
    Handle job(CreateJobObjectW(nullptr, nullptr)); require(job.value != nullptr);
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
    limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS |
      JOB_OBJECT_LIMIT_PROCESS_MEMORY | JOB_OBJECT_LIMIT_JOB_MEMORY | JOB_OBJECT_LIMIT_PROCESS_TIME |
      JOB_OBJECT_LIMIT_JOB_TIME | JOB_OBJECT_LIMIT_DIE_ON_UNHANDLED_EXCEPTION;
    limits.BasicLimitInformation.ActiveProcessLimit = 1;
    limits.BasicLimitInformation.PerProcessUserTimeLimit.QuadPart = 20ll * 10000000;
    limits.BasicLimitInformation.PerJobUserTimeLimit.QuadPart = 20ll * 10000000;
    limits.ProcessMemoryLimit = 256ull * 1024 * 1024; limits.JobMemoryLimit = limits.ProcessMemoryLimit;
    require(SetInformationJobObject(job.value, JobObjectExtendedLimitInformation, &limits, sizeof(limits)) != 0);
    const ULONGLONG deadline = GetTickCount64() + 30000;
    unsigned inputPages = 0, outputPages = 0, expectedPages = 0;
    std::vector<unsigned> inputPageCounts;
    bool rotationVerified = false, metadataVerified = false;
    if (pdf) {
      const std::wstring data = root + L"-data";
      require(CreateDirectoryW(data.c_str(), nullptr) != 0); acl(data, profile.sid, true);
      ParentLocks dataParents(data + L"\\entry");
      Handle counter(CreateFileW((data + L"\\page-count.bin").c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr,
        CREATE_NEW, FILE_FLAG_OPEN_REPARSE_POINT, nullptr)); require(counter.value != INVALID_HANDLE_VALUE);
      Handle report(CreateFileW((data + L"\\inspection.json").c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr,
        CREATE_NEW, FILE_FLAG_OPEN_REPARSE_POINT, nullptr)); require(report.value != INVALID_HANDLE_VALUE);
      std::vector<std::wstring> sourcePaths;
      std::vector<std::unique_ptr<Handle>> stagedSources;
      auto pageCount = [&](const std::wstring& file) {
        rewindFile(counter.value); require(SetEndOfFile(counter.value) != 0);
        decoder(executable, L" --show-npages " + quote(file), root, profile.sid, job.value, source.value,
          counter.value, counter.value, errors.value, deadline, 32);
        return readPageCount(counter.value);
      };
      auto inspectReport = [&](const std::wstring& file) {
        rewindFile(report.value); require(SetEndOfFile(report.value) != 0);
        decoder(executable, L" --json=2 --json-key=qpdf --json-key=pages --json-stream-data=none " + quote(file),
          root, profile.sid, job.value, source.value, report.value, report.value, errors.value, deadline, 1024 * 1024);
        return qpdf_json::Report(boundedReport(report.value));
      };
      for (size_t index = 0; index < sources.size(); ++index) {
        signature(sources[index], operation);
        const std::wstring staged = data + L"\\source-" + std::to_wstring(index) + L".pdf";
        auto reader = std::make_unique<Handle>(stageReadOnly(sources[index], staged, profile.sid, inputDigests[index]));
        decoder(executable, L" --check " + quote(staged), root, profile.sid, job.value, source.value, errors.value, destination.value, errors.value, deadline);
        const unsigned count = pageCount(staged);
        inputPageCounts.push_back(count); inputPages += count; require(inputPages <= 10000);
        sourcePaths.push_back(staged); stagedSources.push_back(std::move(reader));
      }
      for (unsigned page : pages) require(page <= inputPages);
      expectedPages = merge || rotate || metadata ? inputPages : static_cast<unsigned>(pages.size());
      std::vector<int> beforeRotations;
      if (rotate) { beforeRotations = inspectReport(sourcePaths[0]).rotations(); require(beforeRotations.size() == inputPages); }
      std::wstring metadataPath;
      std::unique_ptr<Handle> metadataUpdate;
      if (metadata) {
        const std::string patch = inspectReport(sourcePaths[0]).withoutInfoUpdate();
        rewindFile(counter.value); require(SetEndOfFile(counter.value) != 0);
        DWORD written = 0; require(WriteFile(counter.value, patch.data(), static_cast<DWORD>(patch.size()), &written, nullptr) && written == patch.size());
        metadataPath = data + L"\\metadata-update.json";
        metadataUpdate = std::make_unique<Handle>(stageReadOnly(counter.value, metadataPath, profile.sid, sha256(counter.value)));
      }
      std::wstring command;
      if (merge) {
        command = L" --empty --pages";
        for (const auto& file : sourcePaths) command += L" " + quote(file) + L" 1-z";
        command += L" -- -";
      } else if (rotate) command = L" " + quote(sourcePaths[0]) + L" --rotate=+" + std::to_wstring(degrees) + L":" + selection + L" -";
      else if (metadata) command = L" " + quote(sourcePaths[0]) + L" --update-from-json=" + quote(metadataPath) + L" --remove-metadata -";
      else command = L" " + quote(sourcePaths[0]) + L" --pages . " + selection + L" -- -";
      require(command.size() + executable.size() + 3 < 24000);
      decoder(executable, command, root, profile.sid, job.value, source.value, destination.value, destination.value, errors.value, deadline);
      require(FlushFileBuffers(destination.value) != 0); signature(destination.value, operation);
      const std::string expectedOutputHash = sha256(destination.value);
      const std::wstring validationPath = data + L"\\validation.pdf";
      Handle stagedOutput(stageReadOnly(destination.value, validationPath, profile.sid, expectedOutputHash));
      decoder(executable, L" --check " + quote(validationPath), root, profile.sid, job.value, source.value, errors.value, destination.value, errors.value, deadline);
      outputPages = pageCount(validationPath);
      require(outputPages == expectedPages && sha256(destination.value) == expectedOutputHash);
      if (rotate) {
        const auto afterRotations = inspectReport(validationPath).rotations(); require(afterRotations.size() == beforeRotations.size());
        const std::set<unsigned> selected(pages.begin(), pages.end());
        for (size_t index = 0; index < afterRotations.size(); ++index) {
          const int expected = (beforeRotations[index] + (selected.count(static_cast<unsigned>(index + 1)) ? static_cast<int>(degrees) : 0)) % 360;
          require(afterRotations[index] == expected);
        }
        rotationVerified = true;
      }
      if (metadata) { metadataVerified = inspectReport(validationPath).metadataAbsent(); require(metadataVerified); }
    } else {
      decoder(executable, args, root, profile.sid, job.value, source.value, destination.value, destination.value, errors.value, deadline);
    }
    require(GetFileSizeEx(destination.value, &size) && size.QuadPart > 0 && size.QuadPart <= 128ll * 1024 * 1024);
    require(FlushFileBuffers(destination.value) != 0); signature(destination.value, operation);
    if (!pdf) decoder(executable, zip ? L" --zip-validate " + std::wstring(inputDigest.begin(), inputDigest.end()) : validationArguments(operation), root, profile.sid, job.value, destination.value, errors.value, destination.value, errors.value, deadline);
    const std::string outputDigest = sha256(destination.value);
    DWORD available = 0;
    require(PeekNamedPipe(GetStdHandle(STD_INPUT_HANDLE), nullptr, 0, nullptr, &available, nullptr) && !available && GetTickCount64() < deadline);
    publish(destination.value, parent.value, output.substr(output.find_last_of(L'\\') + 1)); published = true;
    const std::string operationText = ascii(operation);
    std::string pdfFields = pdf ? ",\"inputPages\":" + std::to_string(inputPages) + ",\"expectedPages\":" + std::to_string(expectedPages) + ",\"outputPages\":" + std::to_string(outputPages) : "";
    if (merge) {
      pdfFields += ",\"sourceSha256s\":[";
      for (size_t index = 0; index < inputDigests.size(); ++index) {
        if (index) pdfFields += ","; pdfFields += "\"" + inputDigests[index] + "\"";
      }
      pdfFields += "],\"inputPageCounts\":[";
      for (size_t index = 0; index < inputPageCounts.size(); ++index) { if (index) pdfFields += ","; pdfFields += std::to_string(inputPageCounts[index]); }
      pdfFields += "]";
    }
    if (rotate) pdfFields += ",\"degrees\":" + std::to_string(degrees) + ",\"rotationVerified\":" + (rotationVerified ? "true" : "false");
    if (metadata) pdfFields += ",\"metadataMode\":\"remove\",\"metadataAbsent\":" + std::string(metadataVerified ? "true" : "false");
    if (zip) pdfFields += ",\"memberCount\":1,\"memberName\":\"input.bin\"";
    std::printf("{\"protocol\":1,\"state\":\"completed\",\"operation\":\"%s\",\"mechanism\":\"appcontainer-handle-job\",\"sourceSha256\":\"%s\",\"outputBytes\":%llu,\"outputSha256\":\"%s\",\"validation\":\"%s\",\"admission\":{\"appContainer\":true,\"lpac\":true,\"capabilityCount\":0,\"jobAssigned\":true,\"handleList\":true},\"publication\":\"atomic-no-replace\"%s}\n",
      operationText.c_str(), inputDigest.c_str(), static_cast<unsigned long long>(size.QuadPart), outputDigest.c_str(),
      zip ? "zip-stored-member-crc-and-source-hash" : rotate ? "qpdf-structure-page-count-and-rotation" : metadata ? "qpdf-structure-page-count-and-metadata" : pdf ? "qpdf-structure-and-page-count" : "signature-and-decoder-roundtrip", pdfFields.c_str());
    return 0;
  } catch (...) {
    // Preserve the exact partial output under its explicit incomplete name. Never
    // replace the selected destination or remove another process's path on failure.
    if (!temporaryName.empty() && !published) {
      const std::string name = ascii(temporaryName);
      std::printf("{\"protocol\":1,\"state\":\"incomplete\",\"temporaryName\":\"%s\",\"publication\":\"not-published\"}\n", name.c_str());
    }
    std::fputs("BROKER_UNAVAILABLE\n", stderr); return 1;
  }
}
