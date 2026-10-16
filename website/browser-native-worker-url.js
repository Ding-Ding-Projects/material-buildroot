const assets=typeof BROWSER_NATIVE_WORKERS==='object'&&BROWSER_NATIVE_WORKERS?Object.freeze(BROWSER_NATIVE_WORKERS):Object.freeze({});
/** Content-addressed worker filenames prevent an old page from silently loading a new adapter. */
export function browserWorkerURL(name){const file=assets[name];if(typeof file!=='string'||!/^browser-native-[a-z0-9-]+-[A-Za-z0-9]+\.js$/.test(file))throw Error('WORKER_PROVENANCE_UNAVAILABLE');return new URL('./'+file,import.meta.url);}
