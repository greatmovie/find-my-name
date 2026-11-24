/* 내이름을찾아줘 - 오프라인 캐시 */
var CACHE = "find-my-name-v2";
var SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/icon-maskable-512.png",
  "./images/tyrannosaurus.webp",
  "./images/giganotosaurus.webp",
  "./images/allosaurus.webp",
  "./images/dilophosaurus.webp",
  "./images/velociraptor.webp",
  "./images/spinosaurus.webp",
  "./images/suchomimus.webp",
  "./images/triceratops.webp",
  "./images/brachiosaurus.webp",
  "./images/stegosaurus.webp"
];

// 캐시가 비었을 때 돌려줄 최소 응답
function offlineResponse() {
  return new Response("", { status: 504, statusText: "offline" });
}

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // 하나가 실패해도 설치는 계속되도록 개별로 담는다
      return Promise.all(SHELL.map(function (url) {
        return cache.add(new Request(url, { cache: "reload" })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
        return null;
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 공룡 사진: 한 번 받으면 캐시에서 바로 (아이 화면이 끊기지 않게)
  if (req.destination === "image" || /\.(png|jpe?g|webp|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
          }
          return res;
        }).catch(function () {
          // 오프라인이고 캐시에도 없을 때 (hit 는 undefined)
          return caches.match("./images/icon-192.png").then(function (fallback) {
            return fallback || offlineResponse();
          });
        });
      })
    );
    return;
  }

  // 문서: 네트워크 우선, 실패하면 캐시
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copy); }).catch(function () {});
        }
        return res;
      }).catch(function () {
        return caches.match("./index.html").then(function (hit) {
          return hit || caches.match("./");
        }).then(function (hit) {
          return hit || offlineResponse();
        });
      })
    );
    return;
  }

  // 그 밖의 같은 출처 자원(manifest.json 등): 캐시 우선
  event.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () { return offlineResponse(); });
    })
  );
});
