'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
let launcher;
function launcherBytes() {
  if (launcher) return launcher;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'native-test-launcher-'));
  try {
    const source = path.join(directory, 'Launcher.cs');
    const output = path.join(directory, 'Launcher.exe');
    const node = process.execPath.replace(/"/g, '""');
    fs.writeFileSync(source, `using System; using System.Diagnostics; using System.Text; using System.Runtime.InteropServices;
class Launcher {
 [DllImport("kernel32.dll")] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job,int information,IntPtr data,uint length);
 [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 static IntPtr OwnJob() { var job=CreateJobObject(IntPtr.Zero,null);var data=Marshal.AllocHGlobal(144);for(int i=0;i<144;i++)Marshal.WriteByte(data,i,0);Marshal.WriteInt32(data,16,0x2000);if(job==IntPtr.Zero||!SetInformationJobObject(job,9,data,144)||!AssignProcessToJobObject(job,Process.GetCurrentProcess().Handle))throw new Exception("Test process ownership unavailable");Marshal.FreeHGlobal(data);return job; }
 static string Quote(string s) { var b=new StringBuilder("\\\""); int n=0; foreach(char c in s) { if(c=='\\\\') {n++;continue;} if(c=='"') {b.Append('\\\\',n*2+1);b.Append(c);n=0;continue;} b.Append('\\\\',n);n=0;b.Append(c); } b.Append('\\\\',n*2);b.Append('"');return b.ToString(); }
 static int Main(string[] args) { var job=OwnJob();var own=Process.GetCurrentProcess().MainModule.FileName; var a=new StringBuilder(Quote(own+".fixture.cjs")); foreach(var s in args) a.Append(" "+Quote(s)); var p=new Process(); p.StartInfo=new ProcessStartInfo(@"${node}",a.ToString()); p.StartInfo.UseShellExecute=false; p.Start();p.WaitForExit();GC.KeepAlive(job);return p.ExitCode; }
}`);
    const compiler = path.join(process.env.WINDIR || 'C:/Windows', 'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
    const result = cp.spawnSync(compiler, ['/nologo','/target:exe',`/out:${output}`,source], {encoding:'utf8', windowsHide:true});
    if (result.status !== 0) throw new Error(`Native fixture compiler unavailable: ${result.stderr || result.stdout || result.error}`);
    launcher = fs.readFileSync(output);
    return launcher;
  } finally { fs.rmSync(directory, {recursive:true, force:true}); }
}
function writeExecutableSync(file, contents, options) {
  if (process.platform !== 'win32') return fs.writeFileSync(file, contents, options);
  fs.writeFileSync(file + '.fixture.cjs', contents);
  fs.writeFileSync(file, launcherBytes());
}
async function writeExecutable(file, contents, options) { writeExecutableSync(file, contents, options); }
function executablePath(file) { return process.platform === 'win32' ? file + '.exe' : file; }
module.exports = {writeExecutableSync, writeExecutable, executablePath};
