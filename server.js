import express from 'express';
import open from 'open';
import crypto from 'crypto';
import { readFileSync, existsSync } from 'fs';

// ── Load .env manually (no extra dependency) ──────────────────────────
function loadEnv(path = '.env') {
  if (!existsSync(path)) return;
  const lines = readFileSync(path, 'utf-8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

// ── Config ────────────────────────────────────────────────────────────
const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const PORT          = Number(process.env.PORT) || 4202;
const REDIRECT_URI  = `http://127.0.0.1:${PORT}/callback`;
const SCOPES        = 'user-read-currently-playing user-read-playback-state';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env');
  process.exit(1);
}

console.log('  Redirect URI:', REDIRECT_URI);

// ── Token state ───────────────────────────────────────────────────────
let accessToken  = null;
let refreshToken = null;
let tokenExpiry  = 0;

// ── Express app ───────────────────────────────────────────────────────
const app = express();
app.use(express.static('.'));            // serves overlay.html, style.css, etc.

// --- Auth: kick off Spotify login ---
app.get('/login', (_req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// --- Auth: Spotify redirects here ---
app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.send(`Auth error: ${error}`);

  try {
    const tokens = await exchangeCode(code);
    accessToken  = tokens.access_token;
    refreshToken = tokens.refresh_token;
    tokenExpiry  = Date.now() + tokens.expires_in * 1000;
    res.send('<h2>Authenticated! You can close this tab.</h2><script>window.close()</script>');
  } catch (err) {
    console.error('Token exchange failed:', err);
    res.status(500).send('Token exchange failed');
  }
});

// --- API: current track data for the overlay ---
app.get('/now-playing', async (_req, res) => {
  if (!accessToken) return res.json({ playing: false });

  try {
    await ensureFreshToken();
    const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 204 || response.status === 202) {
      return res.json({ playing: false });
    }
    if (!response.ok) {
      console.error('Spotify API error', response.status);
      return res.json({ playing: false });
    }

    const data = await response.json();
    if (!data || !data.item) return res.json({ playing: false });

    const track = data.item;

    // Fetch the queue for the next upcoming song
    let nextTitle = null;
    let nextArtist = null;
    try {
      const queueRes = await fetch('https://api.spotify.com/v1/me/player/queue', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (queueRes.ok) {
        const queueData = await queueRes.json();
        const next = queueData.queue?.[0];
        if (next) {
          nextTitle = next.name;
          nextArtist = next.artists.map(a => a.name).join(', ');
        }
      }
    } catch { /* queue fetch is best-effort */ }

    res.json({
      playing: data.is_playing,
      title: track.name,
      artist: track.artists.map(a => a.name).join(', '),
      album: track.album.name,
      albumArt: track.album.images[0]?.url ?? null,
      progressMs: data.progress_ms,
      durationMs: track.duration_ms,
      nextTitle,
      nextArtist,
    });
  } catch (err) {
    console.error('Error fetching now-playing:', err.message);
    res.json({ playing: false });
  }
});

// ── Spotify token helpers ─────────────────────────────────────────────
async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  });
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body,
  });
  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Token exchange: ${resp.status} — ${errBody}`);
  }
  return resp.json();
}

async function refreshAccessToken() {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
    },
    body,
  });
  if (!resp.ok) throw new Error(`Token refresh: ${resp.status}`);
  const data = await resp.json();
  accessToken = data.access_token;
  if (data.refresh_token) refreshToken = data.refresh_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;
}

async function ensureFreshToken() {
  if (Date.now() > tokenExpiry - 60_000) {
    await refreshAccessToken();
  }
}

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  Spotify Widget running at http://127.0.0.1:${PORT}`);
  console.log(`  OBS browser source URL:   http://127.0.0.1:${PORT}/overlay.html`);
  console.log(`\n  Opening browser to authenticate with Spotify...\n`);
  open(`http://127.0.0.1:${PORT}/login`);
});
