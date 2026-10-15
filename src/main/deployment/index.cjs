'use strict';
const { ArtifactStore, compareManifests } = require('./artifacts.cjs');
const { Virtualization } = require('./virtualization.cjs');
const { DeploymentTransports } = require('./transports.cjs');
function createDeploymentService(options) {
  const store = new ArtifactStore(options.root), virtual = new Virtualization({ ...options, store }), transports = new DeploymentTransports({ ...options, destinations: options.cloudDestinations || [], store });
  const result = { compareManifests };
  for (const [owner, names] of [[store, ['listArtifacts', 'inspectArtifact', 'createManifest', 'collectCompliance']], [virtual, ['discoverHypervisors', 'listGuests', 'createGuest', 'importGuest', 'editGuest', 'launchGuest', 'stopGuest', 'refreshGuest', 'previewConversion', 'executeConversion']], [transports, ['previewUpload', 'upload', 'enrollRemote', 'startRemote', 'observeRemote', 'cancelRemote', 'previewFlash', 'confirmFlash']]]) for (const name of names) result[name] = owner[name].bind(owner);
  return Object.freeze(result);
}
module.exports = { createDeploymentService, ArtifactStore, Virtualization, DeploymentTransports, compareManifests };
