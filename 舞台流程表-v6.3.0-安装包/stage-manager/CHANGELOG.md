# wutai 舞台流程表 v6.3.0 更新说明

## 版本：6.3.0（2026-08-08）

### 🏗️ 项目中心（多场次管理，方案B）

1. **多项目存储**：projects/index.json 索引 + projects/{id}.json 独立存档，show.json 保持当前活动项目快照（旧数据自动迁移，零改动兼容）
2. **项目中心 UI**：控制端工具栏 📁 项目按钮 → 项目列表（搜索/归档过滤/状态色/类型徽章）+ 新建/复制/重命名/归档/删除
3. **演出模式锁定**：performance 模式下禁止切换项目（服务端拦截 + 前端提示）
4. **项目另存为**：每项目 💾 另存为按钮 → 下载 .stageproject 工程包（与导入工程包互通）

### 📡 Tally 信号系统增强

5. **节目单 Tally 预设**：每个节目可独立设置（启用开关/目标角色多选/提前秒数/触发时机），GO 推进时自动触发；节目列表 🔔 标记
6. **多 Tally 共存**：同一时间多个活跃 Tally 同时显示多个横幅（独立拖动/缩放/确认），节目单 Tally 与实时手动 Tally 并存
7. **全屏闪光边框**：接收端界面边缘角色专属颜色脉冲呼吸（助理蓝/幕后绿/控台橙/导演紫），不遮挡中央内容
8. **未确认持续提醒**：未确认 Tally 每 10 秒重发 tally_remind，横幅重放闪烁 + 页面隐藏时标题闪烁
9. **倒计时预警**：trigger=before_end 的节目在剩余 ≤ leadSec 时自动 toast + 发 Tally（控制端/导演端防重复）
10. **Tally 横幅/面板可自由拖动和缩放**：位置大小记忆到 localStorage

### 🔧 修复与加固（claude-sonnet-5 代码审查）

11. createProject 空参数兜底
12. switchProject 索引更新不被旧数据覆盖
13. copyProject 不误读当前活动项目数据
14. deleteProject 保护当前项目 + default 项目（前后端双拦截）
15. renameProject 重命名落盘
16. renderTally/tallyId 判空、flashProgramCard 参数校验
17. Tally 定时器防重复启动
18. 项目列表请求防重复（并发锁）

### 📦 发布

- Release: wutai-v6.3.0
- 下载: https://github.com/glaypan/wutai/releases/download/wutai-v6.3.0/wutai-server.zip
