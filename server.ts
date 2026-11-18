import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CHANNEL_ID = 'temanggung-tv';
const DEFAULT_SRT_URL = 'srt://103.79.90.150:5320';
const STREAM_ROOT = '/tmp/temanggung-hls';
const IDLE_TIMEOUT_MS = 180_000; // Stop ffmpeg if no viewer fetches for 3 minutes

interface RelayState {
  channelId: string;
  srtUrl: string;
  dir: string;
  process: ChildProcess | null;
  starting: Promise<boolean> | null;
  lastAccessAt: number;
  status: 'idle' | 'connecting' | 'live' | 'error';
  lastError: string | null;
  startedAt: number | null;
  restartCount: number;
}

const relays = new Map<string, RelayState>();

function normalizeSrtUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  const match = /^srt:\/\/([a-zA-Z0-9.-]+):(\d{1,5})(\?.*)?$/i.exec(trimmed);
  if (!match) return null;
  const host = match[1];
  const port = Number(match[2]);
  if (port < 1 || port > 65535) return null;
  const existingQuery = match[3] ?? '';
  if (existingQuery) {
    return `srt://${host}:${port}${existingQuery}`;
  }
  return `srt://${host}:${port}?mode=caller&transtype=live&latency=350000`;
}

function sanitizeChannelId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return clean.slice(0, 64) || DEFAULT_CHANNEL_ID;
}

function ensureCleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'v1080p'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'v720p'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'v480p'), { recursive: true });
}

function waitForFile(filePath: string, timeoutMs: number): Promise<boolean> {
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      try {
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          if (stat.size > 40) {
            resolve(true);
            return;
          }
        }
      } catch {
        // Ignore transient fs errors during atomic write
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(check, 350);
    };
    check();
  });
}

function stopRelay(relay: RelayState): void {
  if (relay.process && !relay.process.killed) {
    relay.process.kill('SIGTERM');
  }
  relay.process = null;
  relay.starting = null;
  relay.status = 'idle';
  relay.startedAt = null;
}

async function ensureRelayRunning(channelId: string, rawSrtUrl?: string): Promise<RelayState> {
  const id = sanitizeChannelId(channelId);
  let relay = relays.get(id);

  if (!relay) {
    const srtUrl = rawSrtUrl ? normalizeSrtUrl(rawSrtUrl) : normalizeSrtUrl(DEFAULT_SRT_URL);
    if (!srtUrl) {
      throw new Error('Format alamat SRT tidak valid. Gunakan srt://host:port');
    }
    // Keep active custom relays bounded to avoid excessive CPU usage
    if (id !== DEFAULT_CHANNEL_ID && relays.size >= 3) {
      for (const [key, existing] of relays.entries()) {
        if (key !== DEFAULT_CHANNEL_ID && Date.now() - existing.lastAccessAt > 30_000) {
          stopRelay(existing);
          relays.delete(key);
        }
      }
    }
    relay = {
      channelId: id,
      srtUrl,
      dir: path.join(STREAM_ROOT, id),
      process: null,
      starting: null,
      lastAccessAt: Date.now(),
      status: 'idle',
      lastError: null,
      startedAt: null,
      restartCount: 0,
    };
    relays.set(id, relay);
  } else if (rawSrtUrl) {
    const normalized = normalizeSrtUrl(rawSrtUrl);
    if (normalized && normalized !== relay.srtUrl) {
      stopRelay(relay);
      relay.srtUrl = normalized;
    }
  }

  relay.lastAccessAt = Date.now();

  if (relay.process && !relay.process.killed && relay.status === 'live') {
    return relay;
  }

  if (relay.starting) {
    await relay.starting;
    return relay;
  }

  relay.starting = (async () => {
    relay!.status = 'connecting';
    relay!.lastError = null;
    ensureCleanDir(relay!.dir);

    // Build ABR multi-variant HLS pipeline:
    // v0: 1080p Asli (copy video + audio, zero transcode overhead)
    // v1: 720p HD (2000k, ultrafast zerolatency)
    // v2: 480p Lancar / Hemat Kuota (850k, ultrafast zerolatency for mobile 3G/4G)
    const args = [
      '-hide_banner',
      '-loglevel', 'warning',
      '-fflags', '+genpts+discardcorrupt',
      '-flags', 'low_delay',
      '-analyzeduration', '3000000',
      '-probesize', '3000000',
      '-rw_timeout', '8000000',
      '-i', relay!.srtUrl,
      '-filter_complex', '[0:v:0]split=2[v1][v2];[v1]scale=-2:720[v720];[v2]scale=-2:480[v480]',
      // Stream 0: 1080p Original Copy
      '-map', '0:v:0', '-map', '0:a:0',
      '-c:v:0', 'copy',
      '-c:a:0', 'copy',
      // Stream 1: 720p Mobile HD
      '-map', '[v720]', '-map', '0:a:0',
      '-c:v:1', 'libx264', '-preset:v:1', 'ultrafast', '-tune:v:1', 'zerolatency',
      '-profile:v:1', 'main',
      '-b:v:1', '2000k', '-maxrate:v:1', '2400k', '-bufsize:v:1', '4000k',
      '-g:v:1', '50', '-keyint_min:v:1', '50', '-sc_threshold:v:1', '0',
      '-c:a:1', 'aac', '-b:a:1', '128k', '-ac:a:1', '2',
      // Stream 2: 480p Smooth / Data Saver
      '-map', '[v480]', '-map', '0:a:0',
      '-c:v:2', 'libx264', '-preset:v:2', 'ultrafast', '-tune:v:2', 'zerolatency',
      '-profile:v:2', 'main',
      '-b:v:2', '850k', '-maxrate:v:2', '1050k', '-bufsize:v:2', '1700k',
      '-g:v:2', '50', '-keyint_min:v:2', '50', '-sc_threshold:v:2', '0',
      '-c:a:2', 'aac', '-b:a:2', '96k', '-ac:a:2', '2',
      // HLS Output
      '-f', 'hls',
      '-hls_time', '2',
      '-hls_list_size', '6',
      '-hls_flags', 'delete_segments+independent_segments+program_date_time',
      '-hls_segment_filename', path.join(relay!.dir, 'v%v/seg_%05d.ts'),
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', 'v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p',
      path.join(relay!.dir, 'v%v/stream.m3u8'),
    ];

    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    relay!.process = proc;
    relay!.startedAt = Date.now();

    let stderrTail = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-1500);
    });

    proc.on('exit', (code, signal) => {
      if (relay!.process === proc) {
        relay!.process = null;
        if (signal !== 'SIGTERM') {
          relay!.status = 'error';
          relay!.lastError = stderrTail.trim() || `Koneksi SRT terputus (kode ${code ?? 'unknown'})`;
        } else {
          relay!.status = 'idle';
        }
      }
    });

    const masterPath = path.join(relay!.dir, 'master.m3u8');
    const v0Playlist = path.join(relay!.dir, 'v1080p/stream.m3u8');
    const v2Playlist = path.join(relay!.dir, 'v480p/stream.m3u8');

    const ready = await Promise.all([
      waitForFile(masterPath, 16_000),
      waitForFile(v0Playlist, 16_000),
      waitForFile(v2Playlist, 16_000),
    ]);

    if (ready[0] && (ready[1] || ready[2])) {
      // Rewrite master playlist to include friendly resolution & bandwidth hints if needed
      relay!.status = 'live';
      relay!.starting = null;
      return true;
    }

    relay!.status = 'error';
    relay!.lastError = stderrTail.trim() || 'Sumber SRT belum merespons dalam 16 detik.';
    relay!.starting = null;
    return false;
  })();

  await relay.starting;
  return relay;
}

// Periodically reap idle relays so server stays lean
setInterval(() => {
  const now = Date.now();
  for (const relay of relays.values()) {
    if (relay.process && now - relay.lastAccessAt > IDLE_TIMEOUT_MS) {
      stopRelay(relay);
    }
  }
}, 30_000);

async function startServer(): Promise<void> {
  fs.mkdirSync(STREAM_ROOT, { recursive: true });

  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'temanggung-tv-relay' });
  });

  app.get('/api/stream/status', (req: Request, res: Response) => {
    const channelId = sanitizeChannelId(String(req.query.channelId || DEFAULT_CHANNEL_ID));
    const relay = relays.get(channelId);
    res.json({
      channelId,
      srtUrl: relay?.srtUrl ?? DEFAULT_SRT_URL,
      status: relay?.status ?? 'idle',
      lastError: relay?.lastError ?? null,
      uptimeSec: relay?.startedAt ? Math.floor((Date.now() - relay.startedAt) / 1000) : 0,
    });
  });

  app.post('/api/stream/restart', async (req: Request, res: Response) => {
    try {
      const channelId = sanitizeChannelId(String(req.body?.channelId || DEFAULT_CHANNEL_ID));
      const srtUrl = typeof req.body?.srtUrl === 'string' ? req.body.srtUrl : undefined;
      const existing = relays.get(channelId);
      if (existing) {
        stopRelay(existing);
        existing.restartCount += 1;
      }
      const relay = await ensureRelayRunning(channelId, srtUrl);
      res.json({
        ok: relay.status === 'live',
        status: relay.status,
        lastError: relay.lastError,
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Gagal memulai ulang siaran',
      });
    }
  });

  // Serve HLS master playlist, variant playlists, and TS segments
  app.get('/api/stream/:channelId/*', async (req: Request, res: Response) => {
    try {
      const channelId = sanitizeChannelId(String(req.params.channelId || DEFAULT_CHANNEL_ID));
      const requestedSrt = typeof req.query.srt === 'string' ? req.query.srt : undefined;
      const relPath = req.params[0] || 'master.m3u8';

      // Prevent path traversal
      if (relPath.includes('..') || !/^[a-zA-Z0-9_./-]+$/.test(relPath)) {
        res.status(400).send('Invalid stream path');
        return;
      }

      const relay = await ensureRelayRunning(channelId, requestedSrt);
      const fullPath = path.join(relay.dir, relPath);
      if (!fullPath.startsWith(relay.dir)) {
        res.status(403).send('Forbidden');
        return;
      }

      if (!fs.existsSync(fullPath)) {
        if (relPath.endsWith('.m3u8')) {
          const appeared = await waitForFile(fullPath, 6000);
          if (!appeared) {
            res.status(503).json({
              error: relay.lastError || 'Siaran sedang menghubungkan ke server SRT Temanggung TV...',
              status: relay.status,
            });
            return;
          }
        } else {
          res.status(404).send('Segment expired');
          return;
        }
      }

      res.setHeader('Access-Control-Allow-Origin', '*');

      if (relPath.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        let content = fs.readFileSync(fullPath, 'utf-8');
        if (relPath === 'master.m3u8') {
          content = content.replace(/BANDWIDTH=(\d+)(,RESOLUTION=1920x1080)/g, (_m, bw, rest) => {
            const numericBw = Number(bw);
            return `BANDWIDTH=${numericBw < 100000 ? 7500000 : numericBw}${rest}`;
          });
        }
        res.send(content);
        return;
      }

      if (relPath.endsWith('.ts')) {
        res.setHeader('Content-Type', 'video/mp2t');
        res.setHeader('Cache-Control', 'public, max-age=10');
        res.sendFile(fullPath);
        return;
      }

      res.sendFile(fullPath);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Stream relay error',
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production' || !fs.existsSync(path.join(__dirname, 'src'));
  const distDir = path.join(__dirname, 'dist');

  if (!isProd && fs.existsSync(path.join(__dirname, 'index.html'))) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Temanggung TV server listening on http://0.0.0.0:${port}`);
    // Pre-warm primary Temanggung TV SRT relay in background for fast first play
    ensureRelayRunning(DEFAULT_CHANNEL_ID, DEFAULT_SRT_URL).catch((err) => {
      console.error('Initial SRT warm-up warning:', err);
    });
  });

  const cleanup = () => {
    for (const relay of relays.values()) {
      stopRelay(relay);
    }
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startServer().catch((err) => {
  console.error('Failed to start Temanggung TV server:', err);
  process.exit(1);
});
