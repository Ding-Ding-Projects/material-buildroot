"use strict";
const fs = require("node:fs");
const path = require("node:path");
const PACKAGE = /^([a-z0-9][a-z0-9+_.-]{0,79})-(rebuild|reconfigure|dirclean|download)$/;
const NAMED = Object.freeze(["all", "source", "legal-info", "show-info", "graph-depends", "clean"]);
function packageTarget(target) { return typeof target === "string" ? PACKAGE.exec(target) : null; }
function isDestructiveTarget(target) { return target === "clean" || packageTarget(target)?.[2] === "dirclean"; }
function isBuildTarget(target, internalTargets) { return internalTargets.includes(target) || !!packageTarget(target); }
/** Read package names without evaluating makefiles or following directory links. */
function catalog(project) {
  const names = new Set();
  let visited = 0;
  const walk = (directory, depth) => {
    if (depth > 5) return;
    let entries;
    try { if (fs.lstatSync(directory).isSymbolicLink()) return; entries = fs.readdirSync(directory, {withFileTypes:true}); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const entry of entries) {
      if (++visited > 30000) throw Object.assign(new Error("Package inventory limit"), {code:"TARGET_INVENTORY_LIMIT"});
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) walk(path.join(directory,entry.name),depth+1);
      else if (entry.isFile() && entry.name.endsWith(".mk")) {
        const name=entry.name.slice(0,-3);
        if (/^[a-z0-9][a-z0-9+_.-]{0,79}$/.test(name) && path.basename(directory)===name) names.add(name);
      }
    }
  };
  walk(path.join(project.source,"package"),0);
  for (const root of project.externalTrees || []) walk(path.join(root,"package"),0);
  return {targets:NAMED, packages:[...names].sort(), packageActions:["rebuild","reconfigure","dirclean","download"], packageAvailability:"source-discovered-not-config-verified"};
}
function assertPackage(project,target) {
  const match=packageTarget(target);
  if (match && !catalog(project).packages.includes(match[1])) throw Object.assign(new Error("Package target unavailable"),{code:"PACKAGE_TARGET_NOT_DISCOVERED"});
}
module.exports={catalog,assertPackage,isBuildTarget,isDestructiveTarget,packageTarget};
