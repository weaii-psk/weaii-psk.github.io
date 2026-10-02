const CACHE_NAME = "psk-portal-v1";

const APP_FILES = [
    "/",
    "/index.html",
    "/app.js",
    "/style.css",
    "/plan-calendar.json",

    "/baza/",
    "/baza/index.html",
    "/baza/app.js",
    "/baza/style.css",
    "/baza/pracownicy.json",
    "/baza/wydzialy.json",

    "/kalendarz/",
    "/kalendarz/index.html",
    "/kalendarz/app.js",
    "/kalendarz/style.css",
    "/kalendarz/calendar.json",

    "/manifest.json",

    "/icons/icon-192.png",
    "/icons/icon-270.png",
    "/icons/icon-270-maskable.png"
];

// Instalacja — pobranie wszystkich plików
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(APP_FILES))
            .then(() => self.skipWaiting())
    );
});

// Aktywacja — usunięcie poprzednich wersji cache
self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys =>
                Promise.all(
                    keys
                        .filter(key => key !== CACHE_NAME)
                        .map(key => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

// Obsługa żądań
self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.method !== "GET") return;

    const url = new URL(request.url);

    // Tylko zasoby z naszej domeny
    if (url.origin !== self.location.origin) return;

    // Strony HTML — najpierw sieć, potem cache
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache =>
                                cache.put(request, copy)
                            );
                    }

                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(request);

                    if (cached) return cached;

                    // Awaryjne dopasowanie strony po ścieżce
                    const path = url.pathname.replace(/\/+$/, "");

                    const fallback =
                        path === "/baza"
                            ? "/baza/index.html"
                            : path === "/kalendarz"
                                ? "/kalendarz/index.html"
                                : "/index.html";

                    return (
                        await caches.match(fallback)
                        || new Response(
                            "Brak połączenia z internetem.",
                            {
                                status: 503,
                                headers: {
                                    "Content-Type":
                                        "text/plain; charset=utf-8"
                                }
                            }
                        )
                    );
                })
        );

        return;
    }

    // JSON — sieć ma pierwszeństwo, cache jest awaryjny
    if (url.pathname.endsWith(".json")) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache =>
                                cache.put(request, copy)
                            );
                    }

                    return response;
                })
                .catch(async () => {
                    return (
                        await caches.match(request)
                        || new Response(
                            JSON.stringify({
                                error: "Brak zapisanych danych offline"
                            }),
                            {
                                status: 503,
                                headers: {
                                    "Content-Type":
                                        "application/json; charset=utf-8"
                                }
                            }
                        )
                    );
                })
        );

        return;
    }

    // Pozostałe zasoby — cache-first
    event.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;

            return fetch(request).then(response => {
                if (response.ok) {
                    const copy = response.clone();

                    caches.open(CACHE_NAME)
                        .then(cache =>
                            cache.put(request, copy)
                        );
                }

                return response;
            });
        })
    );
});