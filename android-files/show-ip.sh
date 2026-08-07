#!/data/data/com.termux/files/usr/bin/bash
# 显示当前 IP 地址（wutai 服务访问地址）
# 支持：Termux 终端直接跑（打印文字）+ 桌面小组件（通知显示）

IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v "127.0.0.1" | awk '{print $2}' | head -1)

MSG="IP: $IP
入口: http://$IP:18088
控制: http://$IP:18089
客户端: http://$IP:18090
提示屏: http://$IP:18091
vj: http://$IP:18092/VJ-studio.html"

# 终端跑：打印
echo "=== 本机 IP 地址 ==="
echo "  $IP"
echo ""
echo "=== wutai 访问地址 ==="
echo "  入口页: http://$IP:18088"
echo "  控制端: http://$IP:18089/?role=control"
echo "  客户端: http://$IP:18090"
echo "  提示屏: http://$IP:18091"
echo "  vj视频: http://$IP:18092/VJ-studio.html"

# 桌面小组件跑：弹通知
if command -v termux-toast >/dev/null 2>&1; then
  echo -e "$MSG" | termux-toast 2>/dev/null
fi
