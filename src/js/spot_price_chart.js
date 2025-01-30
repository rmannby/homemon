let chartInstance = null;
let pricesToday = [];
let labelsToday = [];
let pricesTomorrow = [];
let labelsTomorrow = [];

// First, let's add a span for the asterisk next to the selector in the HTML
const selector = document.getElementById('priceSelector');
if (selector) {
    const asterisk = document.createElement('span');
    asterisk.id = 'tomorrowAvailable';
    asterisk.style.color = '#02A9E7'; // Same blue as the chart
    asterisk.style.marginLeft = '10px';
    asterisk.style.fontSize = '24px'; // Make the asterisk bigger
    asterisk.style.display = 'none';  // Hidden by default
    asterisk.textContent = '*';
    selector.parentNode.insertBefore(asterisk, selector.nextSibling);
}

// Then modify the fetchElectricityPrices function to update the asterisk visibility
const fetchElectricityPrices = async (dayOffset = 0) => {
    try {
        const today = new Date();
        today.setDate(today.getDate() + dayOffset);
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const priceClass = 'SE3';
        const apiUrl = `https://www.elprisetjustnu.se/api/v1/prices/${year}/${month}-${day}_${priceClass}.json`;

        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            if (response.status === 404) {
                console.log(`Priser för ${dayOffset === 0 ? 'idag' : 'morgondagen'} är inte tillgängliga (404).`);
                if (dayOffset === 1) {
                    // Hide asterisk if tomorrow's prices aren't available
                    const asterisk = document.getElementById('tomorrowAvailable');
                    if (asterisk) asterisk.style.display = 'none';
                }
            } else {
                console.error(`Fel vid hämtning av data (${response.status}):`, await response.text());
            }
            return null;
        }

        const data = await response.json();

        const labels = data.map(entry => {
            const date = new Date(entry.time_start);
            return `${date.getHours()}:00`;
        });

        const prices = data.map(entry => (entry.SEK_per_kWh * 1.25 + 13.53 / 100).toFixed(2));

        if (dayOffset === 0) {
            labelsToday = labels;
            pricesToday = prices;
        } else {
            labelsTomorrow = labels;
            pricesTomorrow = prices;
            // Show asterisk if tomorrow's prices are available
            const asterisk = document.getElementById('tomorrowAvailable');
            if (asterisk) asterisk.style.display = 'inline';
        }
        
        return { labels, prices };

    } catch (error) {
        console.error('Error fetching electricity prices:', error);
        if (dayOffset === 1) {
            // Hide asterisk on error
            const asterisk = document.getElementById('tomorrowAvailable');
            if (asterisk) asterisk.style.display = 'none';
        }
    }
};

const updatePriceStats = (prices) => {
    if (!prices || prices.length === 0) return;

    const averagePrice = (prices.reduce((sum, price) => sum + Number(price), 0) / prices.length).toFixed(2);
    const maxPrice = Math.max(...prices.map(Number)).toFixed(2);
    const minPrice = Math.min(...prices.map(Number)).toFixed(2);

    const statsElement = document.getElementById('priceStats');
    const [avgElement, maxElement, minElement] = statsElement.querySelectorAll('p');

    avgElement.innerHTML = `Genomsnitt: ${averagePrice} SEK/kWh`;
    maxElement.innerHTML = `Högsta pris: ${maxPrice} SEK/kWh`;
    minElement.innerHTML = `Lägsta pris: ${minPrice} SEK/kWh`;
};

const renderChart = (labels, data) => {
    const canvas = document.getElementById('priceChart');
    canvas.height = 75;
    const ctx = canvas.getContext('2d');

    if (chartInstance) {
        chartInstance.destroy();
    }

    // Check if any value is >= 1.5
    const hasHighValues = data.some(value => parseFloat(value) >= 1.5);

    // Create annotations object only if there are high values
    const annotations = hasHighValues ? {
        line1: {
            type: 'line',
            yMin: 1.50,
            yMax: 1.50,
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
                content: '1.50 SEK',
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(255, 99, 132, 0.2)'
            }
        }
    } : {};
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels, // Changed from 'hours' to 'labels'
                datasets: [{
                    label: 'Elpris (öre/kWh)',
                    data: data,
                    backgroundColor: labels.map(label => {
                        const isTomorrow = data === pricesTomorrow
                        return (!isTomorrow && label === `${new Date().getHours()}:00`)
                            ? 'rgba(255, 99, 132, 0.6)'  // Highlighted red for current hour
                            : 'rgba(2, 169, 231, 0.2)';  // Default blue
                    }),
                    borderColor: 'rgba(2, 169, 231, 1)',
                    borderWidth: 1,
                    yAxisID: 'y'
                }, {
                    label: 'Förbrukning (kWh)',
                    data: [],
                    type: 'line',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    yAxisID: 'y1'
                }]
            },
          options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                  legend: { position: 'top' },
                  title: { display: true, text: 'El-spotpris' },
                  annotation: {
                      annotations: annotations
                  }
              },
              scales: {
                  y: {
                      type: 'linear',
                      position: 'left',
                      title: { display: true, text: 'SEK/kWh' },
                      grid: {
                          color: 'rgba(255, 255, 255, 0.1)'
                      }
                  },
                  y1: {
                      type: 'linear',
                      position: 'right',
                      grid: {
                          drawOnChartArea: false
                      }
                  },
                  x: {
                      grid: {
                          color: 'rgba(255, 255, 255, 0.1)'
                      }
                  }
              }
          }    
      });
  };
    // Add event listener for energy data
    window.addEventListener('energyDataReceived', function(e) {
        chartInstance.data.datasets[1].data = e.detail;
        chartInstance.update();
    });

    // Update price selector handler
    document.getElementById('priceSelector').addEventListener('change', function() {
        const selectedValue = parseInt(this.value);
        if (selectedValue === 2) {
            queryHourlyEnergy(0);
        } else {
            updatePriceChart(selectedValue);
        }
    });

const updateChart = async (dayOffset) => {
    if (dayOffset === 0) {
        renderChart(labelsToday, pricesToday);
        updatePriceStats(pricesToday);
    } else if (dayOffset === 1) {
        if (pricesTomorrow.length > 0) {
            renderChart(labelsTomorrow, pricesTomorrow);
            updatePriceStats(pricesTomorrow);
        } else {
            const result = await fetchElectricityPrices(1);
            if (result) {
                renderChart(result.labels, result.prices);
                updatePriceStats(result.prices);
            } else {
                console.log("Morgondagens data är fortfarande inte tillgänglig.");
            }
        }
    }
};

// Initialize prices and start updates
const initializePrices = async () => {
    // Fetch both today's and tomorrow's prices immediately
    await fetchElectricityPrices(0);
    await fetchElectricityPrices(1);
    
    // Render initial chart with today's prices
    renderChart(labelsToday, pricesToday);
    updatePriceStats(pricesToday);
};

window.addEventListener('DOMContentLoaded', async () => {
    // Initialize immediately
    await initializePrices();

    // Set up periodic updates
    setInterval(async () => {
        await fetchElectricityPrices(0);
        await fetchElectricityPrices(1);
        
        // Reset selector to today's prices and update chart
        const selector = document.getElementById('priceSelector');
        if (selector) {
            selector.value = "0";
            updateChart(0);
        }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Add event listener to the price selector
    const selector = document.getElementById('priceSelector');
    if (selector) {
        selector.addEventListener('change', (e) => updateChart(Number(e.target.value)));
    } else {
        console.error("Dropdown med ID 'priceSelector' hittades inte i DOM.");
    }
});