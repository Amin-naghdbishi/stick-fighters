# 🚀 Stick Fighters — Production Deployment Guide

This guide provides a comprehensive, step-by-step walkthrough for deploying **Stick Fighters** to the public internet under a custom domain (e.g., `https://stickfighters.com`) with a production-grade secure WebSocket game server (`wss://game.stickfighters.com/ws`).

---

## 📐 1. System Architecture Overview

Stick Fighters is built on a **two-tier architecture**: a static single-page web application (frontend) and an authoritative, real-time Node.js WebSocket game server (backend).

### Local Development Architecture
```
Player Browser
  │
  ├─► Vite HTTP Server (http://localhost:3000) ────► Serves React App
  │
  └─► WebSocket Client (/ws) ──────────────────────► Node.js Game Server (ws://localhost:3000/ws)
```

### Production Internet Architecture
```
Player Browser (https://stickfighters.com)
  │
  ├─► Static Frontend Host (Cloudflare Pages / Vercel / Nginx)
  │     └─► Serves HTML5 / React / Canvas Bundle
  │
  └─► WSS Connection (wss://game.stickfighters.com/ws)
        │
        ▼
   Nginx Reverse Proxy (VPS :443 with Let's Encrypt SSL)
        │ (Local proxy to 127.0.0.1:3000)
        ▼
   Node.js GameServer (systemd / dist/server.cjs)
        ├─► Room Manager (Isolated match state)
        ├─► Server-Authoritative Physics (30Hz tick)
        ├─► Spatial Grid Collision Engine
        └─► Bot AI Engine
```

> **Why static hosting alone (GitHub Pages / Vercel) is not enough**:
> Static hosts serve pre-compiled HTML, CSS, and JS files. They do **not** run persistent, long-running Node.js background processes or open WebSocket listener sockets. To run an authoritative game server with physics ticks, collision resolution, bot AI, and real-time multiplayer synchronization, a Virtual Private Server (VPS) is required.

---

## ⚡ 2. Quick "From Zero to Online" Checklist

Follow these 19 simple steps to bring your game live:

1. 🌐 **Buy a Domain**: Register a domain like `stickfighters.com` (Namecheap, Cloudflare, Porkbun).
2. 🖥️ **Rent a VPS**: Order an Ubuntu 22.04 LTS server from Hetzner, DigitalOcean, Linode, or AWS.
3. 🔑 **Connect via SSH**: `ssh root@<YOUR_VPS_IP>`
4. 📦 **Install Node.js & Git**: Install Node.js 18+ and Git on your VPS.
5. 📂 **Clone Repository**: `git clone https://github.com/your-username/stick-fighters.git /var/www/stick-fighters`
6. 🛠️ **Install Dependencies**: `cd /var/www/stick-fighters && npm install`
7. 🌐 **Configure DNS Records**:
   - Point `A` record `@` to your frontend host IP (or Cloudflare/Pages).
   - Point `A` record `game` to your VPS Public IP.
8. 🏗️ **Build Production Server**: `npm run build`
9. 🔒 **Configure Environment Variables**: Set `VITE_GAME_SERVER_URL=wss://game.stickfighters.com/ws`.
10. ⚙️ **Create systemd Service**: Setup `/etc/systemd/system/stickfighters.service`.
11. 🚀 **Start Game Server**: `systemctl enable --now stickfighters`
12. 🌐 **Install Nginx**: `apt install nginx certbot python3-certbot-nginx -y`
13. 📄 **Configure Nginx Site**: Create `/etc/nginx/sites-available/game.stickfighters.com`.
14. 🔒 **Obtain SSL Certificate**: Run `certbot --nginx -d game.stickfighters.com`.
15. 🛡️ **Configure Firewall (UFW)**: Allow ports 80 and 443 (`ufw allow 'Nginx Full'`).
16. 🏗️ **Build Production Frontend**: Build Vite frontend with `VITE_GAME_SERVER_URL` embedded.
17. 🚀 **Deploy Frontend**: Deploy `/dist` to Cloudflare Pages, Vercel, or Nginx.
18. 🎮 **Test Online**: Open `https://stickfighters.com` in your browser.
19. ⚔️ **Play Multiplayer**: Create a room, share the code, and play with real players!

---

## 🖥️ 3. VPS Hardware Requirements & Target Capacity

### Target Capacity Benchmark
- **Target**: **50 Simultaneous Rooms × 10 Players = 500 Concurrent Players**
- **Simulation Frequency**: 30Hz physics & network tick loop per room.
- **Bandwidth Footprint**: ~0.4 KB/s per client snapshot.

### Recommended Server Specifications

| Concurrent Players | Minimum VPS Specs | Recommended Provider | Est. Monthly Cost |
| :--- | :--- | :--- | :--- |
| **10 – 50 Players** (Small) | 1 vCPU, 1 GB RAM, 1 TB Traffic | DigitalOcean Droplet / Linode | ~$6 / month |
| **50 – 200 Players** (Medium) | 2 vCPU, 4 GB RAM, 4 TB Traffic | Hetzner CPX21 / DO | ~$12 / month |
| **200 – 500 Players** (Target) | 4 vCPU (Dedicated), 8 GB RAM, High Network | Hetzner CCX23 / DO Dedicated | ~$28 / month |

---

## 🌐 4. Domain & DNS Configuration

Configure your DNS records at your domain registrar (Cloudflare, Namecheap, Google Domains):

| Type | Name / Host | Value / Target | Description |
| :--- | :--- | :--- | :--- |
| **A** | `@` (or `www`) | `192.0.2.1` (or CNAME to Cloudflare Pages) | Frontend website address (`https://stickfighters.com`) |
| **A** | `game` | `<YOUR_VPS_PUBLIC_IP>` | Subdomain pointing to VPS (`game.stickfighters.com`) |

*Note: DNS propagation usually completes within 5 to 15 minutes.*

---

## 🔒 5. Production Nginx & SSL (HTTPS / WSS) Setup

Browsers enforce secure contexts. An `https://` page **cannot** open an insecure `ws://` connection (this triggers a **Mixed Content Error**). You must use a secure `wss://` connection.

### Step 1: Install Nginx & Certbot
On your Ubuntu VPS:
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Step 2: Create Nginx Configuration
Create file `/etc/nginx/sites-available/game.stickfighters.com`:
```nginx
server {
    server_name game.stickfighters.com;

    location /ws {
        proxy_pass http://127.0.0.1:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Disable buffering for low-latency WebSocket frames
        proxy_buffering off;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable site configuration:
```bash
sudo ln -s /etc/nginx/sites-available/game.stickfighters.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 3: Obtain Let's Encrypt SSL Certificate
```bash
sudo certbot --nginx -d game.stickfighters.com
```
Certbot automatically configures HTTPS and updates `/etc/nginx/sites-available/game.stickfighters.com` with SSL directives!

---

## ⚙️ 6. Process Management with `systemd`

To ensure the Node.js game server runs continuously in the background, automatically starts on boot, and restarts on crashes:

Create `/etc/systemd/system/stickfighters.service`:
```ini
[Unit]
Description=Stick Fighters Multiplayer Game Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/stick-fighters
ExecStart=/usr/bin/node dist/server.cjs
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000

# Security & Resource Limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

### Manage Service Commands
```bash
# Enable & Start Game Server
sudo systemctl daemon-reload
sudo systemctl enable stickfighters
sudo systemctl start stickfighters

# Check Status
sudo systemctl status stickfighters

# View Live Server Logs
sudo journalctl -u stickfighters -f -n 100

# Restart Server
sudo systemctl restart stickfighters
```

---

## 🛡️ 7. Firewall Configuration (UFW)

Expose only HTTP (80) and HTTPS (443) ports publicly. The Node.js application runs safely on `127.0.0.1:3000` behind Nginx:

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## 🛠️ 8. Production Build & Environment Variables

### Environment Variables Matrix

| Variable | Scope | Description | Development | Production Example |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Server | Internal Node.js server port | `3000` | `3000` |
| `VITE_GAME_SERVER_URL` | Frontend (Build) | Public WebSocket URL for clients | `ws://localhost:3000/ws` | `wss://game.stickfighters.com/ws` |

### Building Frontend & Server

On your build machine or VPS:
```bash
# Set production WebSocket URL
export VITE_GAME_SERVER_URL=wss://game.stickfighters.com/ws

# Build Vite client & bundle Node server
npm run build
```

This compiles:
- `dist/index.html` + `dist/assets/` (Static Client Bundle)
- `dist/server.cjs` (Standalone Node.js Game Server Bundle)

---

## 🔄 9. Continuous Deployment (CI/CD) Workflow

To push updates from your local development machine to your VPS:

### Standard Update Command
```bash
ssh root@game.stickfighters.com "cd /var/www/stick-fighters && git pull && npm install && npm run build && systemctl restart stickfighters"
```

---

## 🛡️ 10. Multiplayer Security & Authoritative Protections

Stick Fighters enforces strict server-authoritative rules:
1. **Server-Side Simulation**: All player damage, health changes, kills, deaths, knockback, weapon pickups, and respawns are calculated on the server.
2. **Input Validation**: Incoming client input packets are rate-limited to a maximum of 65 packets/second. Aim angles are clamped and normalized to $[-\pi, \pi]$.
3. **Reconnection Window**: Disconnected sockets are granted a 15-second grace window (`reconnectTimer = 15.0`) to rejoin their active room slot without losing match progress.

---

## ❓ 11. Troubleshooting Guide

### 1. Mixed Content Error (`Blocked loading mixed active content`)
- **Cause**: Trying to connect to `ws://` (unencrypted) from an `https://` page.
- **Fix**: Set `VITE_GAME_SERVER_URL=wss://game.stickfighters.com/ws` and rebuild the frontend (`npm run build`).

### 2. WebSocket Connection Refused (`ERR_CONNECTION_REFUSED`)
- **Checklist**:
  1. Is the Node.js server running? Check `systemctl status stickfighters`.
  2. Is Nginx running? Check `systemctl status nginx`.
  3. Is the port open in UFW firewall? Check `ufw status`.
  4. Is Nginx correctly proxying `/ws` to `http://127.0.0.1:3000/ws`? Check `/var/log/nginx/error.log`.

### 3. Server Restarted — UI Stuck in Room
- **Handled Automatically**: The network client detects disconnection, executes exponential backoff reconnects, and returns to the main menu if the room session was reset.

### 4. High Latency or Jitter
- **Fix**: Verify spatial partitioning (`SpatialGrid`) is active in `physics.ts` and check VPS CPU load with `top` or `htop`.
