import type {CoreReply,CoreStoredEvent,LanguageOperationReply,BrokerContract} from '../src/shared/broker-core';
import type {OperationEvent} from '../src/shared/api';
import {toOperationReply,toOperationEvent} from '../src/main/security/broker-contract.cjs';
const seam:BrokerContract={toOperationReply,toOperationEvent};
const reply:LanguageOperationReply=seam.toOperationReply({code:'OK',language:'en',revision:'a'.repeat(40),eventSequence:1},'12345678-1234-4234-8234-123456789abc');
const event:OperationEvent=seam.toOperationEvent({sequence:1,operationId:'12345678-1234-4234-8234-123456789abc',kind:'settings.languageChanged',revision:'a'.repeat(40),timestamp:'2026-10-14T12:00:00.000Z'});
// @ts-expect-error Internal result codes are a closed union.
const invalid:CoreReply={code:'ARBITRARY'};
// @ts-expect-error Persisted events require transaction timestamps.
const missing:CoreStoredEvent={sequence:1,operationId:'id',kind:'settings.languageChanged',revision:'revision'};
// @ts-expect-error Public replies cannot be used as internal replies.
seam.toOperationReply({ok:true,operationId:'id',revision:'a',result:{}},'id');
void reply;void event;void invalid;void missing;

import {createBroker} from '../src/main/broker.cjs';
import type {BrokerCore,CapabilityAuthority,CoreSettingsStore} from '../src/shared/broker-core';
declare const authority:CapabilityAuthority;declare const store:CoreSettingsStore;
const broker:BrokerCore=createBroker({capabilities:authority,store});
const actual:CoreReply=broker.execute('{}',{principal:'trusted'});
// @ts-expect-error Serialized input cannot provide trusted caller identity.
broker.execute('{}', {caller:'untrusted'});
void actual;
