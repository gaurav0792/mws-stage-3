self.importScripts("/js/idb.js");

let version = '1.6.0';
let staticCacheName = 'mws-rrs3-' + version;
let DBName = 'mws-rrs3';
let DBVersion = 1;
let dbPromise;


self.addEventListener('activate',  event => {
  event.waitUntil((function(){
    self.clients.claim();
    initDB();
  })());
});

self.addEventListener('fetch', function(event) {
  if (event.request.url.endsWith('localhost:1337/restaurants')){
    event.respondWith(
      dbPromise.then(function (db) {
        var tx = db.transaction('restaurants', 'readonly');
        var store = tx.objectStore('restaurants');
        return store.getAll();
      }).then(function (items) {
        if (!items.length) {
          return fetch(event.request).then(function (response) {
            return response.clone().json().then(json => {
              console.log('event respond fetch from net');
              addAllData(json);
              return response;
            })
          });
        } else {
          console.log('event respond read from DB');
          let response = new Response(JSON.stringify(items), {
            headers: new Headers({
              'Content-type': 'application/json',
              'Access-Control-Allow-Credentials': 'true'
            }),
            type: 'cors',
            status: 200
          });
          return response;
        }
      })
    );

    return; 
  }
 // normal cases
  event.respondWith(
    caches.match(event.request).then(function(response) {

      if (response) {
        console.log('Found ', event.request.url, ' in cache');
        return response;
      }
      return fetch(event.request)
        .then(function(response) {
          return caches.open(staticCacheName).then(function(cache) {
            if (event.request.url.indexOf('maps') < 0) { 
              cache.put(event.request.url, response.clone());
            }
            return response;
          });
        });

    }).catch(function(error) {
      console.log('offline');
    })
  );
});

/* delete old cache */
self.addEventListener('activate', function(event) {
  console.log('Activating new service worker...');

  let cacheWhitelist = [staticCacheName];

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('sync', function (e) {
    if (e.tag === 'sync') {
      e.waitUntil(
        sendReviews().then(() => {
          console.log('synced');
        }).catch(err => {
          console.log(err, 'error syncing');
        })
      );
	  } else if (e.tag === 'favorite') {
    e.waitUntil(
      sendFavorites().then(() => {
        console.log('favorites synced');
      }).catch(err => {
        console.log(err, 'error syncing favorites');
      })
    );
    }});

function initDB() {
  dbPromise = idb.open(DBName, DBVersion, function (upgradeDb) {
    console.log('making DB Store');
    if (!upgradeDb.objectStoreNames.contains('restaurants')) {
      upgradeDb.createObjectStore('restaurants', { keyPath: 'id' });
    }
  });
}

function addAllData(rlist) {
  let tx;
  dbPromise.then(function(db) {
    tx = db.transaction('restaurants', 'readwrite');
    var store = tx.objectStore('restaurants');
    rlist.forEach(function(res) {
      console.log('adding', res);
      store.put(res); 
    });
    return tx.complete;
  }).then(function() {
    console.log('All data added to DB successfully');
  }).catch(function(err) {
    tx.abort();
    console.log('error in DB adding', err);
    return false;
  });
}
	
function sendReviews() {
    return idb.open('Restaurant Reviews', 4).then(db => {
    let tx = db.transaction('outbox', 'readonly');
      return tx.objectStore('outbox').getAll();
    }).then(reviews => {
        return Promise.all(reviews.map(review => {
        let reviewID = review.id;
        delete review.id;
        console.log("sending review....", review);
        return fetch('http://localhost:1337/reviews', {
          method: 'POST',
          body: JSON.stringify(review),
          headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
        }
        }).then(response => {
            console.log(response);
            return response.json();
       }).then(data => {
            console.log('added review!', data);
            if (data) {
              idb.open('Restaurant Reviews', 4).then(db => {
                let tx = db.transaction('outbox', 'readwrite');
                return tx.objectStore('outbox').delete(reviewID);
              });
            }
          });
        }));
    });
}

function sendFavorites() {
  return idb.open('favorite', 1).then(db => {
    let tx = db.transaction('outbox', 'readonly');
    return tx.objectStore('outbox').getAll();
  }).then(items => {
    return Promise.all(items.map(item => {
      let id = item.id;
      console.log("sending favorite", item);
      return fetch(`http://localhost:1337/restaurants/${item.resId}/?is_favorite=${item.favorite}`, {
        method: 'PUT'
      }).then(response => {
        console.log(response);
        return response.json();
      }).then(data => {
        console.log('added favorite', data);
        if (data) {
          idb.open('favorite', 1).then(db => {
            let tx = db.transaction('outbox', 'readwrite');
            return tx.objectStore('outbox').delete(id);
          });
        }
      });
    }));
  });
}