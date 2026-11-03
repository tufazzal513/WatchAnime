import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const GO_PORT = 3001;
const GO_HOST = '127.0.0.1';

let goProcess: ChildProcess | null = null;

function ensureGoBinary(): string {
  const binPath = path.join(__dirname, 'backend', 'bin', 'movex');
  if (fs.existsSync(binPath)) {
    try {
      fs.chmodSync(binPath, 0o755);
    } catch {
      // ignore permissions error if already set
    }
    return binPath;
  }
  throw new Error(`MoveX Go binary not found at ${binPath}. Please run: go build -o bin/movex ./cmd/movex inside /backend`);
}

function startGoBackend(): Promise<void> {
  return new Promise((resolve, reject) => {
    const binPath = ensureGoBinary();
    console.log(`[MoveX] Starting Go backend service on port ${GO_PORT}...`);

    const env = {
      ...process.env,
      PORT: String(GO_PORT),
      ROLE: process.env.ROLE || 'main',
      DATA_DIR: process.env.DATA_DIR || path.join(__dirname, 'data'),
      DEV_INSECURE_AUTH: process.env.DEV_INSECURE_AUTH || 'false',
    };

    goProcess = spawn(binPath, ['serve'], {
      cwd: path.join(__dirname, 'backend'),
      env,
      stdio: ['ignore', 'inherit', 'inherit'],
    });

    goProcess.on('error', (err) => {
      console.error('[MoveX] Failed to spawn Go backend:', err);
      reject(err);
    });

    goProcess.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        console.error(`[MoveX] Go backend process exited with code ${code}`);
      }
    });

    // Poll health check until Go backend responds
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds total
    const checkInterval = setInterval(() => {
      attempts++;
      const req = http.get(`http://${GO_HOST}:${GO_PORT}/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(checkInterval);
          console.log(`[MoveX] Go backend is healthy and listening on port ${GO_PORT}`);
          resolve();
        }
      });

      req.on('error', () => {
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          reject(new Error(`Timed out waiting for Go backend on port ${GO_PORT}`));
        }
      });
    }, 100);
  });
}

function proxyRequestToGo(req: express.Request, res: express.Response) {
  const options: http.RequestOptions = {
    hostname: GO_HOST,
    port: GO_PORT,
    path: req.originalUrl,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${GO_HOST}:${GO_PORT}`,
      'x-forwarded-for': req.headers['x-forwarded-for'] || req.socket.remoteAddress || '',
      'x-forwarded-proto': req.headers['x-forwarded-proto'] || 'http',
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[MoveX Proxy Error] ${req.method} ${req.originalUrl}:`, err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Go backend unreachable', details: err.message });
    }
  });

  req.pipe(proxyReq);
}

async function startServer() {
  await startGoBackend();

  const app = express();
  const frontendDir = path.join(__dirname, 'frontend');

  // 1. Proxy API & Admin & System Routes directly to Go Backend
  app.all('/api/*', proxyRequestToGo);
  app.all('/admin*', proxyRequestToGo);
  app.all('/health', proxyRequestToGo);
  app.all('/servers', proxyRequestToGo);

  // 2. Serve static frontend files
  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/admin')) {
        return next();
      }
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => {
      res.send('MoveX Platform running. Frontend directory not found.');
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MoveX] Unified server listening at http://0.0.0.0:${PORT}`);
    console.log(`  - Frontend App: http://localhost:${PORT}/`);
    console.log(`  - Admin SSR:    http://localhost:${PORT}/admin/`);
    console.log(`  - User API:     http://localhost:${PORT}/api/v1/movies`);
  });

  const cleanup = () => {
    console.log('[MoveX] Shutting down services...');
    server.close();
    if (goProcess && !goProcess.killed) {
      goProcess.kill('SIGTERM');
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startServer().catch((err) => {
  console.error('[MoveX] Fatal initialization error:', err);
  if (goProcess && !goProcess.killed) {
    goProcess.kill('SIGTERM');
  }
  process.exit(1);
});
