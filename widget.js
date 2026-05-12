const POLL_INTERVAL = 3000;           // ms between Spotify API polls

// ── Theme from query string (?theme=compact | ?theme=minimal) ─────────
const params = new URLSearchParams(window.location.search);
const theme  = params.get('theme');
if (theme) document.getElementById('widget').classList.add(`theme-${theme}`);

const widget       = document.getElementById('widget');
const albumArt     = document.getElementById('album-art');
const titleSpan    = document.querySelector('#title span');
const artistEl     = document.getElementById('artist');
const progressFill = document.getElementById('progress-fill');
const timeCurrent  = document.getElementById('time-current');
const timeTotal    = document.getElementById('time-total');
const nextTrackEl  = document.getElementById('next-track');
const spotifyCode  = document.getElementById('spotify-code');
const showNameEl   = document.getElementById('show-name');

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

    titleSpan.textContent  = data.title;
    artistEl.textContent   = isEpisode ? '' : data.artist;
    showNameEl.textContent = isEpisode ? data.show : '';

    // Only update art when the track changes (avoid flicker)
    const trackId = `${data.title}|${data.artist}`;
    if (trackId !== lastTrackId) {
      albumArt.src = data.albumArt ?? '';
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
    timeTotal.textContent   = formatMs(data.durationMs);

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

// Kick off polling
poll();
setInterval(poll, POLL_INTERVAL);
