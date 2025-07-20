// Manual Service Worker registration script
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        
        registration.addEventListener('updatefound', function() {
          const installingWorker = registration.installing;
          console.log('New service worker installing...');
          
          installingWorker.addEventListener('statechange', function() {
            console.log('Service worker state:', installingWorker.state);
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New service worker available, reload to update');
            }
          });
        });
      })
      .catch(function(err) {
        console.error('ServiceWorker registration failed: ', err);
      });
  });
}