$(document).ready(function () {
  getWeather(); //Get the initial weather.
  setInterval(getWeather, 600000); //Update the weather every 10 minutes.
});

function convert(f) {
  return Math.round((f - 32) * 5 / 9);
}

function kphToMps(k) {
  return Math.round(k / 3.6);
}

var transCode = {
  0: 'Tornado',
  1: 'Tropisk storm',
  2: 'Orkan',
  3: 'Kraftiga åskväder',
  4: 'Åskväder',
  5: 'Blandat regn och snö',
  6: 'Blandat regn och slask',
  7: 'Blandat snö och slask',
  8: 'Underkylt duggregn',
  9: 'Duggregn',
  10: 'Underskylt regn',
  11: 'Regnskurar',
  12: 'Regnskurar',
  13: 'Snöbyar',
  14: 'Lätta snöbyar',
  15: 'Snöyra',
  16: 'Snö',
  17: 'Hagel',
  18: 'Snöblandat regn',
  19: 'Damm',
  20: 'Dimmigt',
  21: 'Disigt',
  22: 'Rökig',
  23: 'Stormigt',
  24: 'Blåsigt',
  25: 'Kyligt',
  26: 'Molnigt',
  27: 'Mestadels molnigt',
  28: 'Mestadels molnigt',
  29: 'Delvis molnigt',
  30: 'Delvis molnigt',
  31: 'Klart',
  32: 'Soligt',
  33: 'Fint',
  34: 'Fint',
  35: 'Blandat regn och hagel',
  36: 'Varmt',
  37: 'Enstaka åskväder',
  38: 'Spridda åskväder',
  39: 'Spridda åskväder',
  40: 'Spridda skurar',
  41: 'Tung snö',
  42: 'Spridda snöbyar',
  43: 'Tung snö',
  44: 'Delvis molnigt',
  45: 'Åskskurar',
  46: 'Snöbyar',
  47: 'Enstaka åskskurar',
  3200: 'NaN'

};

function getDayAndDate(forecast) {
  let day = forecast.date.split(' ')
  return `${forecast.day} ${day[0]}`
}

function getWeather() {
  $.simpleWeather({
    location: '',
    woeid: '887417', //Bracksta, Uppland
    unit: 'f',

    success: function (weather) {
      
      // console.log(weather)
      lastUpdate.innerHTML = weather.updated;

      //Forcast day 0 - Today
      day0.innerHTML = getDayAndDate(weather.forecast[0]);
      forecast0.innerHTML = transCode[weather.forecast[0].code];
      day0High.innerHTML = convert(weather.forecast[0].high) + '&deg';
      day0Low.innerHTML = convert(weather.forecast[0].low) + '&deg';
      document.getElementById('idImg0').src = "src/images/weather/" + weather.forecast[1].code + ".png";

      //Forcast day 1
      day1.innerHTML = getDayAndDate(weather.forecast[1]);
      forecast1.innerHTML = transCode[weather.forecast[1].code];
      day1High.innerHTML = convert(weather.forecast[1].high) + '&deg';
      day1Low.innerHTML = convert(weather.forecast[1].low) + '&deg';
      document.getElementById('idImg1').src = "src/images/weather/" + weather.forecast[1].code + ".png";

      //Forcast day 2
      day2.innerHTML = getDayAndDate(weather.forecast[2]);
      forecast2.innerHTML = transCode[weather.forecast[2].code];
      day2High.innerHTML = convert(weather.forecast[2].high) + '&deg';
      day2Low.innerHTML = convert(weather.forecast[2].low) + '&deg';
      document.getElementById('idImg2').src = "src/images/weather/" + weather.forecast[2].code + ".png";

      //Forcast day 3
      day3.innerHTML = getDayAndDate(weather.forecast[3]);
      forecast3.innerHTML = transCode[weather.forecast[3].code];
      day3High.innerHTML = convert(weather.forecast[3].high) + '&deg';
      day3Low.innerHTML = convert(weather.forecast[3].low) + '&deg';
      document.getElementById('idImg3').src = "src/images/weather/" + weather.forecast[3].code + ".png";

      //$("#weather").html(html);
      $("#weatherError").html('<p></p>');
    },
    error: function (error) {
      console.log(error);
      //$("#weatherError").html('<p>' + error + '</p>');
    }
  });
}