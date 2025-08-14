# Deploying YOU YES YOU Backend (Node.js/Express + MongoDB) on Amazon EC2

This guide walks you through deploying the backend (in `server/`) to an Ubuntu EC2 instance with PM2, Nginx reverse proxy, SSL (Let’s Encrypt), environment variables, and persistent logs.

## Prerequisites

- AWS account and an Ubuntu 22.04 EC2 instance
- Security Group allowing:
  - SSH: TCP 22 (your IP only)
  - HTTP: TCP 80 (0.0.0.0/0)
  - HTTPS: TCP 443 (0.0.0.0/0)
- Domain name pointing to the instance public IP (A record)
- MongoDB Atlas URI or self-hosted MongoDB connection string

## 1) SSH into the instance

```bash
ssh -i /path/to/key.pem ubuntu@your-ec2-public-ip
```

## 2) System updates and basic tools

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install build-essential git ufw curl
```

Enable basic firewall (optional but recommended):
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

## 3) Install Node.js and PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
node -v && npm -v

sudo npm i -g pm2@latest
pm2 -v
```

## 4) Clone the repository

```bash
cd ~
git clone https://github.com/your-org/your-repo.git app
cd app/server
```

If you deploy via CI/CD, replace with your artifact sync.

## 5) Create environment file

Create `server/.env` on the instance with your production values:

```env
NODE_ENV=production
PORT=5000
MONGODB_URI="your-mongodb-connection-uri"
JWT_SECRET="a-strong-secret"
CLIENT_URL=https://your-frontend-domain
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=300
PLATFORM_API_KEY="change-me"
```

Optional (email, S3, cloud storage, external APIs) – add as needed.

## 6) Install dependencies and build

```bash
cd ~/app/server
npm ci --omit=dev
```

If you keep dev deps (e.g., TypeScript) for runtime builds, use `npm ci` without `--omit=dev`.

## 7) Start with PM2

```bash
pm2 start server.js --name youyesyou-api
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Inspect logs:
```bash
pm2 logs youyesyou-api --lines 200
```

## 8) Install and configure Nginx reverse proxy

```bash
sudo apt -y install nginx
sudo rm -f /etc/nginx/sites-enabled/default
```

Create `/etc/nginx/sites-available/youyesyou`:

```nginx
server {
  listen 80;
  server_name your-api-domain.com;

  location /health {
    proxy_pass http://127.0.0.1:5000/health;
  }

  location / {
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_cache_bypass $http_upgrade;
    proxy_pass http://127.0.0.1:5000;
  }
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/youyesyou /etc/nginx/sites-enabled/youyesyou
sudo nginx -t && sudo systemctl reload nginx
```

## 9) Enable HTTPS with Let’s Encrypt (Certbot)

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d your-api-domain.com --non-interactive --agree-tos -m admin@your-domain.com --redirect
```

Certificates auto-renew via systemd timer. Test renewal:
```bash
sudo certbot renew --dry-run
```

## 10) Health checks and monitoring

- Health endpoint: `https://your-api-domain.com/health`
- PM2 Monitoring: `pm2 monit`
- PM2 Log rotation (optional):
  ```bash
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:retain 14
  pm2 set pm2-logrotate:max_size 50M
  ```

## 11) CORS and client URLs

In `server/server.js` CORS is domain-aware via `NODE_ENV`. For production, set `CLIENT_URL` or add your domains in the CORS allow list and Socket.IO `cors.origin`.

## 12) MongoDB considerations

- Prefer MongoDB Atlas with VPC peering or IP allowlist for EC2 public IP
- Ensure `MONGODB_URI` includes retryWrites and TLS where appropriate

## 13) Zero-downtime updates

```bash
cd ~/app
git pull --rebase
cd server
npm ci --omit=dev
pm2 reload youyesyou-api
```

## 14) Troubleshooting

- Check PM2 logs: `pm2 logs youyesyou-api`
- Check Nginx logs: `/var/log/nginx/error.log`
- Verify service: `curl -I http://127.0.0.1:5000/health`
- Firewall/Security Groups: ensure ports 80/443 open; 22 restricted

## 15) Optional hardening

- Fail2ban, SSH key-only auth, disable root login
- Nginx rate limiting and WAF/CDN (Cloudflare)
- Rotate secrets and API keys regularly

---

Deployment complete. Your API should be reachable at `https://your-api-domain.com` with PM2 managing the Node process and Nginx terminating TLS.


