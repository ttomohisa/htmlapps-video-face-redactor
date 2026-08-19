# Vendor cache

`build-standalone.ps1` downloads the three pinned ESM chunks used by MP4Box.js 2.4.1 into this directory. During the build, each chunk is gzip-compressed and then Base64-embedded into the generated standalone HTML. At runtime the app decompresses the chunks locally and reconstructs the ESM dependency graph with Blob URLs, so no CDN request occurs while the app is running.

Cached files are ignored by Git.
