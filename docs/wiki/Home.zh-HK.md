# 專案 wiki

[English](Home.md) · [文件索引](../README.md)

Material Buildroot 係 Windows 桌面工作區，提供項目、配置同執行流程。先讀[新手指南](../features/guided-documentation.zh-HK.md)，再跟住[開始使用](Getting-started.zh-HK.md)。

已有普通未簽署 Squirrel.Windows 發佈。[Build 233.1](https://github.com/Ding-Ding-Projects/material-buildroot/releases/tag/v0.1.1-build.233.1)，來源 `21bf4ad4c6e1fb19a8a48fae57cdca6d63777c6a`，已有正常安裝後啟動、About 導覽同返回工作區嘅驗證，詳見[已記錄安裝版本界線](../../README.md)。之後 Build 234.1 已發佈，但此處未證明佢已安裝。目前 ISO 介面候選唔可以因此當成已包含喺獲驗收嘅安裝版本。

已有真實 WSL/Docker 檢查同完整非 root BIOS GRUB2 ISO 製作記錄。未修改嘅 12,357,632 位元組映像喺記錄所列 QEMU 10.0.13/Cirrus/RTL8139 組合啟動，完成主控台、暫存檔、DHCP、內部閘道同關機檢查。請讀[製作證據](../evidence/iso-production/README.md)同[有限範圍啟動證據](../evidence/iso-boot/README.md)。其他硬件、韌體、持久儲存、互聯網連線同候選原生發佈驗收，都係獨立要求。[目前交接](../../HANDOFF.md)同[路線圖](../../ROADMAP.md)保留未完成狀態。

- [開始使用計劃](Getting-started.zh-HK.md)
- [常見問題](FAQ.zh-HK.md)
- [實作階段及清單](../../ROADMAP.md)
- [已確認決定及未決問題](../../DECISIONS.md)
- [Buildroot 及執行環境限制](../planning/buildroot-constraints.md)
- [依實際工作分類嘅文章目錄](../features/README.md)
- [HTTP API 流程及非 HTTP 界線](../postman/api-workflow.zh-HK.md)

目前完整來源 wiki 由文件產生流程直接收錄，唔只連到外部 wiki。獨立 GitHub wiki 來源先前回覆 `Repository not found`，同步仍未核實；呢個限制唔會由本機文章存在就當成已解決。
