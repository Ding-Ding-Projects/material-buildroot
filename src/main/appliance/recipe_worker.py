"""Execute fixed reviewed source recipes and bind their offline bundle outputs."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess


def build_recipe(args, snapshot, frontend_snapshot, workspace, output, stop_children):
    script=Path(args.adapter_script)
    if not script.is_absolute() or script.is_symlink() or script.name!='recipes.py':
        raise ValueError('Trusted adapter recipe unavailable')
    spec=importlib.util.spec_from_file_location('appliance_recipe',script)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    recipe_root=workspace/'recipe'
    recipe=module.materialize(args.adapter,snapshot,recipe_root,args.operation,args.revision,
                              frontend_snapshot=frontend_snapshot,frontend_revision=args.frontend_revision)
    if recipe.get('entrypoint')!=['bash','build.bat']:
        raise ValueError('Adapter entrypoint mismatch')
    prior_database=None
    if 'postgres:18-bookworm' in recipe['images']:
        try:
            prior_database=subprocess.check_output(['docker','image','inspect','--format','{{.Id}}','postgres:18-bookworm'],stderr=subprocess.PIPE,timeout=30).decode().strip()
        except subprocess.CalledProcessError:
            pass
    try:
        print('APPLIANCE_PHASE:building',flush=True)
        with (workspace/'source-build.log').open('wb') as log:
            try:
                subprocess.run(['bash','build.bat'],cwd=recipe_root,check=True,stdout=log,stderr=subprocess.STDOUT,timeout=3300)
            except (subprocess.TimeoutExpired,KeyboardInterrupt):
                stop_children()
                raise
        inventory=[]
        for reference in recipe['images']:
            if not re.fullmatch(r'[a-z0-9][a-z0-9._:/-]{0,254}',reference):
                raise ValueError('Invalid fixed recipe image')
            result=subprocess.check_output(['docker','image','inspect',reference],stderr=subprocess.PIPE,timeout=30)
            image=json.loads(result)[0]
            if image.get('Os')!='linux' or image.get('Architecture')!='amd64' or not re.fullmatch('sha256:[a-f0-9]{64}',image.get('Id','')):
                raise ValueError('Built adapter image platform unavailable')
            if reference!='postgres:18-bookworm':
                labels=image.get('Config',{}).get('Labels',{})
                if labels.get('org.opencontainers.image.revision')!=args.revision:
                    raise ValueError('Built adapter image source mismatch')
                if args.adapter=='home-assistant-material' and labels.get('org.material-buildroot.frontend-revision')!=args.frontend_revision:
                    raise ValueError('Built custom frontend source mismatch')
            inventory.append({'reference':reference,'id':image['Id']})
        bundle=output/'workload'
        bundle.mkdir(mode=0o700)
        (bundle/'compose.yaml').write_text(json.dumps(recipe['compose']))
        shutil.copyfile(recipe_root/'source-receipt.json',bundle/'source-receipt.json')
        print('APPLIANCE_PHASE:packaging',flush=True)
        archive=output/'prepared-image.tar'
        with archive.open('xb') as stream:
            subprocess.run(['docker','save',*recipe['images']],check=True,stdout=stream,stderr=subprocess.DEVNULL,timeout=600)
        with archive.open('rb') as stream:
            archive_hash=hashlib.file_digest(stream,'sha256').hexdigest()
        files=[]
        for name in ['compose.yaml','source-receipt.json']:
            file=bundle/name
            with file.open('rb') as stream:
                digest=hashlib.file_digest(stream,'sha256').hexdigest()
            files.append({'path':name,'size':file.stat().st_size,'sha256':digest})
        manifest={'schemaVersion':1,'adapter':args.adapter,'sourceRevision':args.revision,
                  'image':inventory[0]['reference'],'imageId':inventory[0]['id'],'images':inventory,
                  'archive':{'name':archive.name,'size':archive.stat().st_size,'sha256':archive_hash},
                  'bundleFiles':files,'completeWorkload':True,'requiresOwnerSetup':True,
                  'endpoints':json.loads(Path(__file__).with_name('workload-endpoints.json').read_text())[args.adapter],
                  'runtimeSetup':recipe.get('runtimeSetup',{}),'limitations':recipe.get('limitations',[]),
                  'runtimeVerified':False}
        if args.frontend_revision:
            manifest['frontendRevision']=args.frontend_revision
        (output/'prepared-manifest.json').write_text(json.dumps(manifest))
        print('APPLIANCE_PHASE:complete',flush=True)
    finally:
        if prior_database:
            subprocess.run(['docker','tag',prior_database,'postgres:18-bookworm'],check=False,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)
