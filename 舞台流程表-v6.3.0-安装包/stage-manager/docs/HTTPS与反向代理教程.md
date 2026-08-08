# HTTPS 与反向代理配置教程

## 方案一：云服务器（Nginx + Let's Encrypt，公网 HTTPS）

适用：云服务器部署 + 已绑定域名。免费证书，自动续期。

### 1. 安装 Nginx + Certbot

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

### 2. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/wutai`：

```nginx
# 入口页 18088
server {
    listen 80;
    server_name 你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:18088;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # WebSocket 支持（Tally/实时同步必须）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

启用并测试：

```bash
sudo ln -s /etc/nginx/sites-available/wutai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 3. 申请 HTTPS 证书（certbot 自动配置）

```bash
sudo certbot --nginx -d 你的域名.com
```

自动完成：证书申请 + Nginx HTTPS 配置 + 自动续期。

### 4. 多端口统一入口（可选）

一个域名 + 路径区分四个端：

```nginx
server {
    listen 443 ssl;
    server_name 你的域名.com;
    # ssl 配置由 certbot 自动生成...

    location /ctrl/ { proxy_pass http://127.0.0.1:18089/; ... }
    location /client/ { proxy_pass http://127.0.0.1:18090/; ... }
    location /screen/ { proxy_pass http://127.0.0.1:18091/; ... }
}
```

### 5. 防火墙

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

> 云服务商安全组也要放行 80/443。

## 方案二：家庭网络（Caddy + 自签证书，内网 HTTPS）

适用：Mac/局域网部署，无公网 443（家庭宽带被运营商封 443）。

### 1. 配置（Mac 已配好，见 Caddyfile）

```caddyfile
panloveli.top:8443 {
    tls internal          # 自签证书，无需公网 443
    encode zstd gzip

    handle /wutai/* { uri strip_prefix /wutai; reverse_proxy localhost:18088 }
    handle /wutai-ctrl/* { uri strip_prefix /wutai-ctrl; reverse_proxy localhost:18089 }
    handle /wutai-client/* { uri strip_prefix /wutai-client; reverse_proxy localhost:18090 }
    handle /wutai-screen/* { uri strip_prefix /wutai-screen; reverse_proxy localhost:18091 }
}
```

### 2. 访问地址

- 入口页：`https://panloveli.top:8443/wutai/`
- 控制端：`https://panloveli.top:8443/wutai-ctrl/`
- 客户端：`https://panloveli.top:8443/wutai-client/`
- 提示屏：`https://panloveli.top:8443/wutai-screen/`

### 3. 手机信任自签证书

首次访问浏览器提示"证书不受信任"：
- iOS Safari：点"继续访问"即可（或安装证书到信任库）
- Android Chrome：点"高级"→"继续前往"

### 4. 公网 HTTPS（如需）

家庭宽带若要公网 HTTPS：
1. 运营商宽带需要公网 IP + 开放 443 端口（部分运营商封锁）
2. OpenWrt 转发 443 → Mac
3. Caddy 改 `panloveli.top { tls ... }` 自动申请 Let's Encrypt
4. 或直接用 8443 端口（不依赖 443，手机流量可访问 `https://panloveli.top:8443/`）

## WebSocket 注意事项

Tally 实时同步、节目状态实时推送依赖 WebSocket（WS/WSS），**反向代理必须配置 Upgrade 头**：

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

Caddy 的 `reverse_proxy` 自动支持 WebSocket，无需额外配置。

## 安全建议

1. **不要裸暴露 18088-18091 到公网**（无 TLS 明文传输 + 无 WAF）
2. 控制端/提示屏必须设置密码（config.json 的 passwords）
3. 公网 HTTPS 优先 Let's Encrypt（免费 + 自动续期）
4. 定期备份 show.json（见备份教程）
