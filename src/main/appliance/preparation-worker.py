#!/usr/bin/env python3
"""Build one explicitly admitted source revision without touching its checkout."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import tempfile
import time


def command(args, cwd=None, env=None):
    return subprocess.check_output(args, cwd=cwd, env=env, stderr=subprocess.PIPE, timeout=120).decode().strip()


def stop_owned_children():
    group=os.getpgrp()
    owned=[]
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit() or int(entry.name)==os.getpid():
            continue
        try:
            fields=(entry/'stat').read_text().rsplit(')',1)[1].split()
            if int(fields[2])==group and entry.stat().st_uid==os.getuid():
                owned.append((int(entry.name),fields[19]))
        except (OSError,ValueError,IndexError):
            continue
    for sig in (signal.SIGTERM,signal.SIGKILL):
        for pid,started in owned:
            try:
                fields=Path('/proc/%s/stat'%pid).read_text().rsplit(')',1)[1].split()
                if int(fields[2])==group and fields[19]==started:
                    os.kill(pid,sig)
            except (OSError,ValueError,IndexError):
                pass
        if sig==signal.SIGTERM:
            time.sleep(1)


def snapshot_source(source,revision,workspace,name,git,allow_links=False):
    archive=workspace/(name+'.tar')
    subprocess.run(git+['-C',str(source),'archive','--format=tar','--output',str(archive),revision],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    import tarfile
    snapshot=workspace/name
    snapshot.mkdir()
    with tarfile.open(archive) as stream:
        members=[]
        for member in stream.getmembers():
            if member.name.startswith('/') or '..' in Path(member.name).parts:
                raise ValueError('Unsupported source archive member')
            # Symbolic links are left out here; the checkout below restores them and the
            # recipe that allows them copies only regular files.
            if allow_links and member.issym():
                continue
            if not (member.isfile() or member.isdir()):
                raise ValueError('Unsupported source archive member')
            members.append(member)
        stream.extractall(snapshot,members=members,filter='data')
    # The owning build requires its real revision. Fetch only that exact local
    # commit into a fresh administrative directory; no original settings/hooks.
    subprocess.run(git+['init',str(snapshot)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    subprocess.run(git+['-C',str(snapshot),'-c','protocol.file.allow=always','fetch','--depth=1','--no-tags',str(source),revision],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    # The extracted files are that same revision, but Git can still refuse some of them as
    # untracked files it would overwrite. Forcing writes only the revision's own content;
    # the status check below proves the tree matches.
    subprocess.run(git+['-C',str(snapshot),'checkout','--force','--detach','FETCH_HEAD'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if command(git+['-C',str(snapshot),'status','--porcelain','--untracked-files=no']):
        raise ValueError('Snapshot is not the selected revision')
    return snapshot


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',required=True)
    parser.add_argument('--revision',required=True)
    parser.add_argument('--output',required=True)
    parser.add_argument('--operation',required=True)
    parser.add_argument('--adapter',choices=['job-2027-fork','job-2027-upstream','home-assistant-material'],default='job-2027-fork')
    parser.add_argument('--adapter-script')
    parser.add_argument('--frontend-source')
    parser.add_argument('--frontend-revision')
    args=parser.parse_args()
    if os.getuid()==0 or not re.fullmatch('[a-f0-9]{40}',args.revision) or not re.fullmatch('[a-f0-9-]{36}',args.operation):
        raise ValueError('Invalid source preparation authority')
    source=Path(args.source)
    output=Path(args.output)
    if not source.is_absolute() or not output.is_absolute() or output.is_symlink():
        raise ValueError('Absolute canonical source and output are required')
    if os.getpgrp()!=os.getpid():
        os.setsid()
    fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
    receipt={'pid':os.getpid(),'pgid':os.getpgrp(),'starttime':fields[19],'uid':os.getuid()}
    (output/'process.json').write_text(json.dumps(receipt))
    signal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    git=['git','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false']
    if command(git+['-C',str(source),'rev-parse','HEAD'])!=args.revision:
        raise ValueError('Source revision changed')
    print('APPLIANCE_PHASE:preparing',flush=True)
    workspace=Path(tempfile.mkdtemp(prefix='material-appliance-source-'))
    # One repository carrying Core and the frontend: the recipe reads both from this one snapshot.
    repository=args.adapter=='home-assistant-material' and not args.frontend_source and args.frontend_revision==args.revision
    snapshot=snapshot_source(source,args.revision,workspace,'source',git,allow_links=repository)
    if args.adapter!='job-2027-fork':
        frontend_snapshot=None
        if args.adapter=='home-assistant-material' and not repository:
            if not args.frontend_source or not re.fullmatch('[a-f0-9]{40}',args.frontend_revision or ''):
                raise ValueError('Paired frontend source required')
            frontend=Path(args.frontend_source)
            if not frontend.is_absolute() or command(git+['-C',str(frontend),'rev-parse','HEAD'])!=args.frontend_revision:
                raise ValueError('Frontend source changed')
            frontend_snapshot=snapshot_source(frontend,args.frontend_revision,workspace,'frontend',git)
        from recipe_worker import build_recipe
        build_recipe(args,snapshot,frontend_snapshot,workspace,output,stop_owned_children)
        return
    legacy_tag='job-2027-hosted:local-amd64'
    try:
        prior=command(['docker','image','inspect','--format','{{.Id}}',legacy_tag])
    except subprocess.CalledProcessError:
        prior=None
    database_prior=None
    postgres=None
    try:
        print('APPLIANCE_PHASE:building',flush=True)
        with (workspace/'source-build.log').open('wb') as log:
            try:
                subprocess.run(['bash','build.bat','--platform','linux/amd64','--silent'],cwd=snapshot,check=True,stdout=log,stderr=subprocess.STDOUT,timeout=3300)
            except (subprocess.TimeoutExpired,KeyboardInterrupt):
                stop_owned_children()
                raise
        built=json.loads((snapshot/'.hosting/build-receipt-linux-amd64.json').read_text())
        if built.get('sourceRevision')!=args.revision or built.get('dirty') is not False or built.get('platform')!='linux/amd64' or not re.fullmatch('sha256:[a-f0-9]{64}',built.get('imageId','')):
            raise ValueError('Source build receipt does not match the admitted revision')
        image_id=built['imageId']
        actual=json.loads(command(['docker','image','inspect',image_id]))[0]
        if actual.get('Id')!=image_id or actual.get('Os')!='linux' or actual.get('Architecture')!='amd64' or actual.get('Config',{}).get('Labels',{}).get('org.opencontainers.image.revision')!=args.revision:
            raise ValueError('Built image provenance mismatch')
        image='material-buildroot/prepared:'+args.operation
        subprocess.run(['docker','tag',image_id,image],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        print('APPLIANCE_PHASE:packaging',flush=True)
        environment={key:os.environ[key] for key in ('PATH','HOME','LANG','USER') if key in os.environ}
        environment.update({'JOB_APP_IMAGE':image,'JOB_SOURCE_REVISION':args.revision,'JOB_BIND_ADDRESS':'0.0.0.0','JOB_FRESH_SETUP':'true'})
        compose=json.loads(command(['docker','compose','-f',str(snapshot/'compose.yaml'),'config','--format','json'],cwd=snapshot,env=environment))
        if set(compose.get('services',{}))!={'cli-provider','initialize','postgres','web','worker'}:
            raise ValueError('The selected source requires a different workload adapter')
        compose['name']='material-workload'
        for name,service in compose['services'].items():
            service.pop('build',None)
            service.pop('env_file',None)
            service.pop('secrets',None)
            service['pull_policy']='never'
            if name!='postgres':
                service['image']=image
            volumes=[]
            for volume in service.get('volumes',[]):
                if volume.get('type')=='bind':
                    if Path(volume.get('source',''))!=snapshot/'.hosting':
                        raise ValueError('Unexpected source bind mount')
                    continue
                volumes.append(volume)
            service['volumes']=volumes
            if name=='worker':
                service['profiles']=['worker-opt-in']
            if any('seccomp=' in entry for entry in service.get('security_opt',[])):
                service['security_opt']=[entry if 'seccomp=' not in entry else 'seccomp=./backend/docker/chromium-seccomp.json' for entry in service['security_opt']]
        for volume in compose.get('volumes',{}).values():
            volume.pop('name',None)
        postgres=compose['services']['postgres']['image']
        if postgres!='postgres:18-bookworm':
            raise ValueError('The database image requires an updated adapter')
        try:
            database_prior=command(['docker','image','inspect','--format','{{.Id}}',postgres])
        except subprocess.CalledProcessError:
            database_prior=None
        subprocess.run(['docker','pull','--platform','linux/amd64',postgres],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=600)
        database=json.loads(command(['docker','image','inspect',postgres]))[0]
        if database.get('Os')!='linux' or database.get('Architecture')!='amd64':
            raise ValueError('Database image platform mismatch')
        bundle=output/'workload'
        (bundle/'backend/docker').mkdir(parents=True)
        import shutil
        shutil.copyfile(snapshot/'backend/docker/chromium-seccomp.json',bundle/'backend/docker/chromium-seccomp.json')
        (bundle/'compose.yaml').write_text(json.dumps(compose))
        target=output/'prepared-image.tar'
        with target.open('xb') as stream:
            subprocess.run(['docker','save',image,postgres],check=True,stdout=stream,stderr=subprocess.DEVNULL,timeout=600)
        with target.open('rb') as stream:
            digest=hashlib.file_digest(stream,'sha256').hexdigest()
        (output/'prepared-manifest.json').write_text(json.dumps({'schemaVersion':1,'sourceRevision':args.revision,'imageId':image_id,'image':image,'archive':{'name':target.name,'size':target.stat().st_size,'sha256':digest},'completeWorkload':True,'requiresOwnerSetup':True,'endpoints':json.loads(Path(__file__).with_name('workload-endpoints.json').read_text())['job-2027-fork'],'bundleFiles':[{'path':str(item.relative_to(bundle)),'size':item.stat().st_size,'sha256':hashlib.file_digest(item.open('rb'),'sha256').hexdigest()} for item in sorted(bundle.rglob('*')) if item.is_file()],'databaseImageId':database['Id'],'limitations':['OWNER_SETUP_REQUIRED','WORKER_OPT_IN_REQUIRED','RUNTIME_NOT_YET_VERIFIED']}))
        print('APPLIANCE_PHASE:complete',flush=True)
    finally:
        if database_prior and postgres:
            subprocess.run(['docker','tag',database_prior,postgres],check=False,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if prior:
            subprocess.run(['docker','tag',prior,legacy_tag],check=False,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)


if __name__=='__main__':
    try:
        main()
    except (ValueError,OSError,subprocess.SubprocessError,KeyboardInterrupt):
        print('Source preparation incomplete; original source and workloads were preserved.',flush=True)
        raise SystemExit(1)
