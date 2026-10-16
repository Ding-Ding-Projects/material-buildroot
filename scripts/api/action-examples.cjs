'use strict';
// Documentation examples only. Returned IDs must come from this session's actual earlier replies.
const keys={
 'projects.choose':'','projects.adopt':'selectionId',
 'config.trust.preview':'workspaceId domain','config.trust.grant':'workspaceId challengeId',
 'runtimes.list':'','runtimes.configure':'workspaceId choiceId uid gid','runtimes.prepare':'workspaceId',
 'runtimes.wsl.project':'choiceId',
 'product.inspect':'sourceRepository executionRepository mode','product.runners':'selectionId',
 'product.selectRunner':'selectionId kind runnerId','product.preview':'selectionId sourceRevision target',
 'product.publish':'previewId','product.export':'previewId',
 'remote.list':'','remote.enroll':'','remote.reconnect':'targetId','remote.transfer':'workspaceId targetId',
 'remote.start':'targetId transferId target parallelism','remote.adopt':'id','remote.observe':'id',
 'remote.cancel':'id','remote.outputs':'id','remote.download':'id name sha256',
 'config.details':'workspaceId domain revision symbol',
 'config.inspect':'workspaceId domain offset query',
 'config.apply':'workspaceId domain revision symbol change',
 'config.undo':'workspaceId domain revision',
 'defconfig.apply':'workspaceId revision id',
 'cloud.retry':'workspaceId id','cloud.cancel':'workspaceId id','cloud.start':'workspaceId id',
 'cloud.list':'workspaceId','cloud.preview':'workspaceId fileId destinationId',
 'models.chat.start':'model prompt','models.chat.read':'id offset','models.chat.cancel':'id',
 'conversion.queue':'sourceId destinationId category format',
 'pdf.queue':'sourceIds destinationId operation pages degrees',
 'tools.queue.page':'after','tools.queue.history':'after','tools.queue.get':'id','tools.queue.cancel':'id sequence',
 'conversion.choose':'access','conversion.catalog':'','conversion.run':'sourceId destinationId category format',
 'servers.remote.preview':'directoryId edition version flavour target host destination',
 'servers.remote.execute':'previewId','servers.remote.status':'previewId',
 'servers.paper.builds':'version','servers.fabric.options':'version',
 'servers.paper.install':'directoryId version build','servers.fabric.install':'directoryId version loader installer',
 'servers.plugin.install':'directoryId versionId gameVersion loader',
 'servers.versions':'edition offset query','servers.flavours':'flavour','servers.plugins':'projectId',
 'servers.choose':'','servers.configuration.read':'directoryId edition',
 'servers.configuration.save':'directoryId edition properties','servers.install':'directoryId edition version',
 'servers.start':'directoryId serverId edition version flavour target memoryMiB port image host remoteDirectory',
 'servers.list':'','servers.status':'serverId','servers.stop':'serverId',
 'models.catalogue.page':'query offset','models.catalogue.refresh':'','models.pull':'model',
 'models.managed.status':'','models.install':'','models.runtime.start':'','models.runtime.stop':'',
 'models.status':'','models.list':'','workspace.read':'','projects.list':'','jobs.owned':'','jobs.list':'',
 'jobs.get':'jobId','jobs.cancel':'jobId expectedSequence',
 'source.rollback.preview':'workspaceId rollbackId','source.rollback.apply':'workspaceId previewId',
 'source.upgrade.preview':'workspaceId revision','source.upgrade.apply':'workspaceId previewId',
 'source.choose':'','source.clone.official':'selectionId directory ref','source.status':'workspaceId',
 'project.options':'workspaceId','defconfig.catalog':'workspaceId','builds.submit':'workspaceId target jobs',
 'build.targets':'workspaceId','packages.list':'workspaceId query offset',
 'packages.files':'workspaceId packageId','packages.editors':'workspaceId',
 'packages.editor.open':'workspaceId fileId editorId',
 'guests.discover':'workspaceId','guests.list':'workspaceId','guests.refresh':'workspaceId id',
 'guests.launch':'workspaceId id expectedRevision','guests.stop':'workspaceId id expectedRevision',
 'guests.create':'workspaceId fileId provider kind hardware',
 'guests.disk.create':'workspaceId outputName format capacityMiB',
 'sdk.preview':'workspaceId fileId','sdk.export':'workspaceId id',
 'outputs.manifest':'workspaceId fileIds','outputs.browse':'workspaceId directoryId',
 'outputs.inspect':'workspaceId fileId','outputs.checksum':'workspaceId fileId expected'
};
const defaults={
 challengeId:'{{challengeId}}',choiceId:'{{choiceId}}',uid:1000,gid:1000,
 sourceRepository:'{{sourceRepository}}',executionRepository:'{{executionRepository}}',mode:'source',
 runnerId:null,sourceRevision:'{{sourceRevision}}',targetId:'{{targetId}}',transferId:'{{transferId}}',
 parallelism:1,name:'{{remoteOutputName}}',sha256:'{{outputSha256}}',
 workspaceId:'{{workspaceId}}',domain:'buildroot',revision:'{{configRevision}}',symbol:'BR2_SHARED_LIBS',
 offset:0,query:'',change:{type:'bool',value:true},id:'{{recordId}}',fileId:'{{fileId}}',
 destinationId:'{{destinationId}}',sourceId:'{{sourceId}}',sourceIds:['{{sourceId}}'],
 model:'{{modelName}}',prompt:'Explain this build configuration without changing it.',
 category:'images',format:'png',operation:'inspect',pages:[],degrees:0,after:'',sequence:1,
 access:'read',directoryId:'{{directoryId}}',edition:'java',version:'{{serverVersion}}',flavour:'paper',
 target:'all',host:'{{sshHost}}',destination:'{{remoteDirectory}}',previewId:'{{previewId}}',
 build:1,loader:'{{loaderVersion}}',installer:'{{installerVersion}}',versionId:'{{pluginVersionId}}',
 gameVersion:'{{serverVersion}}',projectId:'{{pluginProjectId}}',serverId:'{{serverId}}',
 memoryMiB:1024,port:25565,image:'',remoteDirectory:'',jobId:'{{jobId}}',expectedSequence:0,
 rollbackId:'{{rollbackId}}',selectionId:'{{selectionId}}',directory:'buildroot-source',ref:'{{sourceRef}}',
 jobs:1,packageId:'{{packageId}}',editorId:'{{editorId}}',expectedRevision:0,provider:'virtualbox',kind:'disk',
 hardware:{memoryMiB:1024,cpus:1,firmware:'bios',network:'none'},outputName:'disk.vdi',capacityMiB:1024,
 fileIds:['{{fileId}}'],expected:'',
 properties:{'server-port':25565,'max-players':20,difficulty:'normal',gamemode:'survival','online-mode':true,'white-list':false,motd:'Private build workspace','level-name':'world'}
};
function example(action){
 if(!Object.hasOwn(keys,action))throw new Error(`No authored API example for ${action}. Update the collection definition before publishing.`);
 const args=Object.fromEntries(keys[action].split(' ').filter(Boolean).map(key=>[key,defaults[key]]));
 if(action==='defconfig.apply')args.id='{{defconfigId}}';
 if(action==='source.upgrade.preview')args.revision='{{sourceRevision}}';
 if(action==='pdf.queue')args.destinationId='';
 if(action==='servers.remote.preview')args.target='ssh-process';
 if(action==='servers.start'){args.target='local-process';args.host='';}
 if(action==='servers.flavours')args.flavour='paper';
 if(action==='guests.disk.create')args.format='vdi';
 if(action==='product.selectRunner')args.kind='hosted';
 if(action==='product.preview')args.target='build';
 if(action==='outputs.browse')args.directoryId='root';
 return args;
}
module.exports={example};
