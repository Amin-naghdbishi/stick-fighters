import express from 'express';
import http from 'http';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { WebSocketServer } from 'ws';
import { GameServer } from './server/gameServer.js';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(app);

  app.use(express.json());

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: Date.now() });
  });

  // Attach WebSocket Server
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16384 });
  const gameServer = new GameServer();

  wss.on('connection', (ws) => {
    gameServer.handleConnection(ws);
  });

  // Handle process shutdown signals gracefully
  const handleShutdown = (signal: string) => {
    console.log(`Received ${signal}. Shutting down HTTP & WebSocket server...`);
    gameServer.shutdown();
    wss.clients.forEach((client) => {
      try {
        client.close(1001, 'Server Shutting Down');
      } catch (e) {}
    });
    wss.close();
    server.close(() => {
      console.log('HTTP & WebSocket server closed cleanly.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`Stick Fighters game server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
