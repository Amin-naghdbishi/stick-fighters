# 🥊 Stick Fighters

**Stick Fighters** is a fast-paced, real-time multiplayer 2D fighting game featuring server-authoritative physics, 10 weapons (including 3 Super Weapons), 9 arenas (including 3 expansive Mystery Maps), 5 bot AI difficulty levels, and an expanded 10-layer Character Customization system.

---

## 🚀 Quick Start & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Server (App + WebSocket Game Server)
```bash
npm run dev
```
The server starts at `http://0.0.0.0:3000` with WebSocket endpoint at `ws://localhost:3000/ws`.

### 3. Production Build & Execution
```bash
# Build Vite client & bundle Node server
npm run build

# Start production server
npm run start
```

---

## 🧪 Server Load & Stress Testing

A lightweight load-testing utility is included under `scripts/loadTest.ts` to simulate multiple concurrent rooms and WebSocket connections.

```bash
# Simulate 50 Rooms with 10 Players each (500 Concurrent Clients)
npx tsx scripts/loadTest.ts 50 10 ws://localhost:3000/ws
```

### Options:
- `arg 1`: Target rooms count (Default: `10`)
- `arg 2`: Players per room (Default: `4`)
- `arg 3`: WebSocket URL (Default: `ws://localhost:3000/ws`)

---

## 🛠️ Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP & WebSocket server port | `3000` |
| `VITE_GAME_SERVER_URL` | Custom external WebSocket server URL (e.g. `wss://game.example.com/ws`) | Auto-detected from `window.location` |

---

## 🏗️ Project Architecture

```
Client (React + HTML5 Canvas)
  └─► NetworkClient (src/game/network.ts)
        │
        ▼ (WebSocket /ws)
Server (Express + ws) (server/gameServer.ts)
  ├─► Room Manager (Isolated Room Instances)
  ├─► Physics & Collision Engine (src/game/physics.ts)
  ├─► Bot AI Engine (src/game/botDifficulty.ts)
  └─► Tick Snapshot Broadcast (~30Hz)
        │
        ▼ (Client Interpolation)
GameRenderer (src/game/renderer.ts)
  ├─► Layered Character Vector Drawing (Skin, Hair, Headwear, Outfit, Capes, Shoes, Accessories, Effects)
  ├─► Dynamic Environmental Backdrop & Objects
  └─► Particle Systems & Muzzle Flares
```

---

## 🎮 Game Controls

- **Move Left / Right**: `A` / `D` or `Left Arrow` / `Right Arrow`
- **Jump / Double Jump**: `W`, `Up Arrow`, or `Spacebar`
- **Drop Platform**: `S` or `Down Arrow`
- **Fast Punch**: `J` or `Z`
- **Heavy Kick**: `K` or `X`
- **Block / Shield**: `L`, `C`, or `Shift`
- **Fire Active Weapon**: `F` or `Left Mouse Click`
- **Aim Direction**: `Mouse Cursor`
- **Switch Weapons**: `Q` / `E`, `Mouse Scroll Wheel`, or `1-9` keys
- **Toggle Scoreboard**: `Tab`
- **Return to Menu**: `Escape`
