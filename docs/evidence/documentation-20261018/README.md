# Local documentation browser verification, 2026-10-18

The existing browser verification harness passed against the unchanged documentation output built from source `646e297b1a42eb8db8e79a16c34b5f50382d8ed2`: **22 interaction checks, 372 document routes, 12 responsive tuples and seven genuine captures retained privately**. This records local documentation behavior, not deployment or complete feature acceptance.

## Source binding

- Input snapshot: `8955c97308129d965efd95faf02b177bbfea76974ab1d62a9708c81e89254a16`.
- Build receipt SHA-256: `e0a6ef20bbea2cc6a27b69ccb5880b9cbfdaba1a2a4f68c766dc22a94b698042`, verified unchanged before and after the run.
- Original browser receipt SHA-256: `54b1e40a0240e222e514540ef1621d9ef3a6a227fb056e290d3e6bafc99f4294`.
- The build declared unchanged source inputs. Served HTML, JavaScript and CSS matched the selected output. No source or output rebuild was performed during verification.

The [bounded verification receipt](browser-verification.json) contains the reviewed public fields. Original receipts and captures remain in private retained evidence; they are not copied into this record.

## Exercised behavior

The run covered beginner task choices, explanations, Back/Next and reload progress; bounded recipe previews and troubleshooting examples; visitor tools opened through the actual New tab catalogue; local plans, checklists, notes, invalid-import preservation, confirmed backup restoration and JSON export. An opt-in offline-cache fixture served an article after network disconnect. These browser examples never represented installed application execution.

Keyboard focus, Escape behavior, navigation containment, reduced motion, language/theme persistence and English/Cantonese/bilingual layouts were exercised. Responsive tuples covered 320, 390, 768 and 1440 CSS pixels. All 372 article routes rendered, alongside overview/category/phase/status navigation. No browser JavaScript or HTTP asset/route failures were observed in this run.

## Route, capture and cleanup limits

A direct low-level CLI launched the task-owned browser harness on a named off-screen desktop. Playwright drove isolated headless Microsoft Edge. This is browser evidence, not native pointer or keyboard proof. The companion portion used an explicitly intercepted HTTPS protocol fixture with built document bytes, not a real TLS or LAN connection.

All seven genuine captures were inspected; no private data was observed. Formal capture promotion is still pending, and this category includes no public screenshot files. Some desktop captures retain a shortened existing heading-selector label, so full typography certification is not claimed. Physical mobile behavior, audible output, installed application behavior, deployment and whole-feature completion remain outside this verdict.

The owned launcher process and loopback listener were verified absent after completion. A subsequent desktop-close request reported `closed: false`; no successful explicit desktop-close action is claimed. The retained private ownership receipts provide the operational detail without publishing machine identities.
