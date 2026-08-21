# Stick Fighters — Engineering Suggestions & VPS Deployment Guidelines

This document outlines key technical recommendations and performance guidelines for hosting Stick Fighters on a production VPS targeting **50 simultaneous rooms × 10 players = 500 concurrent players (500 CCU)**.

---

## 1. CRITICAL Priority (Must Have for 500 CCU)

1. **OS File Descriptor Limit (`ulimit -n`)**:
   - *Rationale*: Linux processes by default have `ulimit -n 1024`. At 500 WebSocket connections + HTTP requests + node runtime sockets, the server can run out of file descriptors.
   - *Action*: In `/etc/security/limits.conf` or the systemd service file, set:
     ```ini
     [Service]
     LimitNOFILE=65536
     ```
2. **Reverse Proxy WebSocket Keepalive**:
   - *Rationale*: Nginx must maintain open TCP WebSocket pipes without prematurely closing inactive sockets.
   - *Action*: Ensure Nginx configuration includes:
     ```nginx
     location /ws {
         proxy_pass http://127.0.0.1:3000/ws;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection "Upgrade";
         proxy_read_timeout 3600s;
         proxy_send_timeout 3600s;
     }
     ```

---

## 2. HIGH Priority (Reliability & Latency)

1. **Node.js Process Management with Systemd or PM2**:
   - Run the game server as a managed service with auto-restart on memory limit or abnormal exit:
     ```ini
     [Unit]
     Description=Stick Fighters Multiplayer Game Server
     After=network.target

     [Service]
     Type=simple
     User=stickfighters
     WorkingDirectory=/var/www/stickfighters
     ExecStart=/usr/bin/node dist/server.cjs
     Restart=always
     RestartSec=5
     Environment=NODE_ENV=production PORT=3000
     MemoryMax=1G

     [Install]
     WantedBy=multi-user.target
     ```
2. **Delta Snapshot Compression (Implemented)**:
   - Dynamic `TickSnapshot` with `TickFighterDelta[]` reduces 30Hz network traffic from **37.5 MB/s down to ~4.5 MB/s**, saving 88% bandwidth.

---

## 3. MEDIUM Priority (Performance & Polish)

1. **Client-Side Linear Interpolation (Implemented)**:
   - Remote players smooth between 30Hz server ticks using framerate-independent positional lerp (`dt * 25`), eliminating micro-stutter on 60Hz/144Hz monitors.
2. **Object Pooling for Visual Particles (Implemented)**:
   - Reusable bounded particle arrays prevent heap churn and garbage collection pauses during rapid 10-player weapon brawls.

---

## 4. LOW Priority (Quality of Life)

1. **Automated Health Check Monitoring**:
   - Use `/api/health` endpoint with Uptime Kuma or Prometheus to monitor server uptime and response latency.
2. **Rate Limiting Protection (Implemented)**:
   - Enforces 100 packets/sec per socket limit to prevent malicious packet flooding attacks.

---

## 5. FUTURE Priority (Long-term Scaling Beyond 500 CCU)

1. **Multi-Core Worker Threads / Node Cluster**:
   - If player concurrency grows to 2,000+ players (200+ rooms), utilize Node.js `worker_threads` to divide room simulation sets across all available CPU cores.
2. **Geographic Regional Server Clustering**:
   - Deploy lightweight edge servers (e.g., US-East, Europe, Asia) with matchmaking routing players to the lowest-ping regional server.
