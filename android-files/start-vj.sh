#!/data/data/com.termux/files/usr/bin/bash
# vj 静态服务一键启动（端口 18092）
cd ~/server
nohup node static-server.js >> ~/server/vj.log 2>&1 &
echo "vj 已启动，端口 18092"
