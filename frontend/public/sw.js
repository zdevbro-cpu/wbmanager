// 홈 화면 설치를 위한 최소 서비스워커.
//
// 크롬은 매니페스트만으로는 설치 단추를 내주지 않고, fetch를 다루는 서비스워커를 함께 요구한다.
// 그래서 요청을 그대로 흘려보내기만 한다 — 아무것도 캐시하지 않는다.
// 캐시를 두면 배포한 새 화면이 옛 화면으로 덮여 "고쳤는데 그대로"가 되기 때문이다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)));
