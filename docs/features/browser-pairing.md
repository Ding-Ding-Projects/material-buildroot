# Browser pairing and private network grants

The desktop owner explicitly selects a private listener address, trusted HTTPS certificate and matching key. Starting the listener requires a native confirmation. There is no public-address listener, automatic enrollment, certificate exception, firewall change or host-security change.

## Pair Edge or Chrome

1. In Browser companion, configure TLS, choose the local address and start the listener through native approval.
2. Select Microsoft Edge or Google Chrome, enter an owner-recognizable device label, the exact HTTPS website origin and the minimum scopes.
3. Create a five-minute, one-use challenge. Enter it only in the website pairing control, never a URL, export or log.
4. The browser displays a random instance identifier. Compare it with the native approval, including the selected origin, device label, browser, peer and scopes, before approving.
5. The resulting one-hour session fixes those selections. A scope change requires a new challenge and native approval. The browser cannot grant itself permissions.

Browser branding is a compatibility hint and device labels are owner-selected names, not hardware or browser attestation. Authentication uses the private Secure/HttpOnly cookie, memory-only CSRF value, bound browser-instance identifier and original network peer. A changed peer, page reload, expiry or revocation requires pairing again. Do not use a proxy to expose this endpoint to the public internet. The server rejects non-private peers and ignores forwarding headers.

## Request and host contract

Pairing accepts exactly challenge, clientNonce and browser. Native challenge creation accepts exactly origin, scopes, browser and deviceName. Subsequent calls send X-Companion-Client with the original clientNonce alongside X-CSRF-Token and the cookie. An action has exactly action, args, sequence and nonce. Sequence increments, unique nonces, strict argument validation, request bounds and one in-flight action per session prevent duplicate execution and ambiguous parallel sequence changes. Failed or uncertain requests are not automatically retried.

Trusted host code may supply actionContracts, an object of named actions with a scope and synchronous validate(args) function. Existing action names may replace validation only with their original fixed scope. This registry is supplied by host code, never IPC or browser input. The controller's allowedScopes is separately selected by host code. Each dispatch receives a frozen context with sessionId, origin, browser, deviceName, clientId, frozen scopes, operationId and isAuthorized(). Consumers must check isAuthorized() immediately before each sensitive read or mutation and must keep project authorization separate from session scope.

## Revocation and settlement

Native revoke, browser disconnect and listener stop remove new authority. A running operation retains its actual settlement state and records authorityRevoked; revocation does not falsely claim that an already-started host job was stopped. Results settling after revocation are withheld. Browser disconnect clears local session state even when network loss prevents confirmation; the interface explicitly requires native revocation in that case. Listener stop invalidates pending native enrollment approvals.

## Browser network controls

The page must be a top-level HTTPS secure context. The endpoint is an explicit HTTPS private IPv4 address or IPv6 loopback address with a port. No DNS lookup, discovery scan, mixed-content downgrade, TLS bypass or permission-policy change is performed. Exact-origin CORS and bounded legacy private-network preflight support do not replace browser-owned local-network permission. Browser denial, untrusted certificates, cookie restrictions and enterprise policy can prevent pairing; the page reports uncertainty and does not retry or weaken protection.

Current browser guidance: [Chrome Local Network Access](https://developer.chrome.com/blog/local-network-access) and [Microsoft Edge Local Network Access](https://learn.microsoft.com/en-us/deployedge/ms-edge-local-network-access). Browser permission and native host approval are independent decisions.

## Verification status

This change is source implementation only. Tests, static analysis, browser interaction, listener startup, enrollment, TLS trust, LAN permission prompts, actual revocation and built UI capture were intentionally not run in this delivery lane. Successful packaging is not runtime or security verification. Complete those checks before claiming operational acceptance.
