# Windows 根入口及來源綁定輸出

[English](windows-entrypoints.md) · [建置索引](README.md)

支援Windowsx64，三根入口共用 `build-manifest.json` 同取得實作：

```powershell
.\build.bat --run
.\build-installer.bat /s
.\download-dependencies.bat --target design-reference /s
.\build.bat --target design-reference /s
.\build.bat --target documentation /s
```

首命令建置並明確launchproductiondesktop。原 `3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd` 根desktop成功產packagedshell及receipt；有界runtime證據另見原文，唔證installer/install/update/release。design-reference只獨立syntheticmaterial，冇hostoperation。

## Portable取得

唔需admin。Node24.22.0、MinGit2.56.0.2由官方分發至ignoredprojectlocal，manifest核exactarchiveSHA256/extractionlimit/requiredmember，WindowsPowerShell5.1/.NETbootstrap，唔需預裝Node/Git。

先hasharchive，再解壓；verifiedbytes導出inventory，cold/warm都查每regularfile。拒unsafe/duplicate/link/missing/extra。activation用exclusivehandle、uniquestaginggeneration、move前durablejournal；recovery驗真active/backup/stage唔信路徑，malformed保留/quarantine，冇可驗generation就停唔丟證據。

rootlock固定desktop/reference，documentation用website自己lock，`npm ci --ignore-scripts` 用cache精確安裝並關lifecycle。desktopruntimearchive固定manifest，Vite/MaterialWeb/Lit/package版本精確。MaterialWeb上游maintenance，import唔證註冊/無障礙。原host取得曾Node/MinGit讀version及311packages，只該host，唔freshOS/install/runtime證據。

.NETIO用extended-lengthWindows含local/UNC支援深path，唔改hostlongpathsetting。verifiedtree唔跟reparse，每regularfile照hash。child用普通路徑，failedstage/cache保留。

## 生產及復原

checkoutproducerlock包取得/npm/renderer/packageactivation/launch，競爭明確停。每build要已提交、index不變、冇untrackedsource。receipt綁commit/sourcetree/indextree/manifestversionhash/targetmetadata/command/package-lock/exactoutputbytes，production後及launch前再查。

design產 `dist-design/design/reference/index.html` 及receipt，新generation、保舊、journal替換，recovery只目的地缺先promote已驗prior，壞journal冇verifiedgeneration停。

desktop有exe及 `resources/app.asar`。installer用Squirrel，關sign/publication，本機shape要PE `Setup.exe`、`RELEASES`、full`.nupkg`及hashlength一致，唔nativeinstallupdate。未簽署可unknownpublisher/SmartScreen，build唔tag/push/publish。

silent `/s`、`--silent`、`SILENT=1`；run `/run`、`--run`、`RUN_AFTER_BUILD=1`，silent唔prompt，launch要明確，static冇desktoplaunch，installerproduction唔launch，childexit傳root。

可選maintainerlocalcurrencycheck冇private來源則skip，存在missing/stalelock則拒。公開只method唔dictionary/digest，唔證conversationusage。

## 原有驗證及剩餘

六focusedNode涵source/indexmutation、真junction、outputtamper/recovery、installer及真PS5.1fixture。PS涵arg/coldwarm/tamperrepair/journal/malformed/interruptedmoves/lock/extra/archive traversal，係local唔workflowjob。

仍欠freshWindows、stalledtransfercancel、真並行wholebuild、強中斷activation、完整package/licenseinventory、產品/nativeUI/adapters、Squirrelinstallupdate及releasepublication。路線圖要完整證據先勾。

## 歷史reference build

首個真rootreference由 `e16fa45fc73d24480b80c4db2eab695bcbe57b2d` 成功，轉137modules。receipt SHA256 `99a6b5a5d9b5da35b0cc23b5986f6302d7d296e01d1f3c0ac7e59f23433cec0f`，之後source修正要獨立重建，唔當產品證據。

## 歷史桌面里程碑

`3f5d2cd5bbdafbeda324514c3db0da9f0328bcfd` 產 `release/app/win-unpacked/Material Buildroot.exe`。receipt SHA256 `21e9109880510ef4fde2b561e728195b7de0dd09bbeb0fdfa3ea01a415ea92d1`；exe `95b0d00acc352dc598bc315fb14dd4403ea57ffbfde4711a6960a2d66d89d031`；`resources/app.asar` `377445849f5c8028b20807f00a51ba3dda9d4e3595c116baac05f01b5b0cfa77`。

該來源六buildtoolchecks、48settings組合、52有效layoutreceipt及三語真restart通過，只bounded shell，唔Buildroot/installer/全產品。舊host/preload/互動保原source，見[擷取及限制](../evidence/desktop-shell/README.md)，nativeDPI同runtime/CDPscale分開。

## 隔離documentation target

根執行 `build.bat --target documentation /s`，driver精確安裝websitelock、關lifecycle、新ignoredgeneration產生、跑內置documentationcheck並activate `.cache/documentation-output/`及standardreceipt。整個producer source/index不可變。

generator遞迴docs/design Markdown但排generated docs/site，render sourcewiki、copy本機參照assets、rawbytes綁snapshot，source/output查path/ancestorlink。原三focusedtests涵encodedWindowstraversal/control、真junction及asset-onlysnapshot，`npm test`探索CommonJS/ESmodule。唔將原測試當本輪已跑。

原documentation根target由 `2f24e10df6e8294d2bb00863f4d1222161669df0` 成功產69pages、1578internal links/assets/fragments；20browserruntime組合通過觀察，但temporaryprofile刪除被自動approval阻，strictaudit未完成。review/browser驗證後，另外promote `index.html`、`.nojekyll`、`site/`到docs，publication/live route/assets/anchors獨立。documentation冇installer/desktoplaunch。本輪翻譯冇重跑上述證據。
