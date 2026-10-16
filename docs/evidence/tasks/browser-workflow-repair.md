# Browser summary and supporting-link repair

The repair starts from source revision `7a6b2b5ee5d23f9029d3128d9961cb8aef52cf79`.
It changes only the browser response consumer, dynamic guide routes, directly related
verification and documentation. Host response fields and permissions are unchanged.

## Behavior

- Workspace summaries now consume the flat privacy-filtered host response without requesting
  private preferences. Project and job summaries consume their named collection wrappers.
- Whole-result validation rejects malformed records before rendering partial results. Invalid
  data is not cached for language rerendering, and no raw response is displayed.
- Success copy follows successful result rendering. Lost replies clear prior data and retain
  explicit sequence recovery without automatic retry.
- Supporting guide links convert source `.md` names to the generated `.html` article route.

## Focused verification

The focused regression (now discovered by the normal test script at
`node --test tests/browser-workflow-contract.test.mjs`) first reported
six failing tests against the unchanged baseline browser source. The failures covered all
three actual host response projections, empty summary rendering, malformed-data handling and
the article suffix. After the repair and an additional action-handler regression, the command
reported seven tests passed, zero failed. `node --check website/app.js` and
`node --check website/verify-browser.mjs` also completed successfully.

Independent review then corrected the plan fixture to the admitted `draft` status and added
a same-context valid-result, malformed-or-lost-reply, language-rerender check. That check
requires prior records and private fields to remain absent without another request. The
focused command subsequently reported eight tests passed, zero failed. The host's existing
64 KiB response boundary remains unchanged; these checks do not add a new transport limit.

The regression executes production source sections and the actual host projection, using
in-memory DOM doubles. Its fixtures contain no real personal data. It exercises no browser,
network, installer, build or application runtime. Syntax and source behavior do not prove
current built delivery.

The existing built-browser verifier additionally checks every dynamic guide stage against the
selected build's document inventory and requires HTTP 200 for its article. That verifier was
updated but not run in this repair unit. A fresh root build, actual paired-browser acceptance,
current source-bound captures and publication verification remain separate pending work.
