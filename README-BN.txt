MY OVERTIME — FIXED v1.0.3

- index.html: APK entry HTML
- updates/app.html: GitHub update payload
- updates/version.json: version + SHA-256

Changes:
- Embedded full-screen splash MP4; closes when video ends.
- Removed the old 4.2-second watchdog that interrupted splash playback.
- Embedded poster frame fallback for devices restricting autoplay.
- QR scan destination, visible QR link, global website/share link changed to https://nisinex.github.io/Website/
- Fresh QR PNG embedded as an offline fallback.
- All original image/audio assets embedded into the HTML.

APK WebView requirement for splash audio:
Set JavaScript enabled, DOM storage enabled, and mediaPlaybackRequiresUserGesture=false.
If that native WebView setting is not enabled, Android may autoplay the video muted or block audio. HTML alone cannot override this native playback policy.

Original media assets embedded: 20
Splash MP4 size: 802,799 bytes
SHA-256: c49f650e68dac3399cb20a647089a1b38a9a1dcfc85d951be3c5d10d7e58176f
