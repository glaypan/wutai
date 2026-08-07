// vj 静态文件服务器（端口 18092）
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, 'web');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.mp4':'video/mp4', '.svg':'image/svg+xml' };
http.createServer((req, res) => {
  let p = req.url === '/' ? '/index.html' : req.url;
  let fp = path.join(ROOT, p);
  if (!fs.existsSync(fp)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
  res.end(fs.readFileSync(fp));
}).listen(18092, '0.0.0.0');
console.log('vj 静态服务 http://0.0.0.0:18092');
