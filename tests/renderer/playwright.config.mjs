import {fileURLToPath} from 'node:url';
import path from 'node:path';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=process.env.RENDERER_REPO_ROOT||path.resolve(here,'../..');
export default {
 testDir:here,testMatch:'renderer-*.spec.mjs',workers:1,timeout:20000,reporter:'list',
 outputDir:path.join(repo,'.cache/renderer-test-results'),
 use:{baseURL:'http://127.0.0.1:5197',headless:true,viewport:{width:1440,height:960},launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined}},
 // Allow bounded cold dependency/entry transformation before the test clock starts.
 // Readiness fetches and validates the actual entry module response, not HTML.
 // The adapter returns 503 for missing, errored, empty or non-JavaScript responses.
 webServer:{command:'node node_modules/vite/bin/vite.js --config tests/renderer/renderer-vite.config.mjs',cwd:repo,url:'http://127.0.0.1:5197/__renderer-ready',reuseExistingServer:false,timeout:120000},
};
