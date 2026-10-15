import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
// This source-preview fixture serves the original CSP without a Vite HMR client.
export default {root,server:{host:'127.0.0.1',port:5197,strictPort:true,hmr:false},plugins:[{name:'isolated-renderer-fixture-document',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url==='/favicon.ico'){res.statusCode=204;res.end();return;}if(req.url!=='/'&&req.url!=='/index.html')return next();res.setHeader('Content-Type','text/html');res.end(readFileSync(new URL('index.html',new URL('../../',import.meta.url))));});}}]};
