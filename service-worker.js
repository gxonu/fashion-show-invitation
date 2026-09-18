const CACHE_NAME = "fashion-show-invitation-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./script.js",
  "./seats.csv",
  "./manifest.webmanifest",
  "./assets/main-background.jpg",
  "./assets/interview.png",
  "./assets/IMG_5385.JPG",
  "./assets/IMG_5413.jpg",
  "./assets/IMG_5411.jpg",
  "./assets/ticket-folder.jpg",
  "./assets/IMG_5403.JPG",
  "./assets/IMG_5423.PNG",
  "./assets/exhibition-poster.png",
  "./assets/about-off-photo.png",
  "./assets/off-logo-black.png",
  "./assets/folder.png",
  "./assets/parking-map.png",
  "./assets/IMG_5390.PNG"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(ASSETS.map((asset) => cache.add(asset)))
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === location.origin) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
