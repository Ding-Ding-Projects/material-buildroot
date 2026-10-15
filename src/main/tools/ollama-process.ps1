$utf8=[Text.UTF8Encoding]::new($false,$true)
[Console]::InputEncoding=$utf8
[Console]::OutputEncoding=$utf8
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public sealed class ManagedOllamaJob : IDisposable {
 [StructLayout(LayoutKind.Sequential)] struct BasicLimit { public long ProcessTime,JobTime; public uint Flags; public UIntPtr MinimumWorkingSet,MaximumWorkingSet; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint Priority,Scheduling; }
 [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong ReadOperations,WriteOperations,OtherOperations,ReadBytes,WriteBytes,OtherBytes; }
 [StructLayout(LayoutKind.Sequential)] struct ExtendedLimit { public BasicLimit Basic; public IoCounters Io; public UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory; }
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Startup { public uint cb; public string reserved,desktop,title; public uint x,y,xSize,ySize,xChars,yChars,fill,flags; public ushort show,reservedSize; public IntPtr reservedData,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
 [StructLayout(LayoutKind.Sequential)] struct Accounting { public long user,kernel,periodUser,periodKernel; public uint faults,total,active,terminated; }
 [StructLayout(LayoutKind.Sequential,Pack=4)] struct FileInfo { public uint attributes; public long creation,access,write; public uint volume,sizeHigh,sizeLow,links,indexHigh,indexLow; }
 [DllImport("kernel32",SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32",SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref ExtendedLimit info,uint length);
 [DllImport("kernel32",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,ref Accounting info,uint length,IntPtr returned);
 [DllImport("kernel32",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint code);
 [DllImport("kernel32",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32",SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out long creation,out long exit,out long kernel,out long user);
 [DllImport("kernel32",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr process,uint flags,StringBuilder path,ref uint length);
 [DllImport("kernel32",SetLastError=true,CharSet=CharSet.Unicode)] static extern bool CreateProcess(string application,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr environment,string directory,ref Startup startup,out ProcessInfo info);
 [DllImport("kernel32",SetLastError=true,CharSet=CharSet.Unicode)] static extern SafeFileHandle CreateFile(string name,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle file,out FileInfo info);
 [DllImport("kernel32",SetLastError=true,CharSet=CharSet.Unicode)] static extern uint GetFinalPathNameByHandle(SafeFileHandle file,StringBuilder name,uint length,uint flags);
 [DllImport("kernel32")] static extern bool CloseHandle(IntPtr handle);
 readonly List<IDisposable> protection=new List<IDisposable>(); IntPtr job,process; public uint Pid {get;private set;} public long Creation {get;private set;} public string Executable {get;private set;}
 static string LongPath(string value) { value=Path.GetFullPath(value); return value.StartsWith(@"\\?\")?value:value.StartsWith(@"\\")?@"\\?\UNC\"+value.Substring(2):@"\\?\"+value; }
 static string Plain(string value) { return value.StartsWith(@"\\?\UNC\")?@"\\"+value.Substring(8):value.StartsWith(@"\\?\")?value.Substring(4):value; }
 static Exception Error() {return new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());}
 public void Protect(string file,string digest,long bytes,bool directory) {
  var handle=CreateFile(LongPath(file),directory?0x80u:0x80000000u,1,IntPtr.Zero,3,0x00200000u|(directory?0x02000000u:0u),IntPtr.Zero);
  if(handle.IsInvalid){handle.Dispose();throw Error();}
  try { FileInfo info;if(!GetFileInformationByHandle(handle,out info))throw Error();if((info.attributes&0x400)!=0||(directory&&(info.attributes&0x10)==0)||(!directory&&((info.attributes&0x10)!=0||info.links!=1)))throw new Exception("FILE_IDENTITY_REJECTED");
   var final=new StringBuilder(32768);uint size=GetFinalPathNameByHandle(handle,final,32768,0);if(size==0||size>=32768||!String.Equals(Plain(final.ToString()),Plain(Path.GetFullPath(file)),StringComparison.OrdinalIgnoreCase))throw new Exception("FINAL_PATH_MISMATCH");
   if(directory){protection.Add(handle);return;}
   var stream=new FileStream(handle,FileAccess.Read);handle=null;try{if(bytes>=0&&stream.Length!=bytes)throw new Exception("PAYLOAD_LENGTH_MISMATCH");using(var hash=SHA256.Create()){var actual=BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant();if(actual!=digest)throw new Exception("PAYLOAD_HASH_MISMATCH");}protection.Add(stream);}catch{stream.Dispose();throw;}
  } finally {if(handle!=null&&!protection.Contains(handle))handle.Dispose();}
 }
 public void Start(string executable,string cwd,string environment) {
  job=CreateJobObject(IntPtr.Zero,null);if(job==IntPtr.Zero)throw Error();var limit=new ExtendedLimit();limit.Basic.Flags=0x2000;if(!SetInformationJobObject(job,9,ref limit,(uint)Marshal.SizeOf(limit)))throw Error();
  var startup=new Startup();startup.cb=(uint)Marshal.SizeOf(startup);ProcessInfo created;IntPtr block=Marshal.StringToHGlobalUni(environment);
  try{if(!CreateProcess(LongPath(executable),new StringBuilder("\""+LongPath(executable)+"\" serve"),IntPtr.Zero,IntPtr.Zero,false,0x08000404,block,LongPath(cwd),ref startup,out created))throw Error();}finally{Marshal.FreeHGlobal(block);}
  process=created.process;Pid=created.pid;try{if(!AssignProcessToJobObject(job,process)){TerminateProcess(process,1);WaitForSingleObject(process,5000);throw Error();}long exit,kernel,user,creation;if(!GetProcessTimes(process,out creation,out exit,out kernel,out user))throw Error();Creation=creation;var image=new StringBuilder(32768);uint length=32768;if(!QueryFullProcessImageName(process,0,image,ref length))throw Error();Executable=Plain(image.ToString());if(!String.Equals(Executable,Plain(Path.GetFullPath(executable)),StringComparison.OrdinalIgnoreCase))throw new Exception("PROCESS_PATH_MISMATCH");if(ResumeThread(created.thread)==0xffffffff)throw Error();}finally{CloseHandle(created.thread);}
 }
 public static Task<string> ReadCommand(){return Task.Factory.StartNew(()=>Console.ReadLine(),CancellationToken.None,TaskCreationOptions.LongRunning,TaskScheduler.Default);}
 public bool Alive(){return process!=IntPtr.Zero&&WaitForSingleObject(process,0)==258;}
 public uint Active(){var account=new Accounting();if(job==IntPtr.Zero||!QueryInformationJobObject(job,1,ref account,(uint)Marshal.SizeOf(account),IntPtr.Zero))throw Error();return account.active;}
 public bool Stop(){if(job==IntPtr.Zero)return true;if(!TerminateJobObject(job,1))throw Error();for(int i=0;i<100;i++){if(Active()==0)return true;System.Threading.Thread.Sleep(50);}return false;}
 public void Dispose(){if(job!=IntPtr.Zero){CloseHandle(job);job=IntPtr.Zero;}if(process!=IntPtr.Zero){CloseHandle(process);process=IntPtr.Zero;}foreach(var item in protection)item.Dispose();protection.Clear();}
}
'@
$owner = New-Object ManagedOllamaJob
function Reply($value) { [Console]::Out.WriteLine(($value | ConvertTo-Json -Compress -Depth 8)); [Console]::Out.Flush() }
try {
 $launch = [Console]::ReadLine() | ConvertFrom-Json
 if ($launch.action -ne 'launch' -or $launch.nonce -notmatch '^[a-f0-9]{32}$' -or $launch.members.Count -lt 1 -or $launch.members.Count -gt 10000) { throw 'INVALID_LAUNCH' }
 $nonce = $launch.nonce
 Import-Module ([IO.Path]::Combine($env:SystemRoot,'System32\WindowsPowerShell\v1.0\Modules\NetTCPIP\NetTCPIP.psd1')) -ErrorAction Stop
 $nextCommand = [ManagedOllamaJob]::ReadCommand()
 $root = [IO.Path]::GetFullPath([string]$launch.directory)
 $exe = [IO.Path]::GetFullPath([string]$launch.executable)
 if (-not $exe.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'EXECUTABLE_OUTSIDE_ROOT' }
 $owner.Protect($root, '', -1, $true)
 $directories = @{}
 foreach ($member in $launch.members) {
  if ($member.path -notmatch '^[A-Za-z0-9_./-]+$' -or $member.path -match '(^|/)\.\.?(\/|$)' -or $member.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'INVALID_MEMBER' }
  $file = [IO.Path]::GetFullPath([IO.Path]::Combine($root, [string]$member.path))
  if (-not $file.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'MEMBER_OUTSIDE_ROOT' }
  $parent = [IO.Path]::GetDirectoryName($file)
  while ($parent.Length -gt $root.Length) { $directories[$parent] = $true; $parent = [IO.Path]::GetDirectoryName($parent) }
 }
 foreach ($folder in ($directories.Keys | Sort-Object Length)) { $owner.Protect($folder, '', -1, $true) }
 foreach ($member in $launch.members) { if ($nextCommand.IsCompleted) { throw 'CANCELLED_BEFORE_START' }; $owner.Protect([IO.Path]::Combine($root,[string]$member.path),[string]$member.sha256,[long]$member.length,$false) }
 $environment = 'OLLAMA_HOST=127.0.0.1:11434' + [char]0 + 'OLLAMA_MODELS=' + [string]$launch.models + [char]0 + 'PATH=' + [IO.Path]::GetDirectoryName($exe) + [char]0 + 'SystemRoot=' + $env:SystemRoot + [char]0 + [char]0
 if ($nextCommand.IsCompleted) { throw 'CANCELLED_BEFORE_START' }
 $owner.Start($exe,$root,$environment)
 Reply @{type='started';nonce=$nonce;pid=$owner.Pid;creation=[string]$owner.Creation;executable=$owner.Executable}
 while ($null -ne ($line = $nextCommand.GetAwaiter().GetResult())) {
  $nextCommand = [ManagedOllamaJob]::ReadCommand()
  $request = $line | ConvertFrom-Json
  if ($request.nonce -ne $nonce -or $request.id -notmatch '^[a-f0-9]{16}$') { throw 'INVALID_PROTOCOL' }
  switch ($request.action) {
   'verify' {
    $listeners = @(Get-NetTCPConnection -State Listen -LocalPort 11434 -ErrorAction SilentlyContinue)
    $valid = $owner.Alive() -and $listeners.Count -gt 0
    foreach ($listener in $listeners) { if ($listener.OwningProcess -ne $owner.Pid -or $listener.LocalAddress -ne '127.0.0.1') { $valid = $false } }
    Reply @{type='verified';id=$request.id;nonce=$nonce;pid=$owner.Pid;creation=[string]$owner.Creation;verified=[bool]$valid}
   }
   'stop' {
    $settled=$owner.Stop()
    Reply @{type='stopped';id=$request.id;nonce=$nonce;pid=$owner.Pid;creation=[string]$owner.Creation;settled=$settled;active=$owner.Active()}
    if ($settled) { break }
   }
   default { throw 'UNSUPPORTED_COMMAND' }
  }
  if ($request.action -eq 'stop' -and $settled) { break }
 }
} catch { Reply @{type='error';code='NATIVE_OWNERSHIP_FAILED'}; exit 1 }
finally { try { $clean = $owner.Stop(); $active = 0; if ($owner.Pid -gt 0) { $active = $owner.Active() }; Reply @{type='cleanup';nonce=$nonce;pid=$owner.Pid;creation=[string]$owner.Creation;settled=$clean;active=$active} } finally { $owner.Dispose() } }
