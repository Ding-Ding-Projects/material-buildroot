# Learning navigation accessible-name repair

Baseline source: `bb34a7efc011c2c5450616197ffa7cf9ef0701b3`.

The inspected 1440 × 1000 English/light capture showed literal closing markup after
the learning-navigation heading. Its SHA-256 was
`78d0e060198ff2a65f62d6add699e7a744ff2a9792f11d7561264094adb58fcf`.
The corresponding assembled HTML, SHA-256
`6d37a785fea51ce98d23618bd4455d2179dbfdd47f8678c302b55eebabac05e3`,
contained a span-generating label helper inside quoted `aria-label` attributes.
The same exact pattern affected the learning navigation and walkthrough rail.

## Repair

Both opening tags now use an attribute-specific helper that escapes plain English,
Cantonese and bilingual names. The existing language control updates their accessible
names on initial load and subsequent language changes. The content-label helper still
renders spans where HTML content is appropriate. No layout redesign is included.

## Focused verification and limits

`tests/browser-markup.test.mjs` first ran against the preserved assembled HTML through
`MATERIAL_BROWSER_MARKUP_INPUT`. Both malformed-attribute assertions failed against
those actual bytes; the new escaping and language-update assertions also failed before
implementation. The old capture and HTML were not modified.

After the repair:

```powershell
node --test tests/browser-markup.test.mjs tests/browser-workflow-contract.test.mjs
```

reported 12 passed and zero failed. The four markup checks cover the exact production
opening tags, attribute escaping, and the real language-control handler with isolated
DOM doubles. The other eight preserve the earlier browser response and route checks.
Syntax checks for `website/build.mjs`, `website/app.js` and
`website/verify-browser.mjs` passed, as did `git diff --check`.

The existing built-browser verifier now checks both accessible names in English,
Cantonese and bilingual modes and rejects stray closing markup in those surfaces.
It was updated but not run in this source repair. A fresh root build, the same capture
tuple and actual built interaction remain pending. Passing source tests do not establish
new built pixels, accessibility-tree behavior or live publication.
