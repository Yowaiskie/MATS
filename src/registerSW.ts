export function registerServiceWorker() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('MATS ServiceWorker registered successfully:', registration.scope);
        })
        .catch((error) => {
          console.error('MATS ServiceWorker registration failed:', error);
        });
    });
  }
}
