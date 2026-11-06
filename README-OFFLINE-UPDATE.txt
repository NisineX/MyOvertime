MY OVERTIME — OFFLINE CACHE UPDATE

Upload these three files to the ROOT of the same GitHub Pages repository:
- index.html (IMPORTANT: exact lowercase filename)
- service-worker.js
- manifest.json

Do not rename the asset files already in your repository. The service worker caches the image/audio/video paths referenced by the existing app. Keep all those assets in the repository root beside index.html.

After publishing, open the app once while online and leave it open until the browser finishes installing the service worker and caching media. Then close and reopen the app once online to confirm it is controlled by the updated worker. The next offline launch can use the cached shell and assets.

Note: Firebase sync, currency/date APIs and other live services still require internet; local overtime records and cached app media remain available offline.
