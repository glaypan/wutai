# 舞台流程表 v6.0.3

## 新增与改进

- 内置 PDF.js、Tesseract.js 和中英文 OCR 资源；导入面板显示 `PDFJS_READY` / `OCR_READY`。
- 新增 `/api/ocr-status`，并修复 `.traineddata.gz` 的 gzip 响应头。
- 新增节目批量选择、全选和二次确认删除。
- 新增 `addDel` 角色权限；控制端默认启用，其他角色默认关闭。
- 节目编辑器使用“类型下拉框 + 添加按钮”创建话筒和线路，并与全局类型同步。
- 彩排使用正计时，可暂停、继续和结束保存；演出使用倒计时，可优先使用彩排实测时长。
- 节目计划时长和彩排实测时长统一按分钟显示和编辑。
- 时间轴新增 Cue 状态徽章、下一 Cue 倒计时和触发状态重置。
- 桌面工具栏重组为五个功能组；手机端增加四项底部导航、安全区和全屏操作抽屉。

## 安装

从 GitHub Release 下载 `stage-manager-v6.0.3-all-platforms.zip` 或 `.tar.gz`，完整解压后运行对应平台启动脚本。安装包不包含 `show.json`、`config.json` 等现场数据。

## 升级

1. 备份旧版本目录中的 `show.json`、`show.json.bak` 和 `config.json`。
2. 将 v6.0.3 解压到新目录并先启动一次。
3. 停止服务器，再按需迁移自己的数据文件。
4. 启动后检查节目、角色权限、端口、OCR 状态和 Cue 设置。

不要把新版本文件直接混合覆盖到正在运行的旧目录。

## 兼容平台

- Windows 10/11
- macOS 10.14.6 及更高版本，Intel 与 Apple Silicon
- Linux、树莓派、OpenWrt
- Android Termux
- iPhone、iPad、Android 手机和平板网页端

## 校验

Release 页面提供 SHA-256。下载后应先核对哈希，再用于正式演出环境。

## 2026-07-31 优化追加说明

本次在 v6.0.3 基础上完成系统性测试与多端优化，详细报告见 [OPTIMIZATION-REPORT-v6.0.3.md](OPTIMIZATION-REPORT-v6.0.3.md)。**未修改兼容性承诺**，主要变更：

- **服务端**：`server-standalone.js` 与 `server.js` 新增 `tessFileCache` 内存缓存，OCR 资源首次读盘后缓存 `{headers, data}`，后续请求直接从内存返回；`server.js` 补齐 `.traineddata.gz` 的 `Content-Encoding: gzip` 响应头。
- **核心**：`stage-core.js` 新增 4 个 ES5 内部辅助函数（`applyTimerActionInternal`/`collectEnabledTracks`/`filterPendingCues`/`sortByOffsetMs`），消除 `finishRehearsal` 二次归一化与 `nextCueSnapshot`/`collectDueCues` 重复过滤；对外 API 21 项不变；保持纯 ES5 写法兼容 Safari 14/旧 V8。
- **前端 UI**：`app-source.html` 与 `public/style.css` 新增 9 个 CSS token（5 间距 + 4 圆角），工具栏与移动端导航 token 化；暗色主题 `--text-2`/`--text-3` 对比度提升至 7.6:1/4.8:1（WCAG AA）；为 `.edit-panel` 与 `.modal-box` 新增 transform/opacity 过渡动画。
- **验证**：5 平台（Windows/macOS Intel+ARM/Linux/Termux/iOS+Android）静态兼容性验证全部通过；4 个测试文件全部断言模式静态命中；`verify-release.js` 静态校验通过（仅内嵌 HTML base64 字节比对需运行时补验）。
- **环境限制**：本次开发机 PowerShell ExecutionPolicy=Restricted 阻断运行时命令，发布前需解除限制并执行 `npm test` / `npm run verify` 完成运行时回归。
