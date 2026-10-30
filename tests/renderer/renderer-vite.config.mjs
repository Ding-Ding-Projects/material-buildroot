import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const entry=fileURLToPath(new URL('../../index.html',import.meta.url));
// Readiness checks the actual HTTP module response, not a synthetic warmup flag.
// Playwright accepts some 4xx statuses as ready, so normalize every non-module
// outcome to 503 instead of using its permissive URL check on the module itself.
export async function rendererModuleReady(fetchModule=fetch){
 try{
  const response=await fetchModule('http://127.0.0.1:5197/src/renderer/main.ts',{signal:AbortSignal.timeout(90000)});
  if(response.status!==200||!/javascript/.test(response.headers.get('content-type')||''))return false;
  const body=await response.text();
  return body.length>0&&body.length<=8*1024*1024&&/\b(?:import|export)\b/.test(body);
 }catch{return false;}
}
function rendererReadiness(){
 let pending;
 return {name:'renderer-module-readiness',configureServer(server){
  server.middlewares.use(async(req,res,next)=>{
   if(req.url!=='/__renderer-ready')return next();
   // Concurrent startup probes share one bounded request and never enqueue work.
   if(!pending)pending=rendererModuleReady().finally(()=>{pending=undefined;});
   const ready=await pending;
   res.statusCode=ready?200:503;res.setHeader('Content-Type','text/plain');res.setHeader('Cache-Control','no-store');res.end(ready?'Renderer entry module responded.':'Renderer entry module is not ready.');
  });
 }};
}
// This source-preview fixture serves the original CSP without a Vite HMR client.
// The HTML middleware can answer before Vite has transformed the renderer entry.
// Warm that exact entry using Vite 8's supported clientFiles API; Playwright also
// probes its actual response, so warmup alone is never a readiness claim.
export default {root,optimizeDeps:{entries:[entry]},server:{host:'127.0.0.1',port:5197,strictPort:true,hmr:false,warmup:{clientFiles:['./src/renderer/main.ts']},watch:{ignored:['**/.cache/**','**/release/**']}},plugins:[rendererReadiness(),{name:'isolated-renderer-fixture-document',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url?.startsWith('/@vite/client')){res.setHeader('Content-Type','application/javascript');res.end(`const styles=new Map();export function updateStyle(id,css){let style=styles.get(id);if(!style){style=document.createElement('style');document.head.append(style);styles.set(id,style);}style.textContent=css;}export function removeStyle(id){styles.get(id)?.remove();styles.delete(id);}export function createHotContext(){return {accept(){},prune(){},dispose(){}};}export function injectQuery(url){return url;}`);return;}if(req.url==='/favicon.ico'){res.statusCode=204;res.end();return;}if(req.url!=='/'&&req.url!=='/index.html')return next();res.setHeader('Content-Type','text/html');res.end(readFileSync(new URL('index.html',new URL('../../',import.meta.url))));});}}]};
