if ('serviceWorker' in navigator) {
    navigator.serviceWorker
        .register('sw.js')
        .then(function () {
            console.log('Service worker registered!');
        })
        .catch(function (err) {
            console.log(err);
        });
}

// Check for service worker updates every hour
setInterval(() => {
  navigator.serviceWorker.getRegistration().then(registration => {
    registration.update();
  });
}, 3600000); // 1 hour in milliseconds
