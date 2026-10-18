# Beginner documentation guide

The home page starts with a four-step introduction. It asks what the visitor wants to learn, compares WSL 2 and Docker Linux containers, explains the current ISO fields and gives one concrete next reading step. Existing source-to-image, recipe, troubleshooting and safety guides remain available below it. Full articles use the existing article renderer.

## Choices and defaults

The first-visit default is to understand the basics. WSL 2 is the initial explanation, not a detected or installed runtime. Visitors should prefer a suitable environment already configured for their project. Both runtime cards state their prerequisites. The ISO examples describe the supported x86_64 BIOS / ISOLINUX / initrd profile, two parallel jobs and the generated `images/rootfs.iso9660` output. UEFI and hybrid USB are explicitly unsupported for this profile. Separate output directories protect previous results from incremental production.

Each choice changes a contextual explanation or the final next action. Image-field buttons reveal explanations, examples and links to complete field articles. Back and Next preserve choices. The introduction offers English, Cantonese and bilingual copy through the existing language preference, registered Material buttons, decorative symbols with readable labels, responsive cards and reduced-motion styles. Moving between steps focuses the section heading; changing a choice restores focus to that choice.

## Local progress and privacy

`mb-beginner-guide-v1` stores only a version, bounded step index, enumerated goal/runtime/field choices and a reading flag. Unknown fields are discarded on load. No paths, credentials, free-form text, desktop access or executable commands enter this state. The reset action replaces only this introduction's state, preserving other learning progress and saved references. Unavailable browser storage displays an honest reload warning.

Every activity is a browser learning example. No control runs Buildroot, probes the computer, applies a project configuration or marks an actual build successful. The reading flag records reading only. WSL and Docker `olddefconfig` / `show-info` checks have been verified independently; production of a complete ISO and its boot remain separate acceptance requirements, not inferred from those checks.

## Verification

`node website/test-beginner-guide.mjs` checks malformed persistence, invalid enum values, out-of-range steps, removal of unrelated fields and bilingual field inventory. This is source-level evidence only. The integrated documentation build must render the linked ISO articles and validate routes. Actual keyboard interaction, choices, Back/Next, reload persistence, reset isolation, language changes, unavailable storage and 320-pixel layouts require built-browser verification before completion. Capture and deployed-delivery evidence belong to that integrated run.

## 入門指南

首頁用四步帶你認識流程：選擇目標、比較執行環境、了解 ISO 欄位，再選下一篇閱讀資料。預設由基本概念開始，WSL 2 只係初始說明，唔代表已偵測或安裝。選擇同閱讀進度只儲存喺本機瀏覽器；重設此指南唔會影響其他學習進度。所有操作只係學習示例，唔會建置、套用配置或聲稱真實工作成功。完整 ISO 產生同啟動證據仍須獨立驗證。

## Suggested articles

- [ISO workflow](../desktop/iso-workflow.md)
- [ISO field guide](../desktop/iso-fields/README.md)
- [Workspace and source ownership](../desktop/modern-workspace.md)
- [Execution and recovery](../desktop/execution.md)
