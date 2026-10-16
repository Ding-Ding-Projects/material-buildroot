"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { admitWslProject, metadataPaths, linuxSelection } = require("./wsl-project.cjs");
const DISTRO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const PACKAGES = ["build-essential", "bash", "binutils", "bzip2", "cpio", "file", "findutils", "gawk", "git", "gzip", "libncurses-dev", "patch", "perl", "python3", "rsync", "sed", "tar", "unzip", "wget", "which", "xz-utils"];
const PROBE = `set -eu
 test "$(id -u)" -ne 0 || { echo non-root-required; exit 77; }
 printf 'USER=%s\\nHOME=%s\\n' "$(id -un)" "$HOME"
 case "$HOME" in /home/*) ;; *) exit 78 ;; esac
 test -d "$HOME" && test -w "$HOME" || exit 78
 test "$(readlink -f -- "$HOME")" = "$HOME" || exit 78
 case "$(stat -f -c %T -- "$HOME")" in ext2/ext3|btrfs|xfs) ;; *) exit 78 ;; esac
 for tool in bash gcc g++ make patch perl tar cpio unzip rsync file wget python3 git bzip2 xz; do
 if command -v "$tool" >/dev/null 2>&1; then printf 'OK=%s\\n' "$tool"; else printf 'MISSING=%s\\n' "$tool"; fi
 done
 if test -r /etc/os-release; then . /etc/os-release; printf 'OS=%s\\n' "$ID"; fi
 df -Pk "$HOME" | awk 'NR==2 {printf "FREE=%s\\n", $4}'`;
function createWslRuntime({ directory, run, dialog, parentWindow, openPath, platform = process.platform }) {
  const recordsFile = path.join(directory, "wsl-managed.json");
  let busy = false;
  let records = [];
  if (fs.existsSync(recordsFile)) {
    const value = JSON.parse(fs.readFileSync(recordsFile, "utf8"));
    if (!Array.isArray(value) || value.some(x => !DISTRO.test(x.name) || !path.isAbsolute(x.location))) throw Error("invalid-wsl-records");
    records = value;
  }
  const save = () => { const temporary = `${recordsFile}.tmp`; fs.writeFileSync(temporary, JSON.stringify(records), {mode:0o600}); fs.renameSync(temporary, recordsFile); };
  const execute = (args, timeoutMs = 15000) => run(args, { timeoutMs, maxBytes: 65536 });
  const text = value => String(value || "").replace(/\0/g, "");
  async function discover() {
    if (platform !== "win32") return {state:"unsupported-platform", distributions:[]};
    const result = await execute(["--list", "--verbose"]);
    const distributions = text(result.stdout).split(/\r?\n/).flatMap(line => {
      const match = line.trim().match(/^\*?\s*([A-Za-z0-9][A-Za-z0-9._-]{0,79})\s+\S+\s+([12])\s*$/);
      return match ? [{name:match[1],version:Number(match[2]),managed:records.some(x=>x.name===match[1]), recovery:records.find(x=>x.name===match[1])?.state || null}] : [];
    });
    return {state:result.state, distributions};
  }
  async function selected(name) {
    if (!DISTRO.test(name || "")) throw Error("invalid-wsl-distribution");
    const snapshot = await discover();
    const entry = snapshot.distributions.find(x=>x.name===name);
    if (!entry || entry.version !== 2) throw Error("wsl2-distribution-required");
    return entry;
  }
  const linux = (name, script, args=[], root=false, timeout=15000) => execute(["--distribution",name,...(root?["--user","root"]:[]),"--exec","/bin/sh","-c",script,"material-buildroot",...args],timeout);
  async function inspect(name) {
    await selected(name);
    const result = await linux(name, PROBE);
    const lines = text(result.stdout).split(/\r?\n/);
    const field = key => lines.find(x=>x.startsWith(key+"="))?.slice(key.length+1) || null;
    const home = field("HOME");
    const validHome = typeof home === "string" && /^\/home\/[A-Za-z0-9_.-]+$/.test(home);
    const missing = lines.filter(x=>x.startsWith("MISSING=")).map(x=>x.slice(8));
    return {state:result.state==="succeeded" && validHome ? (missing.length?"prerequisites-missing":"ready") : "account-setup-required",distribution:name,missing,os:field("OS"),home:validHome?home:null,freeKiB:field("FREE"),storage:validHome?`${home}/material-buildroot`:null};
  }
  async function consent(message) {
    const choice = await dialog.showMessageBox(parentWindow,{type:"warning",buttons:["Cancel / 取消","Continue / 繼續"],defaultId:0,cancelId:0,title:"WSL setup / WSL 設定",message});
    return choice.response===1;
  }
  async function perform(kind, name) {
    if (platform !== "win32") throw Error("unsupported-platform");
    if (busy) throw Error("wsl-operation-busy");
    busy=true;
    try {
      if (kind==="discover") return await discover();
      if (kind==="inspect") return await inspect(name);
      if (kind==="import" || kind==="install") {
        if (!await consent(kind === "install" ? "Download the pinned official Ubuntu 24.04.3 WSL image and verify its SHA-256 before importing a new dedicated WSL 2 distribution? Network access and additional storage are required. Existing distributions are preserved.\\n下載已鎖定嘅官方 Ubuntu 24.04.3 WSL 映像，核對 SHA-256 後匯入獨立 WSL 2 發行版；需要網絡同額外空間，現有發行版保留不變。" : "Import a trusted Linux root filesystem into a new dedicated WSL 2 distribution. Existing distributions are preserved. The archive must be Debian or Ubuntu compatible.\\n匯入可信 Linux 根檔案系統到獨立 WSL 2 發行版，現有發行版會保留。封存必須相容 Debian 或 Ubuntu。")) return {state:"cancelled"};
        let archive;
        if(kind==="install") archive=await acquireOfficial();
        else {
          const choice=await dialog.showOpenDialog(parentWindow,{title:"Trusted Linux root filesystem / 可信 Linux 根檔案系統",properties:["openFile","dontAddToRecent"],filters:[{name:"Root filesystem",extensions:["tar","wsl"]}]});
          if(choice.canceled || choice.filePaths.length!==1)return {state:"cancelled"};
          archive=fs.realpathSync(choice.filePaths[0]);
          if(!fs.statSync(archive).isFile() || ![".tar",".wsl"].includes(path.extname(archive).toLowerCase()))throw Error("invalid-root-filesystem");
        }        const identity=crypto.randomUUID();
        const distribution=`MaterialBuildroot-${identity}`;
        const location=path.join(directory,"wsl",identity);
        fs.mkdirSync(location,{recursive:true});
        const record={name:distribution,location,state:"import-pending"};records.push(record);save();
        const imported=await execute(["--import",distribution,location,archive,"--version","2"],30*60*1000);
        record.state=imported.state==="succeeded"?"account-setup-required":"import-incomplete";save();
        if(imported.state!=="succeeded")return {state:record.state,distribution};
        // Only the newly owned distribution receives account initialization.
        const initialized=await linux(distribution,'set -eu; test "$(id -u)" -eq 0; command -v useradd >/dev/null; if ! id materialbuilder >/dev/null 2>&1; then useradd --create-home --shell /bin/bash materialbuilder; fi; test "$(id -u materialbuilder)" -ne 0',[],true);
        if(initialized.state!=="succeeded")return {state:record.state,distribution};
        const configured=await execute(["--manage",distribution,"--set-default-user","materialbuilder"]);
        if(configured.state!=="succeeded")return {state:record.state,distribution};
        const status=await inspect(distribution);record.state=status.state;save();return status;
      }
      const status=await inspect(name);
      if(kind==="cloneSource") {
        if(status.state!=="ready" || !status.storage)return status;
        if(!await consent(`Download the official Buildroot source into the empty Linux source folder in ${name}? No existing source is replaced. This trusts the official source for later builds.\n下載官方 Buildroot 來源到空白 Linux 來源目錄，唔會取代現有來源。此操作信任官方來源用作日後建置。`))return {state:"cancelled"};
        const result=await linux(name,'set -eu; test "$(id -u)" -ne 0; test "$(readlink -f -- "$1")" = "$1"; test -d "$1/source"; test ! -L "$1/source"; test -z "$(find "$1/source" -mindepth 1 -maxdepth 1 -print -quit)"; exec git -c core.hooksPath=/dev/null -c protocol.file.allow=never clone --depth 1 -- https://gitlab.com/buildroot.org/buildroot.git "$1/source"',[status.storage],false,30*60*1000);
        return {state:result.state==="succeeded"?"source-ready":"source-download-incomplete",distribution:name};
      }
      if(kind==="prerequisites") {
        if(!["debian","ubuntu"].includes(status.os) || status.state==="account-setup-required")return {state:"manual-prerequisites-required"};
        if(!await consent(`Install Buildroot prerequisites in ${name} using the distribution package manager as root. Builds still run as the default non-root account. Downloads require network access.\n會以 root 安裝建置所需套件，建置仍使用非 root 帳戶；下載需要網絡。`))return {state:"cancelled"};
        const installed=await linux(name,'set -eu; test "$(id -u)" -eq 0; export DEBIAN_FRONTEND=noninteractive; apt-get update; apt-get install -y -- "$@"',PACKAGES,true,30*60*1000);
        return installed.state==="succeeded"?await inspect(name):{state:"prerequisite-install-incomplete",distribution:name};
      }
      if(!status.storage) return status;
      if(kind==="storage") {
        if(!await consent(`Create source, output and downloads directories under ${status.storage} in ${name}? Existing files are preserved.\n建立來源、輸出同下載目錄，保留現有檔案。`))return {state:"cancelled"};
        const prepared=await linux(name,'set -eu; test "$(id -u)" -ne 0; test ! -L "$1"; for entry in "$1" "$1/source" "$1/output" "$1/downloads"; do test ! -L "$entry"; mkdir -p -- "$entry"; test -w "$entry"; done',[status.storage]);
        return {state:prepared.state==="succeeded"?"storage-ready":"storage-incomplete",distribution:name,storage:status.storage};
      }
      if(kind==="browse") {
        const verified = await linux(name, 'set -eu; test "$(id -u)" -ne 0; test -d "$1"; test "$(readlink -f -- "$1")" = "$1"; test "$(readlink -f -- "$HOME")" = "$HOME"; case "$1" in "$HOME"/material-buildroot) ;; *) exit 78 ;; esac', [status.storage]);
        if (verified.state !== "succeeded") return {state:"storage-verification-required"};
        if(typeof openPath!=="function")throw Error("native-browser-unavailable");
        const result=await openPath(`\\\\wsl.localhost\\${name}${status.storage.replaceAll("/","\\")}`);
        return {state:result?"browse-incomplete":"opened"};
      }
      if(kind==="export") {
        if(!await consent(`Export the complete ${name} filesystem to a new native folder. The backup may contain private data and credentials. Active writes can make a backup inconsistent; stop your workloads first. No distribution is stopped or removed.\n匯出完整檔案系統可能包含私人資料，請先停止自己嘅工作；此操作唔會停止或移除發行版。`))return {state:"cancelled"};
        const chosen=await dialog.showOpenDialog(parentWindow,{title:"Choose backup parent folder / 選擇備份上層目錄",properties:["openDirectory","dontAddToRecent"]});
        if(chosen.canceled || chosen.filePaths.length!==1)return {state:"cancelled"};
        const target=path.join(fs.realpathSync(chosen.filePaths[0]),`MaterialBuildroot-backup-${crypto.randomUUID()}`);
        fs.mkdirSync(target,{recursive:false});
        const destination=path.join(target,"distribution.tar");
        const result=await execute(["--export",name,destination],60*60*1000);
        return {state:result.state==="succeeded" && fs.existsSync(destination) && fs.statSync(destination).size>0?"exported":"export-incomplete",destination};
      }
      throw Error("invalid-wsl-action");
    } finally {busy=false;}
  }
  async function acquireOfficial() {
    const sha256="c74833a55e525b1e99e1541509c566bb3e32bdb53bf27ea3347174364a57f47c";
    const cache=path.join(directory,"wsl-downloads");fs.mkdirSync(cache,{recursive:true});
    const destination=path.join(cache,`${sha256}.wsl`);
    async function digest(file){const hash=crypto.createHash("sha256");for await(const chunk of fs.createReadStream(file))hash.update(chunk);return hash.digest("hex");}
    if(fs.existsSync(destination)){if(await digest(destination)===sha256)return destination;throw Error("official-image-cache-mismatch");}
    const partial=path.join(cache,`${crypto.randomUUID()}.partial`);
    const response=await fetch("https://releases.ubuntu.com/24.04.3/ubuntu-24.04.3-wsl-amd64.wsl",{redirect:"error",signal:AbortSignal.timeout(30*60*1000)});
    if(!response.ok || !response.body)throw Error("official-image-unavailable");
    let bytes=0;const hash=crypto.createHash("sha256");const handle=await fs.promises.open(partial,"wx",0o600);
    try {for await(const chunk of response.body){bytes+=chunk.length;if(bytes>2*1024**3)throw Error("official-image-too-large");hash.update(chunk);await handle.writeFile(chunk);}await handle.sync();}finally{await handle.close();}
    if(bytes===0 || hash.digest("hex")!==sha256)throw Error("official-image-integrity-failed");
    fs.renameSync(partial,destination);return destination;
  }
  async function chooseProject(name) {
    if(busy)throw Error("wsl-operation-busy");busy=true;
    try {
      const status=await inspect(name);if(!status.storage)throw Error("wsl-storage-unavailable");
      const storage={kind:"wsl",distribution:name,rootLinux:status.storage,sourceLinux:`${status.storage}/source`,outputLinux:`${status.storage}/output`};
      const defaults=metadataPaths(storage);
      const pick=async(title,defaultPath)=>{const choice=await dialog.showOpenDialog(parentWindow,{title,defaultPath,properties:["openDirectory","dontAddToRecent"]});return choice.canceled||choice.filePaths.length!==1?null:choice.filePaths[0];};
      const source=await pick("Select trusted Buildroot source within the Linux workspace / 選擇 Linux 工作區內可信 Buildroot 來源",defaults.source);if(!source)return null;
      const output=await pick("Select separate Linux build output / 選擇獨立 Linux 建置輸出",defaults.output);if(!output)return null;
      storage.sourceLinux=linuxSelection(source,storage);storage.outputLinux=linuxSelection(output,storage);
      if(!await consent(`Adopt ${name}: ${storage.sourceLinux} with output ${storage.outputLinux}? Buildroot source executes code with the non-root distribution account's access. Existing files are preserved.\n接入所選來源同輸出？來源會以非 root 發行版帳戶權限執行程式碼，現有檔案會保留。`))return null;
      const receipt=await admitWslProject(storage,args=>execute(args));
      return {...receipt.paths,storage:receipt.storage,receipt,name:`${name}: ${path.posix.basename(storage.sourceLinux)}`.slice(0,80)};
    } finally {busy=false;}
  }
  return {perform,chooseProject};
}
module.exports={createWslRuntime};




