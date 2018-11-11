let restaurant;
var map;

const skipLink = document.querySelector(".skip-link");
const name = document.getElementById('restaurant-name');
skipLink.addEventListener('click', function(){
  name.focus();
});

document.addEventListener('DOMContentLoaded', (event) => {
  window.lazySizesConfig = window.lazySizesConfig || {};
  lazySizesConfig.loadMode = 1; // no offscreen images load
});

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  this.fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.map = new this.google.maps.Map(document.getElementById('map'), {
        zoom: 16,
        center: restaurant.latlng,
        scrollwheel: false
      });
      this.fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.map);
    }
  });
};

/*
 * fetch reviews
 */
fetchReviews = () => {
  const id = getParameterByName('id');
  if (!id) {
    console.log('No ID in URL');
    return;
  }
  DBHelper.fetchReviewsForRestaurant(id, (err, reviews) => {
    self.reviews = reviews;
    if (err || !reviews) {
      console.log('reviews fetch error', err);
      return;
    }
    fillReviewsHTML(reviews);
  });
}

/**
 * Get current restaurant from page URL.
 */
fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
   error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/*
 * set favorite button
 */
setFavoriteButton = (status) => {
  const favorite = document.getElementById('favBtn');
  if (status === 'true') {
    favorite.title = 'Restaurant is Favorite';
    favorite.innerHTML = '⭐️ Unfavorite';
  } else {
    favorite.title = 'Restaurant is not Favorite';
    favorite.innerHTML = '☆ Favorite';
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;
  name.tabIndex = '0';

  // favorite
  setFavoriteButton(restaurant.is_favorite);
  
  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  const image = document.getElementById('restaurant-img');
  image.className = 'restaurant-img lazyload';
  image.setAttribute('alt','Photo of the ' + restaurant.name + ' restaurant');
  image.setAttribute('data-src', DBHelper.imageUrlForRestaurant(restaurant));
  image.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  image.tabIndex='0';

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }

 fetchReviews();
};

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    time.innerHTML = operatingHours[key];
    row.appendChild(time);

    hours.appendChild(row);
	hours.tabIndex = '0';
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
  const title = document.createElement('h3');
  title.innerHTML = 'Reviews';
  title.tabIndex = '0';
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
	noReviews.tabIndex = '0';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(this.createReviewHTML(review));
  });
  container.appendChild(ul);
};

/**
 * Create review HTML and add it to the webpage.
 */
createReviewHTML = (review) => {
  const li = document.createElement('li');
  const name = document.createElement('p');
  name.innerHTML = review.name;
  name.className = 'reviewerName';
  li.appendChild(name);
  name.tabIndex = '0';

  const date = document.createElement('p');
  date.innerHTML = review.date;
  date.className = 'date';
  li.appendChild(date);

  const rating = document.createElement('p');
  rating.innerHTML = `Rating: ${review.rating}`;
  rating.tabIndex = '0';
  rating.className = 'rating'
  li.appendChild(rating);

  const comments = document.createElement('p');
  comments.innerHTML = review.comments;
  comments.tabIndex = '0';
  li.appendChild(comments);

  return li;
};

/* Managing reviews */
navigator.serviceWorker.ready.then(function (swRegistration) {
  let form = document.querySelector('#review-form');
  form.addEventListener('submit', e => {
    e.preventDefault();
    let rating = form.querySelector('#rating');
    let review = {
      restaurant_id: getParameterByName('id'),
      name: form.querySelector('#name').value,
      rating: rating.options[rating.selectedIndex].value,
      comments: form.querySelector('#comment').value
    };
    console.log(review);
    
    DBHelper.openDatabase().then(function(db){
      var transaction = db.transaction('outbox', 'readwrite');
      return transaction.objectStore('outbox').put(review);
    }).then(function () {
      form.reset();
      return swRegistration.sync.register('sync').then(() => {
        console.log('Sync registered');
      });
    });
  });
});

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  const li = document.createElement('li');
  li.setAttribute('aria-current', 'page');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
};

/**
 * Get a parameter by name from page URL.
 */
getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

/* Managing favorites */
navigator.serviceWorker.ready.then(function (swRegistration) {
  let btn = document.getElementById('favBtn');
  btn.addEventListener('click', e => {
    const opposite = (self.restaurant.is_favorite === 'true') ? 'false' : 'true';
    console.log('clicked');
    let res = {
      resId: getParameterByName('id'),
      favorite: opposite
    };
    idb.open('favorite', 1, function (upgradeDb) {
      upgradeDb.createObjectStore('outbox', { autoIncrement: true, keyPath: 'id' });
    }).then(function (db) {
      var transaction = db.transaction('outbox', 'readwrite');
      return transaction.objectStore('outbox').put(res);
    }).then(function () {
      setFavoriteButton(opposite);
      self.restaurant.is_favorite = opposite;
      return swRegistration.sync.register('favorite').then(() => {
        console.log('Favorite Sync registered');
      });
    });
  });
});