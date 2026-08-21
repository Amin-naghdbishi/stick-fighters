# My Suggestions

## Critical Improvements

- **WebSocket Direct Room Indexing**: `[IMPLEMENTED]`
  - *Details*: Each room maintains a `Set<ConnectedClient>` in `roomClients`. Room broadcasts now iterate only through socket connections belonging to that specific room ($O(K_{\text{room}})$ complexity instead of $O(N_{\text{total}})$ server scan across 500+ clients).
  - *Priority*: **CRITICAL**

- **Delta Snapshot Compression**: `[IMPLEMENTED]`
  - *Details*: High-frequency (30Hz) physics tick payloads send compact dynamic state (`players`, `projectiles`, `weaponSpawns`, `burningGround`, `matchTimeRemaining`, `roundTimer`, `status`, `countdown`, `winnerId`) while static arena layouts and metadata are transmitted only on state transitions.
  - *Priority*: **CRITICAL**

---

## Multiplayer Improvements

- **Client-Side Input Rate Limiting & Validation**: `[IMPLEMENTED]`
  - *Details*: Input payloads are sanitized on the server. `aimAngle` is normalized to $[-\pi, \pi]$, movement controls are coerced to booleans, and packet rates are capped at 65 packets/sec per socket to prevent malformed data or spam attacks.
  - *Priority*: **HIGH**

- **Server-Side Reconnection Window**: `[IMPLEMENTED]`
  - *Details*: When a player's WebSocket drops during a match, a 15-second grace window is granted (`reconnectTimer = 15.0`). Reconnecting players resume their exact player slot, score, health, position, and active inventory without losing progress or spawning duplicate ghost fighters.
  - *Priority*: **HIGH**

---

## Performance Improvements

- **Spatial Partitioning for Projectile & Melee Collisions**: `[IMPLEMENTED]`
  - *Details*: Added a 220px cell `SpatialGrid` in `src/game/physics.ts`. In high-projectile scenarios or large Mystery Maps, projectile collision candidate checks are evaluated against local grid cells ($O(P \times K_{\text{cell}})$) instead of testing all fighters.
  - *Priority*: **HIGH**

- **Canvas Viewport Resize Throttle**: `[IMPLEMENTED]`
  - *Details*: Removed `updateSize()` layout-measuring calls from the 60Hz animation loop in `GameCanvasView.tsx`. Viewport bounds are measured on initial load and updated asynchronously via `ResizeObserver` and window resize listeners.
  - *Priority*: **HIGH**

---

## Gameplay Improvements

- **Super Weapon Spawn Announcer & Indicator**:
  - *Recommendation*: Display a prominent screen-top comic banner (e.g., *"⚡ THUNDER SWORD HAS SPAWNED!"*) with a directional arrow indicator pointing toward the super weapon spawn location when a Super Weapon becomes available.
  - *Rationale*: Increases map movement dynamics and battle tension by encouraging all players to contest the Super Weapon.
  - *Priority*: **MEDIUM**

- **Dynamic Environment Hazards**:
  - *Recommendation*: Introduce active environmental traps in Mystery Maps (e.g., rising lava in `mystery_volcanic`, falling lightning bolts in `mystery_mountain`, or crumbling vine bridges in `mystery_jungle`).
  - *Rationale*: Adds emergent environmental gameplay elements that keep matches unpredictable and engaging.
  - *Priority*: **LOW**

---

## UI/UX Improvements

- **Interactive Kill Feed**:
  - *Recommendation*: Add a top-right scrolling kill feed (e.g., `Player 1 [Thunder Sword ⚡] Bot-1`).
  - *Rationale*: Gives immediate visual feedback on multi-kills, weapon dominance, and combat action across large arenas.
  - *Priority*: **MEDIUM**

- **Custom Keybinding Remapping**:
  - *Recommendation*: Provide a keybinding settings tab in the menu allowing players to rebind Movement, Jump, Punch, Kick, Shield, and Fire controls to custom keys or gamepad buttons.
  - *Rationale*: Enhances accessibility and comfort for players with non-standard keyboard layouts (e.g., AZERTY).
  - *Priority*: **LOW**

---

## Content Suggestions

- **New Weapons**:
  - *Grappling Hook Blaster*: Pulls the player toward terrain platforms or pulls enemies closer.
  - *Gravity Well Cannon*: Creates a localized black hole that pulls nearby players into a damage cluster.
  - *Portal Gun*: Places twin teleport portals across the map.
  - *Priority*: **FUTURE**

- **Tournament & Ranked Modes**:
  - *8-Player Single-Elimination Bracket*: Automated lobby tournament progression with victory trophies.
  - *Priority*: **FUTURE**

---

## Long-Term Architecture

- **Multi-Node Cluster Scaling with Redis Pub/Sub**:
  - *Recommendation*: Decouple HTTP/WebSocket connection termination from game loop room state using a Redis pub/sub backplane or dedicated room worker threads.
  - *Rationale*: Allows scaling from a single Node.js process to multiple server instances behind a load balancer, supporting thousands of concurrent rooms seamlessly.
  - *Priority*: **FUTURE**
