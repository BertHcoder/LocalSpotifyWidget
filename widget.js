const POLL_INTERVAL = 3000;           // ms between Spotify API polls

const widget       = document.getElementById('widget');
const albumArt     = document.getElementById('album-art');
const titleSpan    = document.querySelector('#title span');
const artistEl     = document.getElementById('artist');
const progressFill = document.getElementById('progress-fill');

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
    titleSpan.textContent  = data.title;
    artistEl.textContent   = data.artist;

    // Only update art when the track changes (avoid flicker)
    const trackId = `${data.title}|${data.artist}`;
    if (trackId !== lastTrackId) {
      albumArt.src = data.albumArt ?? '';
      lastTrackId = trackId;
      applyMarquee();
    }

    // Progress bar
    const pct = data.durationMs ? (data.progressMs / data.durationMs) * 100 : 0;
    progressFill.style.width = `${pct}%`;
  } catch {
    // server probably not ready yet — keep trying
  }
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
