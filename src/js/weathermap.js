document.addEventListener('DOMContentLoaded', function () {
  // Start the initial weather update process
  updateWeather('Österbybruk');

  // Set the weather to update every 10 minutes
  setInterval(function () {
    updateWeather('Österbybruk');
  }, 600000); // 10 minutes interval
});

function updateWeather(cityName) {
  getCoordinates(cityName);
}

function getCoordinates(cityName) {
  const apiKey = '6419f1e7c833b35699b571a7d04401f3';
  const geocodingUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${cityName}&limit=1&appid=${apiKey}`;

  fetch(geocodingUrl)
    .then(response => response.json())
    .then(data => {
      if (data.length > 0) {
        const latitude = data[0].lat;
        const longitude = data[0].lon;
        getWeather(latitude, longitude);
        // console.log(latitude, longitude);
      } else {
        console.error('City not found');
      }
    })
    .catch(error => console.error('Error fetching coordinates:', error));
}

function getNextFourDays() {
  const daysOfWeek = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  let fourDays = [];

  // Get the current date
  let currentDate = new Date();

  // Format and push the next four days into the array
  for (let i = 0; i < 4; i++) {
    // Get the day of the week
    let dayOfWeek = daysOfWeek[currentDate.getDay()];
    // Format the date as "Day M/D"
    let formattedDate = `${dayOfWeek} ${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
    // Push the formatted date into the array
    fourDays.push(formattedDate);
    // Move to the next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return fourDays;
}

function getWeather(latitude, longitude) {
  const apiKey = '6419f1e7c833b35699b571a7d04401f3';
  const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${latitude}&lon=${longitude}&exclude=minutely,hourly&units=metric&lang=sv&appid=${apiKey}`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      var timestamp = data.current.dt;
      var Currentdate = new Date(timestamp * 1000); // JavaScript uses milliseconds, so convert seconds to milliseconds by multiplying by 1000
      
      // Log the response data to the console
      // console.log('Weather data:', data);
      let nextFourDays = getNextFourDays();
      // Process and update the weather data
      const Daily0 = data.daily[0];
      document.getElementById('day0').innerHTML = nextFourDays[0];
      document.getElementById('day0High').innerHTML = Daily0.temp.max.toFixed(1) + '&deg;C';
      document.getElementById('day0Low').innerHTML = Daily0.temp.min.toFixed(1) + '&deg;C';
      document.getElementById('forecast0').innerHTML = Daily0.weather[0].description;
      document.getElementById('idImg0').src = "src/images/weather/" + Daily0.weather[0].icon + ".png";

      const Daily1 = data.daily[1];
      document.getElementById('day1').innerHTML = nextFourDays[1];
      document.getElementById('day1High').innerHTML = Daily1.temp.max.toFixed(1) + '&deg;C';
      document.getElementById('day1Low').innerHTML = Daily1.temp.min.toFixed(1) + '&deg;C';
      document.getElementById('forecast1').innerHTML = Daily1.weather[0].description;
      document.getElementById('idImg1').src = "src/images/weather/" + Daily1.weather[0].icon + ".png";

      const Daily2 = data.daily[2];
      document.getElementById('day2').innerHTML = nextFourDays[2];
      document.getElementById('day2High').innerHTML = Daily2.temp.max.toFixed(1) + '&deg;C';
      document.getElementById('day2Low').innerHTML = Daily2.temp.min.toFixed(1) + '&deg;C';
      document.getElementById('forecast2').innerHTML = Daily2.weather[0].description;
      document.getElementById('idImg2').src = "src/images/weather/" + Daily2.weather[0].icon + ".png";

      const Daily3 = data.daily[3];
      document.getElementById('day3').innerHTML = nextFourDays[3];
      document.getElementById('day3High').innerHTML = Daily3.temp.max.toFixed(1) + '&deg;C';
      document.getElementById('day3Low').innerHTML = Daily3.temp.min.toFixed(1) + '&deg;C';
      document.getElementById('forecast3').innerHTML = Daily3.weather[0].description;
      document.getElementById('idImg3').src = "src/images/weather/" + Daily3.weather[0].icon + ".png";

      // Updates the inner HTML of the element with id 'lastUpdate' 
      // to be a string representation of the Currentdate variable.
      // This displays the last update time on the page.
      document.getElementById('lastUpdate').innerHTML = Currentdate.toString();

    })
    .catch(error => {
      console.error('Error fetching weather data:', error);
      // document.getElementById('weatherError').innerHTML = '<p>Error loading weather data</p>';
    });
}


// Additional code (if any)
