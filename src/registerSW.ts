export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('MATS ServiceWorker registered successfully:', registration.scope);
          
          // Auto update SW if a new version is waiting
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New MATS PWA update available. Refreshing PWA cache...');
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('MATS ServiceWorker registration failed:', error);
        });
    });
  }
}
