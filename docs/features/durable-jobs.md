# Durable jobs and recovery

The build queue includes a durable recovery panel. It reads the existing job manager rather than maintaining a second execution queue. The panel refreshes saved metadata every three seconds while attached, retains selection while refreshing, and shows job identity, sequence, state, last update, output count, per-item outcome count and retry lineage. Switching projects clears the selection and outcome view without changing project drafts.

## Recover interrupted work

1. Open the original project's build queue. Interrupted work is not treated as completed or safely cancelled.
2. Read the recorded output and item outcomes. The item reader pages fifty records at a time and retains at most two hundred visible records.
3. Choose **Open recovery context** to reach queue admission and recovery. Renew access to the same project and external folders, then use the existing owned-runtime cleanup verification.
4. Retry only after cleanup is verified. A retry creates a new job with the original intent and retry lineage. Changed source or configuration still goes through the existing scheduler admission. Destructive clean operations require a new individual confirmation.

Hosted jobs retain their separate bound-run history and explicit destination reconnection. Recovery never dispatches another hosted run. Converter and model queues retain their existing separate authority and grants.

## Bulk requests

Select individual displayed jobs, all displayed jobs, or invert the displayed selection. Preview cancellation or retry to inspect the exact identities, states and sequences, then explicitly confirm. The host admits only the fixed `cancel` and `retry` operations, validates ownership, and delegates each item to the same operation used by an individual request. Stale or ineligible items produce separate receipts rather than disappearing from a successful aggregate.

The receipt journal is local and bounded to one hundred batches of at most one hundred items. It records each item as requesting before calling the existing operation. After restart a requesting item becomes unknown, and remaining pending items become skipped. It never replays an interrupted batch. If the journal is full, no further batch starts; individual job controls remain available. The panel shows the ten most recent batches; the host retains the full bounded receipt history.

**Stop remaining batch requests** prevents later items from starting. It does not cancel the current request or claim that an underlying running process stopped. An accepted cancellation is a request, and an accepted retry is a newly queued job, neither is a successful execution verdict. Completed effects cannot be undone by a bulk action.

## Storage and recovery boundaries

The existing job store remains authoritative for owner identity, optimistic sequences, logs, item records, execution and final state. The additional batch journal contains only operation identities, request kind, sequences and outcomes. It uses the existing atomic storage helper. An unreadable journal fails visibly and is not reset or silently replaced. A process interruption between an action and its receipt remains unknown; inspect the authoritative jobs and retry lineage before acting again.

The renderer cannot provide a command or arbitrary callback. All operations pass through the existing strict operation fields and host validation. Native access, runtime ownership, cleanup quarantine and destructive confirmation remain enforced.

## Verification status

This implementation is source-only for roadmap PH04-T05. Tests, reviews, audits, static analysis, real execution, restart exercises, cancellation exercises and screenshots were intentionally deferred for this delivery. No functional, visual or crash-recovery acceptance is claimed. Build and packaging are assigned separately by the coordinating task.

## 工作復原

建置佇列提供持久工作復原面板，使用現有工作管理器，唔會建立另一套執行權限。面板會更新已儲存狀態，列出工作身分、序號、輸出及逐項結果。切換專案會清除選取，唔會改動專案草稿。

中斷唔等於完成或已安全取消。請先讀取逐項結果，再開啟復原位置，重新授權相同專案及外部資料夾，驗證自有執行環境已停止。重試會建立有來源連結的新工作；清理操作必須重新確認。託管工作需要明確重新連接，唔會自動重新派送。

批次操作先預覽確切身分及序號，再逐項提出取消或重試請求。每項都有獨立回條，過期或不合資格項目唔會被當作成功。重新啟動後，未確認請求保留未知結果，餘下項目標示略過，唔會自動重播。停止餘下請求唔代表目前執行已停止，亦唔會撤銷已完成效果。

本次只完成來源實作，測試、實際執行、重新啟動及畫面驗證全部延後，未宣稱驗收完成。
