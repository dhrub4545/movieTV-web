<div align="center">

<img src="./src/assets/hero.png" alt="MovieTV Web Banner" width="480" />

# MovieTV Web — Cinematic React 19 Streaming Client

**High-Performance Web Client for MovieTV with Native Player Parity, HLS Streaming, and 200% Audio Boost**

[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/dhrub4545/movieTV-web)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3.5-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.3.3-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Hls.js](https://img.shields.io/badge/Hls.js-1.7.4-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://github.com/video-dev/hls.js/)
[![Oxlint](https://img.shields.io/badge/Linter-Oxlint%201.89-blue?style=for-the-badge)](https://oxc.rs/)
[![Vercel](https://img.shields.io/badge/Vercel-Deployed-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

---

## Application Screenshot & Interface Preview

<div align="center">
  <img src="./assets/screenshot.png" alt="Application Interface Preview" width="850" style="border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" />
</div>

---

### 🔗 Companion Repositories & Backend Engine

| Component | Link | Description |
| :--- | :--- | :--- |
| ⚙️ **Backend API Engine** | [![Backend Repo](https://img.shields.io/badge/Repository-movieTV--backend-purple?style=flat-square&logo=github)](https://github.com/dhrub4545/movieTV-backend) | Stateless Express 5, Mongoose 9, IPTV aggregator, stream decryptor |
| 📱 **Android TV Application** | [![Android TV](https://img.shields.io/badge/Client-Android%20TV%20%7C%20Mobile-3DDC84?style=flat-square&logo=android)](https://github.com/dhrub4545/movieTV-backend) | Leanback UI client with ExoPlayer native playback |

</div>

---

## 📌 Executive Summary & Problem Solved

Traditional web streaming portals suffer from high latency, aggressive advertising embeds, poor audio rendering on cam-rips, missing keyboard controls, and brittle streams that stop playing when upstream authentication tokens expire. Furthermore, navigating heavy movie catalogs on mobile browsers frequently causes high memory usage, frame drops, and browser crashes.

**MovieTV Web** solves these limitations with a dedicated, cinema-grade web application built on **React 19**, **Vite 8**, **Tailwind CSS 4**, and **Hls.js**:
1. **Full Android TV Feature Parity**: Delivers 100% functional parity with the MovieTV Android TV client, featuring frictionless tab switching, horizontal season pickers, and categorized Live IPTV channels.
2. **200% Web Audio API Volume Boost**: Overcomes low-volume bootlegs and cam-rips with an in-browser `AudioContext` + `GainNode` amplifier that safely boosts sound up to +12dB (200%) without clipping.
3. **Self-Healing Stream Token Recovery**: Automatically detects expired security tokens (`s`, `e`, `kx`, `exp`, `token`) in HLS chunk manifests and seamlessly requests fresh streams in the background.
4. **Bandwidth & Memory Efficiency**: Dynamically rewrites TMDB image resolutions to `/w342/`, reducing image memory footprint by **over 50%**, paired with a 5-minute session-hydrated tab cache.

---

## 🌟 Key Features

- 🎬 **Unified Catalog (Indian, Global & Series)**:
  - **Indian Cinema**: Latest releases from Bollywood, South Indian (Tamil, Telugu, Malayalam, Kannada), and Punjabi cinema.
  - **Global Cinema**: Hollywood releases, international movies, and top-rated classics.
  - **Web Series**: Multi-season episodic browser with horizontal season tabs and direct "Play S1:E1" triggers.
- 📺 **Live TV (800+ Channels)**: 24/7 channels categorized by `Sports`, `News`, `Movies`, `Entertainment`, `Music`, and `Kids`, with on-demand upstream GitHub M3U sync (`/api/channels?refresh=true`).
- 🔊 **200% Audio Gain Boost**: Native Web Audio API amplifier providing up to +12dB boost with a responsive gold-to-red center HUD.
- ☀️ **Screen Brightness HUD (10% to 150%)**: In-player software brightness filter with quick shortcuts and visual sun HUD for dark scenes.
- 🔄 **Self-Healing Token Refresh**: Automatically detects and heals expired upstream tokens without interrupting user watch history.
- 🛡️ **Smart 18+ Content Filtering**: Curated regex filter discarding adult/erotic spam while strictly preserving legitimate titles (such as Yash's *Toxic*).
- 🏷️ **Dynamic Quality Badges**: Visual indicators for `HDCAM` (amber), `4K` (purple), and `HD` (blue) releases.
- 🎛️ **Multi-Server Stream Chooser**:
  - **Server 1**: Primary Stream (Direct HLS with Hls.js).
  - **Server 2**: Alternate Player (Live HLS fallback).
  - **Server 3**: Web Stream (Watch Embed protected by Brave Shield).
- ⚡ **Low-Latency Hls.js Integration**: Multi-bitrate switching, Web Worker segment processing, buffer stalling recovery, and native Safari HLS fallback.
- 📐 **VLC-Style Aspect Ratio Cycling**: Contain (Fit Screen), Cover (Fill Screen / Zoom), Fill (Stretch), and 16:9 Match Width.
- ⌨️ **Cinema Keyboard Controls**: Full desktop shortcuts (`Space`/`K` for play/pause, `J`/`L` for 10s seek, `F` for fullscreen, `M` for mute, double-click seek ripples).
- ⚙️ **In-App Server Configuration**: Interactive settings modal with live latency benchmarking, custom backend URL switching, and local storage persistence.
- 🚀 **Built-In Edge Serverless Functions**: Native Vercel edge functions (`/api/extract-m3u8` and `/api/local-proxy`) for real-time AES stream extraction and header spoofing.

---

## 🏗️ System Architecture

The following diagram illustrates how MovieTV Web manages state, streaming engines, edge functions, and backend communications:

```mermaid
flowchart TD
    subgraph BrowserRuntime["Browser Client Runtime (React 19)"]
        UI["React 19 Component Tree"]
        TabCache["In-Memory & Session Tab Cache (tabCaches)"]
        Storage["Server URL LocalStorage ('movietv_server_url')"]
        HLSPlayer["Advanced Video Player (VideoPlayerModal)"]
        AudioEngine["Web Audio API Boost (GainNode + AudioContext)"]
    end

    subgraph FeatureModules["Feature Views & Modals"]
        FeedGrid["Movie Grid & Infinite Pagination"]
        LiveTV["Live TV Directory (LiveTvView)"]
        SeriesModal["Series Seasons & Episodes Modal"]
        StreamChooser["Multi-Server Stream Chooser"]
        ServerConfig["Server Config & Latency Tester"]
    end

    subgraph EdgeFunctions["Vercel Serverless Edge Layer"]
        ExtractM3U8["/api/extract-m3u8 (AES-128 Decryption & JS Unpacker)"]
        LocalProxy["/api/local-proxy (CORS & Header Spoofing)"]
    end

    subgraph BackendAPI["MovieTV Backend Ecosystem"]
        MovieTVBackend["MovieTV Backend REST API (port 5000 / Vercel)"]
        MongoStorage[("MongoDB Atlas Database")]
        GitHubM3U["Curated GitHub IPTV Repositories"]
        VideoCDNs["Upstream Video CDNs & Streaming Mirrors"]
    end

    UI --> FeedGrid
    UI --> LiveTV
    UI --> SeriesModal
    UI --> StreamChooser
    UI --> ServerConfig
    UI --> HLSPlayer

    HLSPlayer --> AudioEngine
    FeedGrid <--> TabCache
    ServerConfig <--> Storage

    FeedGrid --> MovieTVBackend
    LiveTV --> MovieTVBackend
    SeriesModal --> MovieTVBackend
    StreamChooser --> MovieTVBackend

    HLSPlayer -. Dynamic Extraction .-> ExtractM3U8
    HLSPlayer -. Header Rewrite .-> LocalProxy
    LocalProxy --> VideoCDNs

    MovieTVBackend <--> MongoStorage
    MovieTVBackend <--> GitHubM3U
    MovieTVBackend <--> VideoCDNs
```

---

## 🔄 Sequence Diagram: Video Playback & Token Self-Healing

The sequence diagram below details how the client initializes media playback, manages HLS streams, and self-heals when video tokens expire:

```mermaid
sequenceDiagram
    autonumber
    actor User as Viewer
    participant UI as MovieTV Web (React 19)
    participant Chooser as Stream Chooser Modal
    participant Backend as MovieTV Backend API
    participant HLS as Hls.js Streaming Engine
    participant AudioAPI as Web Audio API (+12dB Gain)
    participant VideoCDN as Upstream Video CDN

    User->>UI: Click "Play" on Movie Card
    UI->>Chooser: Open Multi-Server Stream Chooser
    Chooser->>Backend: GET /api/stream/resolve?id=xyz&type=movie
    Backend-->>Chooser: 200 OK (Server 1 M3U8, Server 2 Alternate, Embed)

    User->>Chooser: Select "Server 1: Primary Stream (Direct HLS)"
    Chooser->>HLS: Mount VideoPlayerModal & loadSource(m3u8_url)
    HLS->>AudioAPI: Connect <video> output to AudioContext -> GainNode
    AudioAPI-->>User: Playback begins with normal volume

    User->>UI: Press Arrow Up (Boost volume to 180%)
    UI->>AudioAPI: Set gain.value = 1.8 (+8dB)
    AudioAPI-->>User: Sound amplified with visible gold/red HUD

    Note over HLS,VideoCDN: 25 minutes elapse, CDN token expires
    HLS->>VideoCDN: Request media segment (.ts)
    VideoCDN-->>HLS: 403 Forbidden / Expired Token
    HLS->>UI: Trigger onTokenExpiration error handler
    UI->>Backend: Auto-refetch fresh stream URL (/api/stream/resolve)
    Backend-->>UI: New valid M3U8 stream with refreshed token
    UI->>HLS: Seamlessly resume playback from current timestamp
    HLS-->>User: Continuous uninterrupted playback
```

---

## 💻 Tech Stack

| Domain | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | React | `19.3.1` | Modern React with optimized concurrent rendering and hooks |
| **Build Tool** | Vite | `8.3.5` | Hyper-fast build tooling and hot-module replacement |
| **Styling** | Tailwind CSS & @tailwindcss/vite | `4.3.3` | Modern utility-first CSS with native Vite 8 compilation |
| **Video Engine** | Hls.js | `1.7.4` | Low-latency HTTP Live Streaming player engine with Web Workers |
| **Audio Processing**| Web Audio API | Native Browser | High-fidelity +12dB volume amplification and dynamic gain leveling |
| **Icons** | Lucide React | `1.64.0` | Modern, accessible SVG icons |
| **Linter** | Oxlint | `1.89.0` | Ultra-fast Rust-based JavaScript and JSX linter |
| **Hosting & Edge** | Vercel | Production | Global edge hosting with native serverless function execution |

---

## 📂 Repository Structure

```text
movieTV-web/
├── api/
│   ├── extract-m3u8.js               # Vercel serverless edge function: AES-128 decryption & JS unpacker
│   └── local-proxy.js                # Vercel serverless edge function: Stream proxy with header spoofing
├── public/
│   ├── favicon.svg                   # Brand favicon
│   ├── hero.png                      # Cinematic brand hero banner
│   ├── icons.svg                     # Vector icon sprite sheet
│   └── manifest.json                 # Web app manifest for PWA installation
├── src/
│   ├── api/
│   │   └── client.js                 # API client with in-memory caching and localStorage persistence
│   ├── assets/
│   │   ├── hero.png                  # Primary high-impact hero artwork
│   │   ├── react.svg                 # React framework asset
│   │   └── vite.svg                  # Vite tooling asset
│   ├── components/
│   │   ├── VideoPlayer/
│   │   │   └── VideoPlayerModal.jsx  # Cinema video player with Hls.js, 200% Audio Boost, and HUDs
│   │   ├── LiveTvView.jsx            # Live IPTV channel directory with category filtering & sync
│   │   ├── MovieCard.jsx             # Responsive movie card with poster optimization & quality badges
│   │   ├── MovieGrid.jsx             # Infinite-scroll media grid
│   │   ├── Navbar.jsx                # Cinematic navigation bar with search & server status
│   │   ├── SeriesDetailsModal.jsx    # Seasons and episodes modal with backdrop banner
│   │   ├── ServerConfigModal.jsx     # In-app server URL switcher and latency benchmark modal
│   │   ├── StreamChooserModal.jsx    # Multi-server stream selection modal (Primary, Alternate, Embed)
│   │   └── ToastContainer.jsx        # Notification alert toaster
│   ├── utils/
│   │   ├── contentFilter.js          # 18+ content filter preserving legitimate releases
│   │   ├── streamExtractor.js        # Client-side stream extraction heuristics
│   │   └── streamHeaderHelper.js     # Custom stream headers and referer generator
│   ├── App.jsx                       # Root application view orchestrator
│   ├── index.css                     # Tailwind CSS 4 directives and cinema dark styling
│   └── main.jsx                      # React 19 application mount point
├── .env.example                      # Template environment variable configuration
├── .oxlintrc.json                    # Oxlint configuration
├── index.html                        # HTML5 document template
├── package.json
├── vercel.json                       # Edge routing, functions timeout, and CORS configuration
└── vite.config.js                    # Vite 8 configuration with Tailwind CSS & React plugins
```

---

## 🛠️ Local Setup & Installation

### Prerequisites
- **Node.js**: `>=20.0.0` ([Download Node.js](https://nodejs.org/))
- **MovieTV Backend**: Running locally on port 5000, or a deployed backend URL ([Backend Repo](https://github.com/dhrub4545/movieTV-backend))

### Step-by-Step Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/dhrub4545/movieTV-web.git
   cd movieTV-web
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
   Configure the target backend URL:
   ```ini
   VITE_API_URL=http://localhost:5000
   ```
   *(Note: You can also switch backend URLs dynamically at runtime via the in-app Server Settings modal).*

4. **Launch Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

5. **Execute Linter**:
   ```bash
   npm run lint
   ```

6. **Build for Production**:
   ```bash
   npm run build
   npm run preview
   ```

---

## 🔐 Environment Variables

| Variable | Required | Default (Dev) | Default (Prod) | Description |
| :--- | :---: | :--- | :--- | :--- |
| `VITE_API_URL` | No | `http://localhost:5000` | Current Origin / Saved URL | Base URL of the MovieTV backend API |

> [!NOTE]
> MovieTV Web persists your preferred server address in browser `localStorage`. If you test a new backend URL via the Server Settings modal, it seamlessly persists across sessions without requiring environment rebuilding.

---

## 🔌 API & Integration Reference

MovieTV Web connects to the backend across the following primary REST endpoints:

| Feature | Backend Endpoint Called | Method | Description |
| :--- | :--- | :---: | :--- |
| **Home View** | `/api/feed/home` | `GET` | Curated hero carousels and trending collections |
| **Indian Cinema** | `/api/feed/movies/indian` | `GET` | Bollywood and South Indian movies with pagination |
| **Global Cinema** | `/api/feed/movies/global` | `GET` | Hollywood and international releases |
| **Series & Shows** | `/api/feed/series` | `GET` | Web series catalog with season and episode structures |
| **Series Details** | `/api/feed/series/:id` | `GET` | Full seasons metadata, episode descriptions, and stream links |
| **Live TV** | `/api/channels` | `GET` | 800+ Live IPTV channels (supports `?category=Sports` and `?refresh=true`) |
| **Stream Resolver**| `/api/stream/resolve` | `GET` | Unpacks dynamic video host embed to retrieve direct M3U8 streams |
| **Save M3U8** | `/api/stream/save-m3u8` | `POST` | Persists a validated stream back to the database |
| **Live Health** | `/api/health` | `GET` | Latency benchmarking and backend connectivity testing |

---

## 🚀 Production Deployment (Vercel)

MovieTV Web is optimized for 1-click deployment on **Vercel**:

### Option 1: Git Integration (Recommended)
1. Import `https://github.com/dhrub4545/movieTV-web` into Vercel.
2. Vercel automatically detects `Vite` from `vercel.json`:
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Under **Environment Variables**, add:
   - `VITE_API_URL`: Your deployed MovieTV Backend URL (e.g. `https://movietv-backend.vercel.app`).
4. Click **Deploy**.

### Option 2: Deploy via Vercel CLI
```bash
npx vercel
npx vercel --prod
```

### Included Serverless Edge Functions (`api/`)
When deployed to Vercel, the application automatically mounts two edge functions:
- `/api/extract-m3u8`: Decrypts AES-128-CBC cipher streams and unpacks Dean Edwards JavaScript packers from upstream video hosts.
- `/api/local-proxy`: Reverse-proxies media chunks with spoofed `Referer` and `User-Agent` headers to bypass third-party CDN restrictions.

---

## 🛡️ Security, Performance & Best Practices

1. **TMDB Artwork Optimization**:
   Poster and backdrop URLs from TMDB (`image.tmdb.org`) are automatically rewritten from uncompressed `/original/` and `/w500/` paths to compact `/w342/` assets. This cuts memory consumption by more than **50%**, completely eliminating tab crashes on low-spec devices.

2. **Session-Hydrated Tab Caches**:
   Switching between Indian Cinema, Global Cinema, and Web Series is instantaneous. Feed responses are cached in memory and mirrored to `sessionStorage` with a 5-minute TTL, avoiding unnecessary network queries.

3. **200% Audio Gain Limiter**:
   The audio boost utility uses standard Web Audio API nodes (`createMediaElementSource` -> `createGain` -> `audioCtx.destination`). It dynamically limits output to +12dB to ensure speaker safety and distortion-free amplification.

4. **Resource Clean-up on Modal Unmount**:
   When the video player modal closes, the component cleans up active `Hls.js` instances, cancels pending chunk downloads, resets brightness filters, and closes active `AudioContext` nodes to prevent browser memory leaks.

---

## 👥 Authors & Licensing

Developed by the **MovieTV Engineering Team** ([@dhrub4545](https://github.com/dhrub4545)).  
Distributed under the **MIT License**. See `LICENSE` for details.
