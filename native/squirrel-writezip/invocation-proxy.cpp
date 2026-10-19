#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <bcrypt.h>
#include <string>
#include <vector>
#include <sstream>
#include <stdexcept>
#include <memory>

struct FileIdentity { unsigned long long bytes=0; std::string sha256; };
struct ResourceIdentity { bool present=false; DWORD bytes=0,error=0; std::string sha256; };
struct SetupIdentity { FileIdentity file; ResourceIdentity resource; };

std::string HashBytes(const unsigned char* data, size_t length) {
    BCRYPT_ALG_HANDLE algorithm=nullptr; BCRYPT_HASH_HANDLE hash=nullptr;
    DWORD objectBytes=0,returned=0;
    if(BCryptOpenAlgorithmProvider(&algorithm,BCRYPT_SHA256_ALGORITHM,nullptr,0)<0) throw std::runtime_error("Hash provider unavailable");
    if(BCryptGetProperty(algorithm,BCRYPT_OBJECT_LENGTH,reinterpret_cast<PUCHAR>(&objectBytes),sizeof(objectBytes),&returned,0)<0){ BCryptCloseAlgorithmProvider(algorithm,0);throw std::runtime_error("Hash object unavailable"); }
    std::vector<unsigned char> object(objectBytes);unsigned char digest[32];
    if(BCryptCreateHash(algorithm,&hash,object.data(),objectBytes,nullptr,0,0)<0){ BCryptCloseAlgorithmProvider(algorithm,0);throw std::runtime_error("Hash creation failed"); }
    bool ok=true;
    for(size_t offset=0;offset<length;){const ULONG count=static_cast<ULONG>((length-offset)>1048576?1048576:(length-offset));if(BCryptHashData(hash,const_cast<PUCHAR>(data+offset),count,0)<0){ok=false;break;}offset+=count;}
    if(ok)ok=BCryptFinishHash(hash,digest,sizeof(digest),0)>=0;
    BCryptDestroyHash(hash);BCryptCloseAlgorithmProvider(algorithm,0);
    if(!ok)throw std::runtime_error("Hash failed");
    static const char hex[]="0123456789abcdef";std::string result;result.reserve(64);
    for(unsigned char byte:digest){result.push_back(hex[byte>>4]);result.push_back(hex[byte&15]);}return result;
}

FileIdentity File(const std::wstring& path) {
    HANDLE file=CreateFileW(path.c_str(),GENERIC_READ,FILE_SHARE_READ,nullptr,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr);
    if(file==INVALID_HANDLE_VALUE)throw std::runtime_error("File identity unavailable");
    LARGE_INTEGER length={};
    if(!GetFileSizeEx(file,&length)||length.QuadPart<0||length.QuadPart>2000000000LL){CloseHandle(file);throw std::runtime_error("File identity exceeds its bound");}
    HANDLE mapping=length.QuadPart?CreateFileMappingW(file,nullptr,PAGE_READONLY,0,0,nullptr):nullptr;
    const unsigned char* bytes=mapping?static_cast<const unsigned char*>(MapViewOfFile(mapping,FILE_MAP_READ,0,0,0)):nullptr;
    if(length.QuadPart&&!bytes){if(mapping)CloseHandle(mapping);CloseHandle(file);throw std::runtime_error("File mapping failed");}
    std::string digest;
    try {digest=HashBytes(bytes,static_cast<size_t>(length.QuadPart));}
    catch(...){if(bytes)UnmapViewOfFile(bytes);if(mapping)CloseHandle(mapping);CloseHandle(file);throw;}
    if(bytes)UnmapViewOfFile(bytes);if(mapping)CloseHandle(mapping);CloseHandle(file);
    return {static_cast<unsigned long long>(length.QuadPart),digest};
}

SetupIdentity Setup(const std::wstring& path) {
    SetupIdentity result;result.file=File(path);
    HMODULE module=LoadLibraryExW(path.c_str(),nullptr,LOAD_LIBRARY_AS_DATAFILE_EXCLUSIVE|LOAD_LIBRARY_AS_IMAGE_RESOURCE);
    if(!module){result.resource.error=GetLastError();return result;}
    HRSRC resource=FindResourceExW(module,L"DATA",MAKEINTRESOURCEW(131),0x409);
    if(resource){
        HGLOBAL loaded=LoadResource(module,resource);const unsigned char* data=loaded?static_cast<const unsigned char*>(LockResource(loaded)):nullptr;
        const DWORD length=SizeofResource(module,resource);
        if(data&&length){try{result.resource.sha256=HashBytes(data,length);result.resource.bytes=length;result.resource.present=true;}catch(...){FreeLibrary(module);throw;}}
        else result.resource.error=GetLastError();
    }else result.resource.error=GetLastError();
    FreeLibrary(module);return result;
}

std::wstring Quote(const std::wstring& value) {
    std::wstring out=L"\"";size_t slashes=0;
    for(wchar_t ch:value){if(ch==L'\\'){slashes++;continue;}if(ch==L'\"'){out.append(slashes*2+1,L'\\');out.push_back(ch);}else{out.append(slashes,L'\\');out.push_back(ch);}slashes=0;}
    out.append(slashes*2,L'\\');out.push_back(L'\"');return out;
}

struct OwnedHelper {
    HANDLE job=nullptr,process=nullptr,thread=nullptr;bool completed=false;
    ~OwnedHelper(){
        // Process termination also covers assignment or resume failures before the job owns it.
        if(process&&!completed){TerminateProcess(process,ERROR_PROCESS_ABORTED);WaitForSingleObject(process,5000);}
        if(thread)CloseHandle(thread);
        if(process)CloseHandle(process);
        if(job)CloseHandle(job);
    }
};

DWORD Launch(const std::wstring& genuine,int argc,wchar_t** argv) {
    OwnedHelper owned;
    owned.job=CreateJobObjectW(nullptr,nullptr);
    if(!owned.job)throw std::runtime_error("Genuine helper job creation failed");
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits={};
    limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if(!SetInformationJobObject(owned.job,JobObjectExtendedLimitInformation,&limits,sizeof(limits)))throw std::runtime_error("Genuine helper containment unavailable");
    std::wstring command=Quote(genuine);for(int i=1;i<argc;i++)command+=L" "+Quote(argv[i]);
    std::vector<wchar_t> mutableCommand(command.begin(),command.end());mutableCommand.push_back(0);
    STARTUPINFOW startup={};startup.cb=sizeof(startup);PROCESS_INFORMATION process={};
    if(!CreateProcessW(genuine.c_str(),mutableCommand.data(),nullptr,nullptr,FALSE,CREATE_NO_WINDOW|CREATE_SUSPENDED,nullptr,nullptr,&startup,&process))throw std::runtime_error("Genuine helper launch failed");
    owned.process=process.hProcess;owned.thread=process.hThread;
    if(!AssignProcessToJobObject(owned.job,owned.process))throw std::runtime_error("Genuine helper assignment failed");
    if(ResumeThread(owned.thread)==static_cast<DWORD>(-1))throw std::runtime_error("Genuine helper resume failed");
    const DWORD waited=WaitForSingleObject(owned.process,120000);
    if(waited!=WAIT_OBJECT_0){
        const DWORD reason=waited==WAIT_TIMEOUT?ERROR_TIMEOUT:ERROR_PROCESS_ABORTED;
        if(!TerminateJobObject(owned.job,reason)||WaitForSingleObject(owned.process,5000)!=WAIT_OBJECT_0)throw std::runtime_error("Genuine helper stop could not be confirmed");
    }
    DWORD result=ERROR_PROCESS_ABORTED;
    if(!GetExitCodeProcess(owned.process,&result)||result==STILL_ACTIVE)throw std::runtime_error("Genuine helper exit unavailable");
    owned.completed=true;
    return result;
}

std::string Describe(const SetupIdentity& value) {
    std::ostringstream out;out<<"{\"bytes\":"<<value.file.bytes<<",\"sha256\":\""<<value.file.sha256<<"\",\"dataResource\":{\"present\":"<<(value.resource.present?"true":"false")<<",\"bytes\":"<<value.resource.bytes<<",\"sha256\":\""<<value.resource.sha256<<"\",\"error\":"<<value.resource.error<<"}}";return out.str();
}

int wmain(int argc,wchar_t** argv) {
    DWORD actualExit=ERROR_PROCESS_ABORTED;bool ran=false;
    try {
        const bool copy=argc==4&&std::wstring(argv[1])==L"--copy-stub-resources";
        const bool embed=(argc==3||(argc==5&&std::wstring(argv[3])==L"--set-required-framework"))&&argv[1][0]!=L'-';
        if(!copy&&!embed)return ERROR_INVALID_PARAMETER;
        wchar_t module[32768];const DWORD moduleLength=GetModuleFileNameW(nullptr,module,32768);
        if(!moduleLength||moduleLength>=32768)return ERROR_BAD_PATHNAME;
        const std::wstring self(module,moduleLength),genuine=self.substr(0,self.find_last_of(L"\\/"))+L"\\WriteZipToSetup.Genuine.exe";
        if(copy)return static_cast<int>(Launch(genuine,argc,argv));
        wchar_t trace[32768],source[64];const DWORD traceLength=GetEnvironmentVariableW(L"MATERIAL_BUILD_SQUIRREL_TRACE",trace,32768),sourceLength=GetEnvironmentVariableW(L"MATERIAL_BUILD_SOURCE_SHA",source,64);
        if(!traceLength||traceLength>=32768||sourceLength!=40)return ERROR_BAD_ENVIRONMENT;
        std::string sourceAscii;for(DWORD i=0;i<sourceLength;i++){if(!((source[i]>=L'0'&&source[i]<=L'9')||(source[i]>=L'a'&&source[i]<=L'f')))return ERROR_BAD_ENVIRONMENT;sourceAscii.push_back(static_cast<char>(source[i]));}
        const FileIdentity genuineIdentity=File(genuine),proxyIdentity=File(self),zip=File(argv[2]);const SetupIdentity before=Setup(argv[1]);
        wchar_t retention[16];const DWORD retentionLength=GetEnvironmentVariableW(L"MATERIAL_BUILD_SQUIRREL_INPUT_MODE",retention,16);
        const bool reuse=retentionLength==5&&std::wstring(retention,retentionLength)==L"reuse";
        if(retentionLength&&!reuse&&!(retentionLength==6&&std::wstring(retention,retentionLength)==L"retain"))return ERROR_BAD_ENVIRONMENT;
        if(!reuse){
            const std::wstring retained=std::wstring(trace,traceLength)+L"\\embedding-input.zip";
            if(!CopyFileW(argv[2],retained.c_str(),TRUE))throw std::runtime_error("Exclusive embedding input could not be retained");
            const FileIdentity saved=File(retained);
            if(saved.bytes!=zip.bytes||saved.sha256!=zip.sha256)throw std::runtime_error("Retained embedding input changed");
        }
        actualExit=Launch(genuine,argc,argv);ran=true;
        const SetupIdentity after=Setup(argv[1]);
        std::ostringstream out;out<<"{\"schemaVersion\":1,\"source\":\""<<sourceAscii<<"\",\"kind\":\"genuine-embedding-invocation\",\"genuineHelperSha256\":\""<<genuineIdentity.sha256<<"\",\"proxySha256\":\""<<proxyIdentity.sha256<<"\",\"childExitCode\":"<<actualExit<<",\"inputRetained\":"<<(!reuse?"true":"false")<<",\"inputZip\":{\"bytes\":"<<zip.bytes<<",\"sha256\":\""<<zip.sha256<<"\"},\"before\":"<<Describe(before)<<",\"after\":"<<Describe(after)<<",\"runtimeVerified\":false}";
        const std::wstring report=std::wstring(trace,traceLength)+L"\\setup-helper-invocation.json";
        HANDLE output=CreateFileW(report.c_str(),GENERIC_WRITE,0,nullptr,CREATE_NEW,FILE_ATTRIBUTE_NORMAL,nullptr);
        if(output==INVALID_HANDLE_VALUE)throw std::runtime_error("Invocation record already exists or cannot be created");
        const std::string text=out.str();DWORD written=0;const BOOL saved=WriteFile(output,text.data(),static_cast<DWORD>(text.size()),&written,nullptr);const BOOL flushed=FlushFileBuffers(output);CloseHandle(output);
        if(!saved||!flushed||written!=text.size())throw std::runtime_error("Invocation record was not retained");
        return static_cast<int>(actualExit);
    } catch(...) {return ran&&actualExit!=0?static_cast<int>(actualExit):ERROR_WRITE_FAULT;}
}
