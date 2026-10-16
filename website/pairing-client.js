// Pairing identity remains page-local. Browser branding is a usability hint, not attestation.
export function createPairingIdentity() {
  if (!globalThis.isSecureContext || location.protocol !== 'https:' || window.top !== window.self || !crypto.randomUUID) throw new Error('SECURE_TOP_LEVEL_REQUIRED');
  const brands = navigator.userAgentData?.brands || [];
  const browser = brands.some(item => item.brand === 'Microsoft Edge') || /Edg\//.test(navigator.userAgent) ? 'edge'
    : brands.some(item => item.brand === 'Google Chrome') || (/Chrome\//.test(navigator.userAgent) && !/OPR\/|Brave\//.test(navigator.userAgent)) ? 'chrome' : null;
  if (!browser) throw new Error('SUPPORTED_BROWSER_REQUIRED');
  return Object.freeze({browser, clientNonce: crypto.randomUUID()});
}
export function pairingHeaders(clientId) {
  if (typeof clientId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(clientId)) throw new Error('PAIRING_REQUIRED');
  return {'X-Companion-Client': clientId};
}
