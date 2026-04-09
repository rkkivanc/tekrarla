self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
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

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('https://tekrarla.app'));
});
