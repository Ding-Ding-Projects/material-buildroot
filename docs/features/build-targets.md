# Named build and package targets

The build workspace provides fixed whole-project targets and source-discovered package actions. Selecting a target does not execute anything. Review the runtime, parallelism and reservation settings, then use the existing queue action.

## Whole-project targets

- `all`: build the configured system and final images.
- `source`: obtain configured sources.
- `legal-info`: produce the selected configuration's legal-information output.
- `show-info`: emit package information.
- `graph-depends`: generate dependency graph output when its host dependencies are available.
- `clean`: remove generated build output. Buildroot retains configuration, but the system must be rebuilt.

## Package actions

Package names come from matching package directories and `.mk` filenames below the adopted source's `package/` tree and authorized external trees' `package/` directories. Discovery reads directories only, never evaluates makefiles, skips symbolic links, and stops at the documented inventory bounds (five nested directory levels and 30,000 entries). Custom package layouts outside those trees are not listed. Discovery does not prove a package is enabled or its target exists in the selected configuration.

The host permits only bounded package names followed by one of these suffixes:

- `-download`: obtain that package's source.
- `-rebuild`: run compilation again without repeating configuration.
- `-reconfigure`: repeat configuration and compilation.
- `-dirclean`: remove the package build directory so the next build starts again.

Package rebuilding does not automatically rebuild reverse dependencies or regenerate final images. Run `all` afterwards. Toolchain, architecture, ABI or other incompatible configuration changes may require `clean` followed by `all`. A package clean does not remove every previously installed file from staging or target trees and is not an uninstall operation.

## Destination consent and execution

Whole-project and package cleaning require the existing two-key, slider and rebuild acknowledgment dialog bound to the exact host-resolved output directory, target, runtime, workspace identity and request. Cancelling or expiring that dialog does not queue work. The renderer cannot supply a command, shell fragment or destination path. Package existence is checked again by the host execution layer.

All actions reuse the existing immutable queue intent, source/configuration snapshot, workspace leases, runtime authority and non-root execution. A changed queued intent blocks admission instead of silently updating the request. Clean jobs cannot be retried without fresh consent.

## History and live output

The target panel polls the selected project's recorded jobs every two seconds while mounted. Selecting a job streams its persisted log pages, up to 100 events per poll, retaining the newest 500 displayed events. The stored history remains authoritative; the display limit does not delete records. Running and cancelling jobs show indeterminate progress because Buildroot does not provide a trustworthy overall percentage. Cancellation requests remain pending until an actual terminal job record is observed. Failed, cancelled and interrupted jobs remain visible with potentially incomplete output.

## Verification status

This change was implemented in the explicitly scoped fast-release pass. Tests, reviews, static analysis, runtime execution and screenshots were deferred. A production build has not yet been assigned to this lane. Real Buildroot target availability, package outcomes and rendered interaction remain unverified.

# 具名建置及套件目標

建置工作區提供固定整體目標，以及從已接入來源同已授權外部樹探索嘅套件操作。選擇目標唔會執行任何工作，請先檢視執行環境、並行數及資源預留，再排入佇列。

`all` 建置已設定系統及最終映像；`source` 取得來源；`legal-info` 產生授權資料；`show-info` 輸出套件資料；`graph-depends` 產生依賴圖；`clean` 移除建置輸出並需要完整重建。

套件操作包括下載、重新編譯、重新設定及移除套件建置目錄。套件存在唔代表目前設定已啟用。重新編譯唔會自動重建反向依賴或最終映像，之後應執行 `all`；工具鏈或 ABI 改變可能需要完整清理重建。套件清理唔係解除安裝。

破壞性操作需要原有雙重確認鍵、滑桿及重建確認，綁定確切輸出目的地。取消確認唔會建立工作。即時記錄每兩秒讀取目前專案狀態，保留最新 500 個顯示事件；完整儲存記錄唔會因此刪除。取消請求唔代表執行已停止。此輪未執行測試、審核、靜態分析、實際執行或畫面擷取。
