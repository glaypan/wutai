#!/data/data/com.termux/files/usr/bin/bash
# wutai 一键启动（简单可靠版）
cd ~/server/wutai
nohup node server-standalone.js >> ~/server/wutai.log 2>&1 &
echo "wutai 已启动，端口 18088"
