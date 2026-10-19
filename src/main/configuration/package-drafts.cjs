"use strict";
const path=require("node:path");
const {randomUUID,createHash}=require("node:crypto");
const {createWorkspaceStore}=require("../storage/workspace-store.cjs");
const {packageDraft}=require("../security/package-draft-contract.cjs");
const fail=code=>{throw Object.assign(new Error(code),{code});};
/** Drafts use the same atomic store and append-only revision journal as workspace data. */
function createPackageDrafts({directory,resolveIdentity}){
  function storeFor(request){
    const identity=resolveIdentity(request.workspaceId,request.externalTreeId);
    const key=createHash("sha256").update(JSON.stringify(identity)).digest("hex");
    return createWorkspaceStore({filePath:path.join(directory,key+".json")});
  }
  function revision(value){if(!Number.isSafeInteger(value)||value<0)fail("INVALID_REQUEST");}
  return {
    history(request){
      const store=storeFor(request),state=store.read();
      let records=[],historyWarning=false;
      if(state.packageDraft){
        try{records=store.revisions(undefined,25).records.filter(record=>record.revision>0);}catch{historyWarning=true;}
        if(!records.some(record=>record.revision===state.revision))records.unshift({revision:state.revision,timestamp:state.activity.at(-1)?.timestamp||null});
      }
      return {revision:state.revision,records:records.slice(0,25),hasDraft:!!state.packageDraft,historyWarning};
    },
    save(request){
      revision(request.expectedRevision);packageDraft(request.draft);
      const store=storeFor(request);
      const state=store.transact(request.expectedRevision,current=>{
        current.packageDraft=structuredClone(request.draft);
        current.activity.push({id:randomUUID(),action:"package.draft.save",timestamp:new Date().toISOString(),revision:current.revision+1});
        current.activity=current.activity.slice(-100);
        return current;
      });
      return {revision:state.revision,historyWarning:state.historyWarning===true};
    },
    restore(request){
      revision(request.expectedRevision);revision(request.revision);
      const store=storeFor(request),current=store.read();
      if(current.revision!==request.expectedRevision)fail("REVISION_CONFLICT");
      const selected=request.revision===current.revision?current:store.readRevision(request.revision);
      if(!selected.packageDraft)fail("NOT_FOUND");
      packageDraft(selected.packageDraft);
      return {revision:current.revision,restoredRevision:request.revision,draft:structuredClone(selected.packageDraft)};
    }
  };
}
module.exports={createPackageDrafts};
