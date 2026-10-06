# Video Face Redactor

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-video-face-redactor/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-video-face-redactor/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-video-face-redactor/)

[日本語版 README](README.ja.md)

A privacy-focused, single-HTML app for finding faces in videos and hiding them with pixelation, blur, solid fill, or emoji — without uploading the selected video to a server.

Video Face Redactor runs face detection, review/editing, redaction, and H.264 MP4 export locally in the browser. H.264/AVC input is supported, and H.265/HEVC input is also accepted when the current browser/device can decode it through WebCodecs.

## 🚀 Live demo

### [Open Video Face Redactor on GitHub Pages](https://ttomohisa.github.io/htmlapps-video-face-redactor/)

GitHub Pages delivers the initial HTML. After it loads, video parsing, face detection, review/editing, masking, and MP4 export are processed locally on your device. The video you select is not uploaded by the app.

HEVC/H.265 input depends on the browser, OS, and device decoder. The app checks compatibility when a video is selected.

## Features

- Automatically starts face detection after a video is loaded
- Face detection with YuNet + ONNX Runtime Web
- 1 / 2 / 5 / 10 checks per second for re-analysis
- Final-frame detection to reduce missed faces at the end of a video
- Aspect-ratio-preserving face analysis to improve mask alignment
- Frame-by-frame review plus continuous playback
- Exact-frame review using MP4 sample timestamps
- Re-detect the current frame when a face mask is misplaced
- Pixelate / blur / solid fill / emoji redaction
- Adjustable mask padding
- Manual masks for missed faces
- Manual-mask duration: one frame, ±1 / 3 / 5 seconds, or the whole video
- Manual masks can follow edited positions or stay fixed
- Original / 1080p / 720p output sizes
- Editable output filename
- AAC audio passthrough when compatible
- Japanese and English UI in the same HTML
- Mobile-first controls with a safe-area-aware bottom navigation bar
- Face-detection progress shown directly over the preview on mobile
- Embedded SVG favicon
- Runtime network access blocked with `connect-src 'none'`
- Standalone HTML and self-extracting HTML builds

> Face detection and tracking are not perfect. Review the entire video before sharing the exported file.

## Quick start

### Use the web demo

Just [open the GitHub Pages demo](https://ttomohisa.github.io/htmlapps-video-face-redactor/). No installation or account is required.

### Use the generated single HTML file

1. Build the app once with `build-standalone.bat` on Windows.
2. Open `dist/index.html` or the generated root-level `video-face-redactor.html` in a supported browser.
3. Choose an MP4 or MOV video.
4. Face detection starts automatically.

No account, upload, Python, Node.js, or local web server is required.

### Use it fully offline

After the standalone HTML has been built, copy `dist/index.html` wherever you need it. The runtime libraries and face-detection model are embedded in the HTML, so the app can be opened later without a network connection.

The first build needs network access only to download the pinned MP4Box.js files used by the build process.

## Usage

1. Choose an MP4 or MOV video from the file picker or directly from the empty preview area.
2. Wait for automatic face detection to finish. Progress is shown in the preview.
3. Use **Review / Edit** to play the video or move one frame at a time.
4. If a mask is misplaced, stop on that frame and use **Find faces in this scene again**.
5. Choose **Pixelate**, **Blur**, **Fill**, or **Emoji** as the hiding style.
6. Adjust the mask padding if the edge of a face remains visible.
7. Add a manual mask when automatic detection misses a face, then choose how long it should remain and whether its position should move.
8. Set the output filename, resolution, quality, and audio option.
9. Check the Export mask summary: enabled/total automatic paths and manual covers, disabled masks, and enabled automatic paths flagged for review. Paths are not unique-person counts; zero masks or zero flags does not mean every face is hidden.
10. Export the H.264 MP4 and review the entire result before sharing it. If a full re-analysis fails, finish a successful retry before Export or mobile Save becomes available.

### Mobile controls

On screens up to 600px wide, a fixed bottom navigation bar provides quick access to:

- **Video** — choose or replace the input video
- **Faces** — face-detection settings and re-analysis
- **Review / Edit** — playback, frame stepping, and corrections
- **Style** — pixelate / blur / fill / emoji and manual masks
- **Save** — output filename and export settings

The hiding-style buttons appear directly below the preview on mobile, while mask padding is kept as a small secondary control so it is not confused with the video timeline.

## Supported formats

### Video input

| Input | Support |
| --- | --- |
| H.264 / AVC (`avc1.*`, `avc3.*`) | Supported when the browser can decode the exact video |
| H.265 / HEVC (`hvc1.*`, `hev1.*`) | Supported when the browser/device provides WebCodecs HEVC decoding |
| AV1 / VP9 | Not supported in v1 |

Pixel videos using codec strings such as `hvc1.1.6.L123` can be opened when HEVC decoding is available in the current browser/device. Compatibility is checked automatically when the video is loaded.

### Video output

Export is H.264 MP4. The app checks whether the current browser/device can encode the selected output resolution before enabling export.

### Audio

Compatible AAC (`mp4a`) audio is copied into the output MP4 without re-encoding. Unsupported audio formats are exported without audio after a warning.

## Publish with GitHub Pages

The repository includes a workflow that builds the fully embedded HTML and deploys `dist/` to GitHub Pages automatically.

1. Open **Settings -> Pages -> Build and deployment -> Source** and select **GitHub Actions** once.
2. Push to `main`, or manually run **Deploy standalone app to GitHub Pages** from the Actions tab.
3. The workflow runs repository checks, rebuilds the standalone HTML from pinned dependencies, and publishes `dist/`.
4. After a successful deployment, the demo is available at <https://ttomohisa.github.io/htmlapps-video-face-redactor/>.

If Pages has not been enabled yet, the workflow still builds the app and skips only the deployment, with setup instructions in the Actions summary.

See the [GitHub Pages deployment guide](docs/GITHUB_PAGES.md) for setup and troubleshooting.

## Development and build layout

```text
.
├─ src/index.template.html          # Application template and embedded runtime assets
├─ app.config.json                  # App metadata and output settings
├─ dependencies.json                # Pinned MP4Box.js build dependencies
├─ build-standalone.bat             # Windows build entry point
├─ build-standalone.ps1             # Standalone HTML builder
├─ scripts/
│  ├─ build-self-extract.ps1        # Self-extracting HTML builder
│  ├─ check-repository.ps1          # Repository checks
│  └─ verify-self-extract.ps1       # Self-extract verification
├─ dist/index.html                  # Generated standalone HTML
├─ video-face-redactor.html         # Generated root-level standalone copy
├─ docs/
│  ├─ GITHUB_PAGES.md               # GitHub Pages setup and troubleshooting
│  └─ GITHUB_PAGES.ja.md            # Japanese Pages guide
└─ .github/workflows/
   ├─ build-standalone.yml          # Build validation on push / pull request
   └─ deploy-pages.yml              # Build and deploy dist/ to GitHub Pages
```

### Build on Windows

```bat
build-standalone.bat
```

The first build downloads the exact MP4Box.js version pinned in `dependencies.json` and caches the files under `vendor/`.

To download the pinned MP4Box.js files again:

```powershell
.\build-standalone.ps1 -RefreshDependencies
```

To skip the self-extracting HTML build:

```powershell
.\build-standalone.ps1 -SkipSelfExtract
```

The build process automatically:

- Downloads the pinned MP4Box.js 2.4.1 ESM chunks when they are not cached
- Gzip-compresses MP4Box.js before Base64 embedding
- Keeps ONNX Runtime Web JavaScript, WASM, and the YuNet model gzip-compressed inside the HTML
- Rejects unresolved dependency placeholders
- Rejects external runtime `<script src="https://...">` references
- Writes `dist/dependency-manifest.json` with source URLs, sizes, and SHA-256 hashes
- Generates `dist/index.html`
- Generates `dist/index.self-extract.html`
- Generates the convenient root-level `video-face-redactor.html` copy

## How it works

```text
MP4 / MOV
   ↓
MP4Box.js
   ↓
H.264 / H.265 compressed video samples
   ↓
WebCodecs VideoDecoder
   ↓
Video frames
   ├─ YuNet face detection → face positions → review / manual correction
   └─ Canvas redaction → WebCodecs VideoEncoder (H.264)
                                      ↓
Compatible AAC audio ─────── copied ──┤
                                      ↓
                                  MP4Box.js
                                      ↓
                                   MP4 file
```

## Privacy and runtime network protection

The standalone HTML contains the runtime assets required for face detection and video processing.

- Selected videos are processed locally in the browser
- The app contains no upload flow for video or audio data
- YuNet, ONNX Runtime Web JavaScript, and ONNX Runtime WebAssembly are embedded in the HTML
- MP4Box.js is embedded by the build process
- The generated page uses a Content Security Policy containing `connect-src 'none'`
- No CDN is contacted while the generated app is running

The GitHub Pages version requires one initial HTML request from GitHub. After the page loads, selected videos stay in the browser and are not uploaded by the app. For a fully disconnected session, open the generated `dist/index.html` locally.

The build step may use the network to obtain pinned dependencies. That is separate from runtime video processing.

## Limitations

- Face detection and tracking can miss faces or place a mask incorrectly, especially with fast motion, occlusion, extreme angles, or very small faces.
- H.265 / HEVC input depends on browser, OS, and device decoder support.
- Export is H.264 MP4 even when the input video is HEVC.
- Non-AAC audio is not re-encoded in v1 and may result in silent output.
- Long or 4K videos can use substantial memory because compressed samples and encoded output are kept in memory before final MP4 muxing.
- Unusual MOV structures and some rotation-metadata combinations may need further compatibility work.
- The exported video should always be reviewed from beginning to end before it is shared.

## Dependencies

| Library / model | Version | License | Purpose |
| --- | ---: | --- | --- |
| ONNX Runtime Web | 1.27.0 | MIT | Browser-side YuNet inference |
| YuNet face detection model | embedded model | MIT | Face detection |
| MP4Box.js | 2.4.1 | BSD-3-Clause | MP4/MOV parsing, sample extraction, and MP4 muxing |
| WebCodecs | Browser API | — | Video decoding and H.264 encoding |

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for third-party notices.

## Regression tests

With Node.js 22 or newer installed, run `node --test tests/export-review.test.cjs`. The repository check also runs this suite. It extracts production UI/analysis functions and exercises synthetic frames and rectangles with decoder/detector test doubles; it does not test real inference, encoding, browser layout, or anonymization quality.

## Contributing

Bug reports and feature proposals are welcome through GitHub Issues.

## License

Copyright © 2026 ttomohisa

Licensed under the [MIT License](LICENSE).
