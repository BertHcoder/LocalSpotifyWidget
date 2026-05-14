const POLL_INTERVAL = 3000;           // ms between Spotify API polls

// ── Settings (loaded from server, query params override) ──────────────
let theme = null;
let fixedColor = null;
let adaptive = true;
let showProgress = true;
let showNext = true;
let showCode = true;
let opacity = 100;
let textColor = null;

const widget = document.getElementById('widget');
const albumArt = document.getElementById('album-art');
const titleSpan = document.querySelector('#title span');
const artistEl = document.getElementById('artist');
const progressFill = document.getElementById('progress-fill');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const nextTrackEl = document.getElementById('next-track');
const spotifyCode = document.getElementById('spotify-code');
const showNameEl = document.getElementById('show-name');
const timeRow = document.getElementById('time-row');

function resolveColor(input) {
  const key = input.toLowerCase().replace(/[^a-z0-9#]/g, '');
  if (COLOR_NAMES[key]) return COLOR_NAMES[key];
  const hex = key.replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return hex;
  return null;
}

function isLightColor(hex) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6;
}

function applyTextColor(bgHex) {
  // If user set a manual text color, use it
  if (textColor) {
    const hex = resolveColor(textColor);
    if (hex) {
      widget.style.setProperty('--text-color', `#${hex}`);
      widget.style.setProperty('--muted-color', `#${hex}cc`);
      return;
    }
  }
  // Auto-contrast: dark text on light backgrounds
  if (bgHex && isLightColor(bgHex)) {
    widget.style.setProperty('--text-color', '#000000');
    widget.style.setProperty('--muted-color', '#333333');
  } else {
    widget.style.setProperty('--text-color', '#ffffff');
    widget.style.setProperty('--muted-color', '#b3b3b3');
  }
}

function bgAlpha() {
  return opacity >= 100 ? 1 : 0.55;
}

function applySettings() {
  // Theme
  widget.className = widget.className.replace(/\btheme-\S+/g, '').trim();
  if (theme) widget.classList.add(`theme-${theme}`);

  const alpha = bgAlpha();
  const defaultBg = `rgba(18, 18, 18, ${alpha})`;

  // Color — always set inline background so CSS defaults never leak through
  if (fixedColor) {
    const hex = resolveColor(fixedColor);
    if (hex) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const bg = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      widget.style.setProperty('--adaptive-bg', bg);
      widget.style.background = bg;
      widget.classList.add('adaptive');
      applyTextColor(hex);
    }
    adaptive = false;
  } else if (adaptive) {
    widget.classList.add('adaptive');
    widget.style.setProperty('--adaptive-bg', defaultBg);
    // extractColor will override --adaptive-bg with actual album color
    widget.style.background = `var(--adaptive-bg, ${defaultBg})`;
    applyTextColor('121212'); // default dark, will be updated by extractColor
  } else {
    widget.classList.remove('adaptive');
    widget.style.removeProperty('--adaptive-bg');
    widget.style.background = defaultBg;
    applyTextColor('121212');
  }

  // Visibility toggles
  if (timeRow) timeRow.style.display = showProgress ? '' : 'none';
  if (nextTrackEl) nextTrackEl.style.display = showNext ? '' : 'none';
  if (spotifyCode) spotifyCode.style.display = showCode ? '' : 'none';

  // Opacity (only reduce when transparency is enabled)
  widget.style.opacity = Math.max(0.1, Math.min(1, opacity / 100));
}

async function loadSettings() {
  // Load from server
  try {
    const res = await fetch('/settings');
    const s = await res.json();
    theme = s.theme || null;
    if (s.colorMode === 'fixed' && s.fixedColor) {
      fixedColor = s.fixedColor;
      adaptive = false;
    } else if (s.colorMode === 'none') {
      adaptive = false;
      fixedColor = null;
    } else {
      adaptive = true;
      fixedColor = null;
    }
    showProgress = s.showProgress !== false;
    showNext = s.showNext !== false;
    showCode = s.showCode !== false;
    opacity = s.opacity ?? 100;
    textColor = s.textColor || null;
  } catch { /* defaults are fine */ }

  // Query params override server settings
  const params = new URLSearchParams(window.location.search);
  if (params.has('theme')) theme = params.get('theme');
  if (params.has('color')) { fixedColor = params.get('color'); adaptive = false; }
  if (params.has('adaptive')) adaptive = params.get('adaptive') !== 'false';

  applySettings();
}

let lastTrackId = null;

async function poll() {
  try {
    const res = await fetch('/now-playing');
    const data = await res.json();

    if (!data.playing) {
      widget.classList.add('hidden');
      return;
    }

    widget.classList.remove('hidden');
    const isEpisode = data.type === 'episode';
    widget.classList.toggle('podcast', isEpisode);

    titleSpan.textContent = data.title;
    artistEl.textContent = isEpisode ? '' : data.artist;
    showNameEl.textContent = isEpisode ? data.show : '';

    // Only update art when the track changes (avoid flicker)
    const trackId = `${data.title}|${data.artist}`;
    if (trackId !== lastTrackId) {
      albumArt.src = data.albumArt ?? '';
      if (adaptive && data.albumArt) extractColor(data.albumArt);
      // Spotify Code: scannable barcode for the current track
      if (data.trackUri) {
        spotifyCode.src = `https://scannables.scdn.co/uri/plain/png/121212/white/256/${data.trackUri}`;
        spotifyCode.classList.remove('hidden');
      } else {
        spotifyCode.classList.add('hidden');
      }
      lastTrackId = trackId;
      applyMarquee();
    }

    // Progress bar
    const pct = data.durationMs ? (data.progressMs / data.durationMs) * 100 : 0;
    progressFill.style.width = `${pct}%`;

    // Time display
    timeCurrent.textContent = formatMs(data.progressMs);
    timeTotal.textContent = formatMs(data.durationMs);

    // Next track
    if (data.nextTitle) {
      nextTrackEl.textContent = `Next: ${data.nextTitle} — ${data.nextArtist}`;
    } else {
      nextTrackEl.textContent = '';
    }
  } catch {
    // server probably not ready yet — keep trying
  }
}

function formatMs(ms) {
  if (!ms) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function applyMarquee() {
  const wrap = document.getElementById('title');
  titleSpan.classList.remove('scrolling');
  // If the text overflows its container, enable marquee scrolling
  requestAnimationFrame(() => {
    if (titleSpan.scrollWidth > wrap.clientWidth) {
      // Duplicate text for seamless loop
      titleSpan.textContent = `${titleSpan.textContent}   \u2022   ${titleSpan.textContent}   \u2022   `;
      titleSpan.classList.add('scrolling');
    }
  });
}

// ── Dominant-color extraction ─────────────────────────────────────────
function extractColor(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    // Sample at 1px for speed
    canvas.width = 1;
    canvas.height = 1;
    ctx.drawImage(img, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const bg = `rgba(${r}, ${g}, ${b}, ${bgAlpha()})`;
    widget.style.setProperty('--adaptive-bg', bg);
    widget.style.background = bg;
    widget.classList.add('adaptive');
    const hex = [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
    applyTextColor(hex);
  };
  img.src = url;
}

// ── SSE: auto-apply settings pushed from server ───────────────────────
function connectSettingsStream() {
  const es = new EventSource('/settings-stream');
  es.onmessage = (event) => {
    try {
      const s = JSON.parse(event.data);
      theme = s.theme || null;
      if (s.colorMode === 'fixed' && s.fixedColor) {
        fixedColor = s.fixedColor;
        adaptive = false;
      } else if (s.colorMode === 'none') {
        adaptive = false;
        fixedColor = null;
      } else {
        adaptive = true;
        fixedColor = null;
      }
      showProgress = s.showProgress !== false;
      showNext = s.showNext !== false;
      showCode = s.showCode !== false;
      opacity = s.opacity ?? 100;
      textColor = s.textColor || null;
      applySettings();
      // Re-extract color for current album art if switching to adaptive
      if (adaptive && albumArt.src) extractColor(albumArt.src);
      lastTrackId = null; // force full UI refresh on next poll
    } catch { /* ignore malformed events */ }
  };
}

// Kick off: load settings, connect SSE, then start polling
loadSettings().then(() => {
  connectSettingsStream();
  poll();
  setInterval(poll, POLL_INTERVAL);
});
