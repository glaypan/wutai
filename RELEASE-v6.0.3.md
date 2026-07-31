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
