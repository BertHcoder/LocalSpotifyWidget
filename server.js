import express from 'express';
import open from 'open';
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { startTray } from './tray.js';

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
const PORT = Number(process.env.PORT) || 4202;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'user-read-currently-playing user-read-playback-state';

function getClientId() {
    return loadSettings().clientId || '';
}

// ── Token state ───────────────────────────────────────────────────────
const TOKEN_FILE = 'tokens.json';
let accessToken = null;
let refreshToken = null;
let tokenExpiry = 0;

function loadTokens() {
    try {
        if (existsSync(TOKEN_FILE)) {
            const data = JSON.parse(readFileSync(TOKEN_FILE, 'utf-8'));
            accessToken = data.accessToken ?? null;
            refreshToken = data.refreshToken ?? null;
            tokenExpiry = data.tokenExpiry ?? 0;
        }
    } catch { /* ignore corrupt file */ }
}

function saveTokens() {
    writeFileSync(TOKEN_FILE, JSON.stringify({ accessToken, refreshToken, tokenExpiry }, null, 2));
}

loadTokens();

function clearTokens() {
    accessToken = null;
    refreshToken = null;
    tokenExpiry = 0;
    saveTokens();
}

// Last error returned by the Spotify API, shown on the settings page
let lastApiError = null;

// ── PKCE helpers ──────────────────────────────────────────────────────
let pendingLogin = null; // { state, codeVerifier } for the login in progress

function generateCodeVerifier() {
    return crypto.randomBytes(64).toString('base64url');
}

function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ── Settings persistence ──────────────────────────────────────────────
const SETTINGS_FILE = 'settings.json';
const DEFAULT_SETTINGS = {
    clientId: '',
    theme: '',
    colorMode: 'adaptive',
    fixedColor: '',
    textColor: '',
    showProgress: true,
    showNext: true,
    showCode: true,
    showAlbum: false,
    opacity: 100,
};

function loadSettings() {
    try {
        if (existsSync(SETTINGS_FILE)) {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')) };
        }
    } catch { /* fall through */ }
    return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
    // Merge with what's saved, so a partial update (e.g. only clientId) keeps the rest
    const current = loadSettings();
    const safe = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        safe[key] = settings[key] ?? current[key];
    }
    writeFileSync(SETTINGS_FILE, JSON.stringify(safe, null, 2));
    return safe;
}

// ── Express app ───────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// CORS: only allow requests from this server's own origin
app.use((req, res, next) => {
    const allowed = `http://127.0.0.1:${PORT}`;
    const origin = req.headers.origin;
    if (!origin || origin === allowed) {
        res.setHeader('Access-Control-Allow-Origin', allowed);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).end();
    next();
});

// Block sensitive files from being served statically
app.use((req, res, next) => {
    const blocked = ['/tokens.json', '/settings.json', '/.env'];
    if (blocked.includes(req.path.toLowerCase())) {
        return res.status(404).end();
    }
    next();
});

app.use(express.static('.'));            // serves overlay.html, style.css, etc.

// --- Auth: kick off Spotify login (PKCE) ---
app.get('/login', (_req, res) => {
    const clientId = getClientId();
    if (!clientId) {
        return res.redirect('/settings.html?error=missing_client_id');
    }
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = generateCodeVerifier();
    pendingLogin = { state, codeVerifier };
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        state,
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
    });
    res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// --- Auth: Spotify redirects here ---
// Problems are sent back to the settings page, which explains them in plain language.
function authError(res, code, detail) {
    const params = new URLSearchParams({ error: code });
    if (detail) params.set('detail', detail);
    res.redirect(`/settings.html?${params}`);
}

app.get('/callback', async (req, res) => {
    const { code, error, state } = req.query;
    const login = pendingLogin;
    pendingLogin = null;
    if (error) return authError(res, String(error));
    if (!login || state !== login.state || !code) return authError(res, 'login_expired');

    try {
        const tokens = await exchangeCode(String(code), login.codeVerifier);
        accessToken = tokens.access_token;
        refreshToken = tokens.refresh_token;
        tokenExpiry = Date.now() + tokens.expires_in * 1000;
        lastApiError = null;
        saveTokens();
        console.log('Authenticated successfully!');
        res.redirect('/settings.html?connected=1');
    } catch (err) {
        console.error('Token exchange failed:', err.message ?? err);
        authError(res, 'token_exchange', err.message ?? String(err));
    }
});

// --- API: auth status ---
app.get('/auth-status', (_req, res) => {
    res.json({
        authenticated: !!accessToken,
        hasClientId: !!getClientId(),
        redirectUri: REDIRECT_URI,
        apiError: lastApiError,
        tokenExpiry: tokenExpiry || null,
        expiresIn: tokenExpiry ? Math.max(0, tokenExpiry - Date.now()) : null,
    });
});

// --- API: logout (clear tokens) ---
app.post('/logout', (_req, res) => {
    clearTokens();
    lastApiError = null;
    res.json({ ok: true });
});

// --- API: quit (graceful shutdown, used by tray icon) ---
app.post('/quit', (_req, res) => {
    res.json({ ok: true });
    setTimeout(() => process.exit(0), 200);
});

// --- API: auto-start (Windows startup registry) ---
// Only offered for the packaged .exe; from source there is no single file to launch.
const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
const REG_NAME = 'SpotifyWidget';
const AUTOSTART_SUPPORTED = process.platform === 'win32' && !!process.pkg;

app.get('/autostart', (_req, res) => {
    if (!AUTOSTART_SUPPORTED) return res.json({ supported: false });
    try {
        const out = execFileSync(
            'reg', ['query', REG_KEY, '/v', REG_NAME],
            { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );
        res.json({ supported: true, enabled: out.includes(REG_NAME) });
    } catch {
        res.json({ supported: true, enabled: false });
    }
});

app.post('/autostart', (req, res) => {
    if (!AUTOSTART_SUPPORTED) return res.json({ supported: false });
    const { enabled } = req.body;
    try {
        if (enabled) {
            execFileSync(
                'reg', ['add', REG_KEY, '/v', REG_NAME, '/t', 'REG_SZ', '/d', `"${process.execPath}" --autostart`, '/f'],
                { stdio: ['pipe', 'pipe', 'pipe'] }
            );
        } else {
            execFileSync(
                'reg', ['delete', REG_KEY, '/v', REG_NAME, '/f'],
                { stdio: ['pipe', 'pipe', 'pipe'] }
            );
        }
        res.json({ ok: true, enabled: !!enabled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- SSE: push settings changes to overlay clients ---
const sseClients = new Set();

app.get('/settings-stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });
    res.write('\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
});

function broadcastSettings(settings) {
    const payload = `data: ${JSON.stringify(settings)}\n\n`;
    for (const client of sseClients) {
        client.write(payload);
    }
}

// --- API: settings ---
app.get('/settings', (_req, res) => {
    res.json(loadSettings());
});

app.post('/settings', (req, res) => {
    try {
        const saved = saveSettings(req.body);
        broadcastSettings(saved);
        res.json(saved);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API: current track data for the overlay ---
let nowPlayingCache = null;
let nowPlayingCacheTime = 0;
const CACHE_TTL = 2500; // ms

app.get('/now-playing', async (_req, res) => {
    if (!accessToken) return res.json({ playing: false });

    // Return cached response if still fresh
    if (nowPlayingCache && (Date.now() - nowPlayingCacheTime) < CACHE_TTL) {
        return res.json(nowPlayingCache);
    }

    try {
        await ensureFreshToken();
        const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (response.ok) lastApiError = null;
        if (response.status === 204 || response.status === 202) {
            nowPlayingCache = { playing: false };
            nowPlayingCacheTime = Date.now();
            return res.json(nowPlayingCache);
        }
        if (!response.ok) {
            let message = '';
            try { message = (await response.json()).error?.message ?? ''; } catch { /* no JSON body */ }
            console.error('Spotify API error', response.status, message);
            lastApiError = { status: response.status, message };
            return res.json({ playing: false });
        }

        const data = await response.json();
        if (!data || !data.item) {
            nowPlayingCache = { playing: false };
            nowPlayingCacheTime = Date.now();
            return res.json(nowPlayingCache);
        }

        const item = data.item;
        const isEpisode = item.type === 'episode';

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
                    nextArtist = next.type === 'episode'
                        ? next.show?.name ?? null
                        : next.artists.map(a => a.name).join(', ');
                }
            }
        } catch { /* queue fetch is best-effort */ }

        const result = {
            playing: data.is_playing,
            type: isEpisode ? 'episode' : 'track',
            title: item.name,
            artist: isEpisode ? null : item.artists.map(a => a.name).join(', '),
            show: isEpisode ? (item.show?.name ?? null) : null,
            album: isEpisode ? null : item.album.name,
            albumArt: isEpisode
                ? (item.images?.[0]?.url ?? item.show?.images?.[0]?.url ?? null)
                : (item.album.images[0]?.url ?? null),
            progressMs: data.progress_ms,
            durationMs: item.duration_ms,
            trackUri: item.uri ?? null,
            nextTitle,
            nextArtist,
        };
        nowPlayingCache = result;
        nowPlayingCacheTime = Date.now();
        res.json(result);
    } catch (err) {
        console.error('Error fetching now-playing:', err.message);
        lastApiError = { status: null, message: err.message };
        res.json({ playing: false });
    }
});

// ── Spotify token helpers (PKCE — no client secret) ──────────────────
async function tokenError(resp) {
    const text = await resp.text();
    try {
        const body = JSON.parse(text);
        return `${body.error_description || body.error} (HTTP ${resp.status})`;
    } catch {
        return `HTTP ${resp.status}${text ? ` — ${text}` : ''}`;
    }
}

async function exchangeCode(code, codeVerifier) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: getClientId(),
        code_verifier: codeVerifier,
    });
    const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!resp.ok) throw new Error(await tokenError(resp));
    return resp.json();
}

async function refreshAccessToken() {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: getClientId(),
    });
    const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
    });
    if (!resp.ok) {
        const message = await tokenError(resp);
        // Spotify rejected the saved login (revoked, or Client ID changed): ask for a fresh login
        if (resp.status === 400 || resp.status === 401) clearTokens();
        throw new Error(`Token refresh: ${message}`);
    }
    const data = await resp.json();
    accessToken = data.access_token;
    if (data.refresh_token) refreshToken = data.refresh_token;
    tokenExpiry = Date.now() + data.expires_in * 1000;
    saveTokens();
}

async function ensureFreshToken() {
    if (Date.now() > tokenExpiry - 60_000) {
        await refreshAccessToken();
    }
}

// ── Start ─────────────────────────────────────────────────────────────
const trayMode = process.pkg || process.argv.includes('--tray');
const launchedAtLogin = process.argv.includes('--autostart');
const SETTINGS_URL = `http://127.0.0.1:${PORT}/settings.html`;

async function isWidgetAlreadyRunning() {
    try {
        const res = await fetch(`http://127.0.0.1:${PORT}/auth-status`, { signal: AbortSignal.timeout(2000) });
        return 'authenticated' in (await res.json());
    } catch {
        return false;
    }
}

// The packaged exe's console window closes on exit, so keep it open until the error is read
function exitWithError(message) {
    console.error(`\n  ${message}\n`);
    if (!process.pkg) process.exit(1);
    console.error('  Press Enter to close this window.');
    process.stdin.resume();
    process.stdin.once('data', () => process.exit(1));
}

app.listen(PORT, async (err) => {
    if (err?.code === 'EADDRINUSE') {
        // Launching a second time just opens the settings of the copy that is already running
        if (await isWidgetAlreadyRunning()) {
            console.log('\n  Spotify Widget is already running — opening the settings page.\n');
            if (!launchedAtLogin) await open(SETTINGS_URL);
            process.exit(0);
        }
        return exitWithError(
            `Port ${PORT} is already in use by another program.\n` +
            '  Pick another port by creating a file named .env next to the widget containing e.g. PORT=4203,\n' +
            '  then change the Redirect URI of your Spotify app to http://127.0.0.1:4203/callback.'
        );
    }
    if (err) return exitWithError(`Could not start the widget: ${err.message}`);

    console.log(`\n  Spotify Widget running at http://127.0.0.1:${PORT}`);
    console.log(`  Settings:                 ${SETTINGS_URL}`);
    console.log(`  OBS browser source URL:   http://127.0.0.1:${PORT}/overlay.html`);

    if (refreshToken) {
        try {
            await ensureFreshToken();
            console.log('  Restored session from saved tokens — no login needed.');
        } catch (e) {
            // Network hiccups keep the saved login; a rejected login is cleared by refreshAccessToken
            console.log(`  Could not refresh the Spotify login: ${e.message}`);
        }
    }

    // First run (or the saved login was rejected): open the setup page, also in tray mode
    if (!refreshToken) {
        console.log('  Not logged in yet — opening the settings page to get you set up.');
        open(SETTINGS_URL);
    }

    // Start system tray icon (packaged exe or --tray flag)
    if (trayMode) {
        startTray(PORT, { showNotice: !launchedAtLogin, canAutostart: AUTOSTART_SUPPORTED });
        console.log('  System tray icon active — right-click to access menu.');
    }

    console.log();
});
