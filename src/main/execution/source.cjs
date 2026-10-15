'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { boundedProcess } = require('./index.cjs');
const safeName = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(value) && value !== '.' && value !== '..';
function safeRef(value) { return typeof value === 'string' && value.length <= 200 && /^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(value) && !value.includes('..') && !value.includes('//') && !value.endsWith('/') && !value.endsWith('.lock'); }
function directory(value) { if (typeof value !== 'string' || !path.isAbsolute(value) || /[\0\r\n]/.test(value)) throw Error('invalid-root'); const real = fs.realpathSync(value); if (!fs.statSync(real).isDirectory()) throw Error('invalid-root'); return real; }
function identity(value) { const stat = fs.statSync(value); return `${stat.dev}:${stat.ino}`; }
class SourceService {
  constructor({ git = 'git', allowLocalFixture = false, acquireSourceLock = null } = {}) {
    if (git !== 'git' && !path.isAbsolute(git)) throw Error('invalid-git-executable');
    this.git = git; this.allowLocalFixture = allowLocalFixture; this.acquireSourceLock = acquireSourceLock; this.grants = new Map(); this.projects = new Map(); this.previews = new Map(); this.busy = new Set();
    this.hooks = fs.mkdtempSync(path.join(os.tmpdir(), 'material-empty-hooks-'));
  }
  dispose() { fs.rmSync(this.hooks, { recursive: true, force: true }); }
  grantRoot(root) { root = directory(root); const grantId = crypto.randomUUID(); this.grants.set(grantId, { root, identity: identity(root) }); return { grantId, root }; }
  revoke(grantId) { this.grants.delete(grantId); }
  destination(grantId, name) {
    const grant = this.grants.get(grantId); if (!grant || !safeName(name)) throw Error('invalid-source-grant');
    if (directory(grant.root) !== grant.root || identity(grant.root) !== grant.identity) throw Error('source-grant-changed');
    const dest = path.join(grant.root, name);
    if (fs.existsSync(dest) && (fs.lstatSync(dest).isSymbolicLink() || directory(dest) !== dest)) throw Error('source-path-alias');
    return dest;
  }
  url(value) {
    if (this.allowLocalFixture && typeof value === 'string' && path.isAbsolute(value) && !/[\0\r\n]/.test(value)) return directory(value);
    let url; try { url = new URL(value); } catch { throw Error('unsafe-source-url'); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash || /[\s\x00-\x1f\x7f]/.test(value)) throw Error('unsafe-source-url');
    return url.href;
  }
  async run(cwd, args) {
    const result = await boundedProcess(this.git, ['-c', `core.hooksPath=${this.hooks}`, '-c', 'credential.helper=', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', '-c', `protocol.file.allow=${this.allowLocalFixture ? 'always' : 'never'}`, ...(cwd ? ['-C', cwd] : []), ...args], { timeoutMs: 600000, maxBytes: 4 * 1024 * 1024, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.platform() === 'win32' ? 'NUL' : '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' } }).completion;
    if (result.state !== 'succeeded') { const error = Error(`git-${result.state}`); error.result = { state: result.state, code: result.code }; throw error; }
    return result.stdout;
  }
  project(projectId) { const project = this.projects.get(projectId); if (!project || this.destination(project.grantId, project.directory) !== project.source || identity(project.source) !== project.identity || fs.lstatSync(path.join(project.source, '.git')).isSymbolicLink()) throw Error('source-project-unavailable'); return project; }
  async exclusive(source, action, requireExternal = false) {
    if (this.busy.has(source)) throw Error('source-busy'); this.busy.add(source); let release;
    try { if (requireExternal && typeof this.acquireSourceLock !== 'function') throw Error('source-lock-unavailable'); release = this.acquireSourceLock ? await this.acquireSourceLock(source) : () => {}; if (typeof release !== 'function') throw Error('source-lock-unavailable'); return await action(); } finally { try { release?.(); } finally { this.busy.delete(source); } }
  }
  async adopt({ grantId, directory: name, trustedSource }) {
    if (trustedSource !== true) throw Error('source-trust-consent-required');
    const source = this.destination(grantId, name);
    if (!fs.statSync(path.join(source, '.git')).isDirectory() || fs.lstatSync(path.join(source, '.git')).isSymbolicLink()) throw Error('ordinary-git-worktree-required');
    const top = (await this.run(source, ['rev-parse', '--show-toplevel'])).trim(); if (directory(top) !== source) throw Error('source-repository-boundary');
    const projectId = crypto.randomUUID(); this.projects.set(projectId, { grantId, directory: name, source, identity: identity(source) });
    return { projectId, source, ...(await this.status(projectId)) };
  }
  async clone({ grantId, directory: name, url, ref = 'HEAD', trustedSource }) {
    if (trustedSource !== true) throw Error('source-trust-consent-required'); if (!safeRef(ref)) throw Error('invalid-source-ref');
    url = this.url(url); const destination = this.destination(grantId, name);
    if (fs.existsSync(destination) && fs.readdirSync(destination).length) throw Error('destination-not-empty');
    return this.exclusive(destination, async () => {
      this.destination(grantId, name);
      await this.run(null, ['clone', '--no-local', '--no-checkout', '--no-recurse-submodules', '--', url, destination]);
      const revision = await this.resolve(destination, ref); await this.run(destination, ['checkout', '--detach', revision]);
      return this.adopt({ grantId, directory: name, trustedSource });
    });
  }
  async resolve(source, ref) { if (!safeRef(ref)) throw Error('invalid-source-ref'); const revision = (await this.run(source, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`])).trim(); if (!/^[a-f0-9]{40,64}$/.test(revision)) throw Error('invalid-source-revision'); return revision; }
  async status(projectId) {
    const project = this.project(projectId); const revision = await this.resolve(project.source, 'HEAD');
    const changes = await this.run(project.source, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--ignore-submodules=none']);
    const branch = (await this.run(project.source, ['branch', '--show-current'])).trim();
    return { revision, branch: branch || null, dirty: changes.length > 0, changes };
  }
  async acquireRef({ projectId, ref }) {
    if (!safeRef(ref)) throw Error('invalid-source-ref'); const project = this.project(projectId);
    return this.exclusive(project.source, async () => {
      const origin = (await this.run(project.source, ['remote', 'get-url', 'origin'])).trim(); this.url(origin);
      // Explicit refspec prevents option interpretation and never updates the current branch.
      await this.run(project.source, ['fetch', '--no-tags', '--no-recurse-submodules', '--', origin, ref]);
      return { fetchedRevision: await this.resolve(project.source, 'FETCH_HEAD'), ...(await this.status(projectId)) };
    });
  }
  async previewUpgrade({ projectId, revision }) {
    if (!/^[a-f0-9]{40,64}$/.test(revision || '')) throw Error('immutable-revision-required'); const project = this.project(projectId);
    const before = await this.status(projectId); const target = await this.resolve(project.source, revision);
    const diff = await this.run(project.source, ['diff', '--no-ext-diff', '--no-textconv', '--stat', before.revision, target, '--']);
    const previewId = crypto.randomUUID(); this.previews.set(previewId, { projectId, before, target });
    return { previewId, fromRevision: before.revision, toRevision: target, dirty: before.dirty, diff, outputCompatibility: 'unknown', outputPreserved: true };
  }
  async applyUpgrade({ previewId, expectedRevision, consent }) {
    const preview = this.previews.get(previewId); if (!preview || consent !== true || preview.before.revision !== expectedRevision) throw Error('upgrade-consent-or-preview-invalid');
    const project = this.project(preview.projectId);
    return this.exclusive(project.source, async () => {
      this.project(preview.projectId); const current = await this.status(preview.projectId);
      if (current.revision !== expectedRevision || current.dirty || preview.before.dirty) throw Error('upgrade-source-changed-or-dirty');
      await this.run(project.source, ['checkout', '--detach', preview.target]); this.previews.delete(previewId);
      return { ...(await this.status(preview.projectId)), rollbackRevision: expectedRevision, outputPreserved: true, outputCompatibility: 'unknown' };
    }, true);
  }
}
module.exports = { SourceService };
