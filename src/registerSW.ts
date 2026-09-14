let swRegistration: ServiceWorkerRegistration | null = null;

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          swRegistration = registration;
          console.log('MATS ServiceWorker registered successfully:', registration.scope);

          // Check if there is an existing waiting worker
          if (registration.waiting) {
            window.dispatchEvent(
              new CustomEvent('pwaUpdateAvailable', { detail: registration })
            );
          }
          
          // Auto update SW if a new version is installed
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New MATS PWA update available. Prompting user...');
                  window.dispatchEvent(
                    new CustomEvent('pwaUpdateAvailable', { detail: registration })
                  );
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('MATS ServiceWorker registration failed:', error);
        });

      // Reload smoothly when new service worker takes controller
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });

      // Periodic check for SW updates when user refocuses the app
      window.addEventListener('focus', () => {
        if (swRegistration) {
          swRegistration.update().catch(() => {});
        }
      });
    });
  }
}
