# Ollama workspace

The Local assistant workspace joins managed runtime installation and repair, official catalogue browsing, local model discovery, hardware evidence, durable model pulls, and streamed local conversation.

Select a catalogue tag or an installed model. Catalogue selection never starts a download. Save a pull explicitly, review the shared tool queue, then start it. The queue also runs other queued tool jobs. Refresh saved pulls to inspect state, cancel an owned pull, or requeue a failed, cancelled, or interrupted pull. Recovery marks abandoned running records as interrupted. Ollama determines reusable downloaded blobs; recovery does not delete installed models.

Managed installation remains a separate reviewed action, with verified bundled/cache preference and optional official acquisition. Starting or stopping the managed listener remains separate from installation. Existing installations and model directories are preserved by the existing managed controller.

Chat requires a discovered installed model. The host creates one bounded in-memory generation session, streams from the fixed loopback Ollama endpoint, and exposes bounded response chunks through validated polling actions. Cancel acts on that session's AbortController. Reconnect retries response polling without replaying the prompt. Leaving the component requests cancellation. Completed sessions are forgotten by the consumer; abandoned terminal sessions expire after five minutes. There are at most eight retained sessions and one active generation. Prompts and responses are not written to the durable tool queue, application logs, or a conversation history file. Clearing a conversation removes the displayed in-memory transcript.

A cancelled or failed partial response remains visibly partial and is not appended as a completed assistant turn. Switching models clears the conversation. No project files or logs are automatically attached.

## Limits and verification

The official catalogue is an observed paginated snapshot, not a claimed exhaustive atomic inventory. Exact size, licensing, capability and hardware-fit evidence can remain unknown. No native GPU probe or durable conversation archive is added. The existing bounded loopback transport retains its 120-second request deadline. Large pulls can therefore need requeueing; no automatic retry or successful resume claim is made.

Implementation and package compilation do not establish runtime acceptance. No tests, runtime execution, model downloads, installation, visual inspection, or screen captures were performed for this change under the selected fast-release workflow. Existing historical captures do not depict the new workspace. Native installation recovery, cancelled pulls, stream cancellation, navigation, accessibility and restart behavior remain unverified.
