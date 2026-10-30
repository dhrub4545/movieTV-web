# MovieTV Web Application (React.js)

A high-performance cinematic web application for **MovieTV**, built with **React 19**, **Vite**, **Tailwind CSS**, and **Hls.js**, mirroring 100% of the functional capabilities of the Android TV/Mobile client with an ultra-responsive web interface.

---

## 🌟 Features Implemented (Exact Mobile App Parity)

### 1. Feeds & Categorization
- **Indian Cinema**: Latest releases from Bollywood, South Indian (Tamil, Telugu, Malayalam, Kannada), and Punjabi industries.
- **Global Cinema**: Hollywood and international releases.
- **Series & Shows**: Web series with seasons and episodes browser.
- **Live TV**: 24/7 channels categorized by `Sports`, `News`, `Movies`, `Entertainment`, `Music`, and `Kids`.

### 2. High-Performance Caching & Auto-Refresh
- **In-Memory Tab Cache**: Instant tab switching without refetching (`tabCaches` with 5-minute TTL).
- **Infinite Scrolling**: Lazy pagination (`limit=40`) triggered automatically near bottom of feed.
- **Background Auto-Refresh**: Auto-refreshes page 1 every 5 minutes when at top of feed.
- **Window Resume Auto-Refresh**: Auto-checks and refreshes if returning after 3+ minutes.

### 3. Content Filtering & Quality Badges
- **18+ Content Filtering**: Filters out adult/erotic terms while preserving legitimate titles like Yash's *Toxic*.
- **Quality Badges**:
  - `HDCAM` (Amber/Orange badge)
  - `4K` (Purple/Indigo badge)
  - `HD` (Apple Blue badge)
- **TMDB Poster Optimization**: Automatic rewrite of `/w500/` and `/original/` to `/w342/` for 50%+ lower memory usage.

### 4. Series & Shows Details Modal
- Full backdrop banner with gradient overlay.
- Poster, rating, release year, category, overview, and duration.
- **"▶ Play S1:E1"** primary action button.
- Horizontal scrollable seasons tabs with episode counts.
- Vertical episode list with direct play resolution.

### 5. Live TV & Real-Time Sync
- Filter channels by categories (`All`, `Sports`, `News`, `Movies`, `Entertainment`, `Music`, `Kids`).
- **"Sync Channels (GitHub)"**: Triggers real-time sync with upstream GitHub M3U repositories (`/api/channels?refresh=true`).
- Channel cards with channel logo, country badge, category, and 1080p stream badge.

### 6. Multi-Server Stream Chooser
- Queries `/api/stream/resolve` dynamically.
- Server Options:
  - **Server 1: Primary Stream (Direct HLS)**: High-speed native HLS streaming.
  - **Server 2: Alternate Player (Live HLS)**: Secondary live HLS extraction.
  - **Server 3: Web Stream (Watch Embed)**: Embed player protected by Brave Shield.

### 7. Advanced Cinema Video Player
- **Hls.js Integration**: Low-latency HLS streaming engine with worker support and native Safari HLS fallback.
- **200% Audio Boost**: Web Audio API (`AudioContext` + `GainNode`) boosting volume up to 200% (+12dB) with gold/red visual HUD.
- **Screen Brightness HUD**: Adjustable brightness filter (10% to 150%) with centered sun HUD.
- **VLC-Style HUD**: Glassmorphic center HUD for volume, brightness, seek indicator, and aspect ratio.
- **Aspect Ratio Cycling**:
  - `Fit Screen` (contain)
  - `Fill Screen / Zoom` (cover)
  - `Stretch` (fill)
  - `16:9 Match Width`
- **Audio & Subtitles Switcher**: In-player track selector dialogs.
- **Double-Click Seeks**: Left double-click seeks -10s, right double-click seeks +10s with ripple waves.
- **Token Expiration Healing**: Automatic detection of expired tokens (`s`/`e`, `kx`, `exp`, `token`) and auto-refresh stream.
- **Backend M3U8 Saver**: Automatically posts working streams to `/api/stream/save-m3u8`.
- **Keyboard Shortcuts**:
  - `Space` / `K`: Play / Pause
  - `←` / `J`: Seek backward 10s
  - `→` / `L`: Seek forward 10s
  - `↑` / `↓`: Volume +/- 5%
  - `F`: Toggle Fullscreen
  - `M`: Toggle Mute
  - `Esc`: Close player / modal

### 8. Backend Configuration & Offline Support
- Default server: `https://movietvbackend.vercel.app/`
- Modal to edit backend server URL, test live latency, and persist to `localStorage`.
- Automatic filter of legacy `192.168.100.14` IP.

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd frontend-web
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Production Build & Preview
```bash
npm run build
npm run preview
```

---

## ☁️ Deploying to Vercel

This repository is fully configured and ready for 1-click or automated Git-based deployment on [Vercel](https://vercel.com):

### Option 1: Automatic Git Deployment (Recommended)
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Import the GitHub repository: `https://github.com/dhrub4545/movieTV-web`.
4. Vercel will automatically detect `Vite` as the framework from `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. *(Optional)* In **Environment Variables**, add:
   - `VITE_API_URL`: `https://movietvbackend.vercel.app` (defaults to this automatically if omitted).
6. Click **Deploy**.

### Option 2: Deploy via Vercel CLI
```bash
npx vercel
# Follow prompts to link project and deploy
npx vercel --prod
```

### Included Serverless Functions on Vercel
- `/api/extract-m3u8`: Live real-time extraction of `.m3u8` direct streaming URLs from upstream hosts (Vidaraa, Hubstream, HDStream4u, Multicloudlinks).
- `/api/local-proxy`: Stream proxy with custom headers and referer handling for restrictive video hosts.

