'use strict';
const fs=require('node:fs');const path=require('node:path');const {DatabaseSync}=require('node:sqlite');const {randomBytes}=require('node:crypto');const {identity}=require('../security/capabilities.cjs');
const INITIAL_REVISION='0'.repeat(40),APPLICATION_ID=0x4d425253;
const SCHEMA=[
"CREATE TABLE settings(principal TEXT NOT NULL,namespace TEXT NOT NULL,language TEXT NOT NULL CHECK(language IN ('en','zh-HK','bilingual')),revision TEXT NOT NULL,PRIMARY KEY(principal,namespace)) STRICT",
'CREATE TABLE operations(principal TEXT NOT NULL,namespace TEXT NOT NULL,operation_id TEXT NOT NULL,digest TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(principal,namespace,operation_id)) STRICT',
'CREATE TABLE events(sequence INTEGER PRIMARY KEY AUTOINCREMENT,principal TEXT NOT NULL,namespace TEXT NOT NULL,operation_id TEXT NOT NULL,kind TEXT NOT NULL,revision TEXT NOT NULL,timestamp TEXT NOT NULL) STRICT'];
const EXPECTED=[...SCHEMA.map(sql=>({type:'table',name:/CREATE TABLE (\w+)/.exec(sql)[1],sql})),{type:'table',name:'sqlite_sequence',sql:'CREATE TABLE sqlite_sequence(name,seq)'},{type:'index',name:'sqlite_autoindex_settings_1',sql:null},{type:'index',name:'sqlite_autoindex_operations_1',sql:null}].sort((a,b)=>a.name.localeCompare(b.name));
function exists(file){try{fs.lstatSync(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
class StorageError extends Error{constructor(){super('Settings storage is unavailable.');this.code='STORAGE_UNAVAILABLE';}}
function fingerprint(file){const s=fs.lstatSync(file,{bigint:true});if(s.isSymbolicLink()||!s.isFile()||s.nlink!==1n)throw new StorageError();return `${s.dev}:${s.ino}`;}
function assertParents(file){let current=path.dirname(file);while(true){const stat=fs.lstatSync(current);if(stat.isSymbolicLink()||!stat.isDirectory()||path.resolve(fs.realpathSync(current)).toLowerCase()!==path.resolve(current).toLowerCase())throw new StorageError();const parent=path.dirname(current);if(parent===current)break;current=parent;}}
function assertSchema(db){const rows=db.prepare('SELECT type,name,sql FROM sqlite_master ORDER BY name').all().map(r=>({...r})).sort((a,b)=>a.name.localeCompare(b.name));if(JSON.stringify(rows)!==JSON.stringify(EXPECTED))throw new StorageError();}
/** Header inspection precedes even a read-only SQLite connection. */
function admitExisting(file){const fd=fs.openSync(file,'r');try{const header=Buffer.alloc(100);if(fs.readSync(fd,header,0,100,0)!==100||header.toString('binary',0,16)!=='SQLite format 3\0'||header.readUInt32BE(68)!==APPLICATION_ID||header.readUInt32BE(60)!==1||header[18]!==1||header[19]!==1)throw new StorageError();}finally{fs.closeSync(fd);}let db;try{db=new DatabaseSync(file,{readOnly:true,allowExtension:false,timeout:0});db.exec('PRAGMA trusted_schema=OFF');assertSchema(db);}finally{db?.close();}}
/** Database path is trusted host configuration. No renderer path is accepted. */
class SettingsStore{
 #db;#file;#journalIdentity;#identity;#lock;#lockIdentity;#lockFd;#closed=false;
 constructor(databasePath){if(typeof databasePath!=='string'||!path.isAbsolute(databasePath)||databasePath.length>1024||/[\x00-\x1f]/.test(databasePath))throw new StorageError();this.#file=path.resolve(databasePath);this.#lock=this.#file+'.lock';try{
 assertParents(this.#file);this.#assertNoSidecars();const existing=exists(this.#file);if(existing){this.#identity=fingerprint(this.#file);admitExisting(this.#file);if(fingerprint(this.#file)!==this.#identity)throw new StorageError();}
 this.#lockFd=fs.openSync(this.#lock,'wx',0o600);this.#lockIdentity=fingerprint(this.#lock);
 if(!existing){const fd=fs.openSync(this.#file,'wx',0o600);fs.closeSync(fd);this.#identity=fingerprint(this.#file);}
 this.#assertNoSidecars();if(fingerprint(this.#file)!==this.#identity)throw new StorageError();
 this.#db=new DatabaseSync(this.#file,{enableForeignKeyConstraints:true,allowExtension:false,timeout:0});
 this.#db.exec('PRAGMA journal_mode=DELETE;PRAGMA synchronous=FULL;PRAGMA locking_mode=EXCLUSIVE;PRAGMA trusted_schema=OFF;');
 if(!existing)this.#db.exec(`BEGIN EXCLUSIVE;${SCHEMA.join(';')};PRAGMA application_id=${APPLICATION_ID};PRAGMA user_version=1;COMMIT;`);
 else{this.#db.exec('BEGIN EXCLUSIVE');assertSchema(this.#db);this.#db.exec('COMMIT');}
 if(exists(this.#file+'-journal'))this.#journalIdentity=fingerprint(this.#file+'-journal');this.#assertOwned();
 }catch{this.close();throw new StorageError();}}
 #assertNoSidecars(allowOwned=false){for(const suffix of ['-wal','-shm','-journal'])if(exists(this.#file+suffix)&&!(allowOwned&&suffix==='-journal'&&this.#journalIdentity&&fingerprint(this.#file+suffix)===this.#journalIdentity))throw new StorageError();}
 #assertOwned(){if(this.#closed)throw new StorageError();assertParents(this.#file);if(fingerprint(this.#file)!==this.#identity||fingerprint(this.#lock)!==this.#lockIdentity)throw new StorageError();this.#assertNoSidecars(true);}
 #scope(principal,namespace){if(!identity(principal)||!identity(namespace))throw new StorageError();}
 read(principal,namespace){this.#scope(principal,namespace);try{this.#assertOwned();const row=this.#db.prepare('SELECT language,revision FROM settings WHERE principal=? AND namespace=?').get(principal,namespace);return row?{...row}:{language:'bilingual',revision:INITIAL_REVISION};}catch{throw new StorageError();}}
 setLanguage({principal,namespace,operationId,digest,expectedRevision,language,authorize}){this.#scope(principal,namespace);if(!/^[0-9a-f-]{36}$/.test(operationId)||!/^[0-9a-f]{64}$/.test(digest)||!/^[0-9a-f]{40}$/.test(expectedRevision)||!['en','zh-HK','bilingual'].includes(language)||typeof authorize!=='function')throw new StorageError();try{
 this.#assertOwned();this.#db.exec('BEGIN IMMEDIATE');
 const saved=this.#db.prepare('SELECT digest,result FROM operations WHERE principal=? AND namespace=? AND operation_id=?').get(principal,namespace,operationId);
 if(saved){this.#db.exec('ROLLBACK');if(!authorize())return {code:'NOT_AUTHORIZED'};return saved.digest===digest?JSON.parse(saved.result):{code:'OPERATION_CONFLICT'};}
 const current=this.#db.prepare('SELECT revision FROM settings WHERE principal=? AND namespace=?').get(principal,namespace);if((current?.revision||INITIAL_REVISION)!==expectedRevision){this.#db.exec('ROLLBACK');return {code:'STALE_REVISION'};}
 const revision=randomBytes(20).toString('hex'),timestamp=new Date().toISOString();
 this.#db.prepare('INSERT INTO settings VALUES(?,?,?,?) ON CONFLICT(principal,namespace) DO UPDATE SET language=excluded.language,revision=excluded.revision').run(principal,namespace,language,revision);
 const event=this.#db.prepare('INSERT INTO events(principal,namespace,operation_id,kind,revision,timestamp) VALUES(?,?,?,?,?,?)').run(principal,namespace,operationId,'settings.languageChanged',revision,timestamp);
 const result={code:'OK',language,revision,eventSequence:event.lastInsertRowid};this.#db.prepare('INSERT INTO operations VALUES(?,?,?,?,?)').run(principal,namespace,operationId,digest,JSON.stringify(result));
 if(!authorize()){this.#db.exec('ROLLBACK');if(!this.#journalIdentity&&exists(this.#file+'-journal'))this.#journalIdentity=fingerprint(this.#file+'-journal');return {code:'NOT_AUTHORIZED'};}
 this.#db.exec('COMMIT');if(!this.#journalIdentity&&exists(this.#file+'-journal'))this.#journalIdentity=fingerprint(this.#file+'-journal');this.#assertOwned();return result;
 }catch{try{this.#db.exec('ROLLBACK');if(!this.#journalIdentity&&exists(this.#file+'-journal'))this.#journalIdentity=fingerprint(this.#file+'-journal');}catch{}throw new StorageError();}}
 events(principal,namespace,afterSequence=0){this.#scope(principal,namespace);if(!Number.isSafeInteger(afterSequence)||afterSequence<0)throw new StorageError();try{this.#assertOwned();const rows=this.#db.prepare('SELECT sequence,operation_id AS operationId,kind,revision,timestamp FROM events WHERE principal=? AND namespace=? AND sequence>? ORDER BY sequence LIMIT 1001').all(principal,namespace,afterSequence);const events=rows.slice(0,1000).map(r=>({...r}));return {events,hasMore:rows.length>1000,nextSequence:events.at(-1)?.sequence??afterSequence};}catch{throw new StorageError();}}
 close(){if(this.#closed)return;this.#closed=true;try{this.#db?.close();}catch{}if(this.#lockFd!==undefined){try{fs.closeSync(this.#lockFd);}catch{}try{if(fingerprint(this.#lock)===this.#lockIdentity)fs.unlinkSync(this.#lock);}catch{}}}
}
module.exports={SettingsStore,StorageError,INITIAL_REVISION,APPLICATION_ID};
