import type {OperationRequest, StudioAPI} from '../src/shared/api';
declare const identity: Pick<OperationRequest,'version'|'operationId'|'projectId'|'expectedRevision'|'capability'>;
declare const api: StudioAPI;
api.request({...identity,action:'settings.setLanguage',arguments:{language:'bilingual'}});
api.request({...identity,action:'jobs.cancel',arguments:{jobId:'owned-job-0000010',expectedSequence:1}});
// @ts-expect-error Arbitrary dispatcher strings are not part of the bridge contract.
api.request({...identity,action:'shell.exec',arguments:{command:'echo example'}});
// @ts-expect-error Action arguments cannot be borrowed from another action.
api.request({...identity,action:'settings.setLanguage',arguments:{jobId:'owned-job-0000010',expectedSequence:1}});
// @ts-expect-error Request fields are mandatory.
api.request({action:'settings.setLanguage',arguments:{language:'en'}});
