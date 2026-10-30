import path from 'node:path';
import {defineConfig} from 'vite';

export default defineConfig({
 root: path.join(import.meta.dirname, 'static'),
 base: './',
 publicDir: false,
 build: {
  outDir: path.resolve(import.meta.dirname, '../../../dist/appliance-guest'),
  emptyOutDir: true,
  sourcemap: false,
  target: 'es2022',
 },
});
