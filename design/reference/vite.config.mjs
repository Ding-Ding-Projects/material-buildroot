import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const root=fileURLToPath(new URL('../../',import.meta.url));

export default {
  root,
  base:'./',
  build:{
    outDir:resolve(root,'dist-design'),
    emptyOutDir:true,
    rollupOptions:{input:resolve(root,'design/reference/index.html')},
  },
};
