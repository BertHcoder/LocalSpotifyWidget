# Spotify Widget Local

A minimal, fully local "Now Playing" overlay for OBS Studio.  
Shows the current Spotify track (title, artist, album art, progress bar) as a browser source.

---

## Prerequisites

- **Node.js** 18+
- A **Spotify Developer App** (free) — see setup below

---

## 1. Create a Spotify App

1. Go to <https://developer.spotify.com/dashboard> and log in.
2. Click **Create App**.
3. Set the **Redirect URI** to `http://localhost:3000/callback`.
4. Note your **Client ID** and **Client Secret**.

## 2. Configure

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
SPOTIFY_CLIENT_ID=<your client id>
SPOTIFY_CLIENT_SECRET=<your client secret>
PORT=3000
```

## 3. Install & Run

```bash
npm install
npm start
```

On first run the server opens your browser to authenticate with Spotify.  
After granting permission you can close the browser tab.

## 4. Add to OBS

1. In OBS, add a **Browser Source**.
2. Set the URL to: `http://localhost:3000/overlay.html`
3. Set width to **400** and height to **110** (adjust to taste).
4. Uncheck **Shutdown source when not visible** so the widget keeps polling.
5. Position the source wherever you like on your scene.

---

## How It Works

```
  ┌────────────┐  polls /now-playing   ┌──────────────┐  Spotify API
  │ OBS Browser│ ◄──────────────────── │  Express      │ ──────────►
  │   Source    │      JSON             │  server.js    │  /v1/me/player
  └────────────┘                       └──────────────┘
```

- `server.js` — Express server that handles OAuth and proxies the Spotify API.
- `overlay.html` / `style.css` / `widget.js` — the overlay OBS displays.
- The overlay polls the local server every 3 seconds for track data.
