import { precacheAndRoute } from 'workbox-precaching';
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Tekrarla';
  const options = {
    body: data.body || 'Tekrar zamanı geldi!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('https://tekrarla.app')
  );
});
