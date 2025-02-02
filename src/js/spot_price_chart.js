// spot_price_chart.js

// Initialize global state
window.priceChart = {
    chartInstance: null,
    pricesToday: [],
    labelsToday: [],
    pricesTomorrow: [],
    labelsTomorrow: [],
    pricesYesterday: [],
    labelsYesterday: []
};

const selector = document.getElementById('priceSelector');
if (selector) {
    const asterisk = document.createElement('span');
    asterisk.id = 'tomorrowAvailable';
    asterisk.style.color = '#02A9E7';
    asterisk.style.marginLeft = '10px';
    asterisk.style.fontSize = '24px';
    asterisk.style.display = 'none';
    asterisk.textContent = '*';
    selector.parentNode.insertBefore(asterisk, selector.nextSibling);
}

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
                console.log(`Priser för ${dayOffset === 0 ? 'idag' : dayOffset === 1 ? 'imorgon' : 'igår'} är inte tillgängliga (404).`);
                if (dayOffset === 1) {
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

        if (dayOffset === -1) {
            window.priceChart.labelsYesterday = labels;
            window.priceChart.pricesYesterday = prices;
        } else if (dayOffset === 0) {
            window.priceChart.labelsToday = labels;
            window.priceChart.pricesToday = prices;
        } else {
            window.priceChart.labelsTomorrow = labels;
            window.priceChart.pricesTomorrow = prices;
            const asterisk = document.getElementById('tomorrowAvailable');
            if (asterisk) asterisk.style.display = 'inline';
        }
        
        return { labels, prices };

    } catch (error) {
        console.error('Error fetching electricity prices:', error);
        if (dayOffset === 1) {
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

const renderChart = (labels, data, showConsumption = true, highlightCurrentHour = true) => {
    const canvas = document.getElementById('priceChart');
    canvas.height = 75;
    const ctx = canvas.getContext('2d');

    if (window.priceChart.chartInstance) {
        window.priceChart.chartInstance.destroy();
    }

    const annotations = data.some(value => parseFloat(value) >= 1.5) ? {
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

    const datasets = [{
        label: 'Elpris (SEK/kWh)',
        data: data,
        backgroundColor: labels.map((label) => {
            const hour = parseInt(label);
            const currentHour = new Date().getHours();
            return (highlightCurrentHour && hour === currentHour) 
                ? 'rgba(255, 99, 132, 0.6)'  
                : 'rgba(2, 169, 231, 0.2)';
        }),
        borderColor: 'rgba(2, 169, 231, 1)',
        borderWidth: 1,
        yAxisID: 'y'
    }];

    if (showConsumption) {
        datasets.push({
            label: 'Förbrukning (kWh)',
            data: [], // Will be populated by energyDataReceived event
            type: 'line',
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            yAxisID: 'y1'
        });
    }

    window.priceChart.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'El-spotpris' },
                annotation: { annotations }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'SEK/kWh' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: { display: showConsumption, text: 'kWh' },
                    grid: { drawOnChartArea: false },
                    display: showConsumption
                },
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
};

window.addEventListener('energyDataReceived', function(e) {
    const selector = document.getElementById('priceSelector');
    if (selector && window.priceChart.chartInstance && window.priceChart.chartInstance.data.datasets.length > 1) {
        let energyData = e.detail;
        const selectedValue = Number(selector.value);
        
        if (selectedValue === 0) {
            const currentHour = new Date().getHours();
            energyData = energyData.slice(0, currentHour);
        }
        
        const totalEnergy = energyData.reduce((sum, val) => sum + Number(val), 0);
        
        window.priceChart.chartInstance.data.datasets[1].data = energyData;
        window.priceChart.chartInstance.data.datasets[1].label = `Förbrukning (${totalEnergy.toFixed(1)} kWh)`;
        
        if (selectedValue === 0 || selectedValue === -1) {
            let priceArray = selectedValue === 0 
                ? window.priceChart.pricesToday 
                : window.priceChart.pricesYesterday;
            
            if (priceArray && priceArray.length > 0) {
                const prices = priceArray.map(Number);
                const hoursToProcess = Math.min(energyData.length, prices.length);
                let totalCost = 0;
                let weightedConsumption = 0;
                
                for (let i = 0; i < hoursToProcess; i++) {
                    const consumption = Number(energyData[i]);
                    const price = prices[i];
                    totalCost += consumption * price;
                    weightedConsumption += consumption;
                }
                
                const averagePrice = weightedConsumption > 0 ? totalCost / weightedConsumption : 0;
                const totalCostDisplay = totalCost.toFixed(2);
                window.priceChart.chartInstance.data.datasets[0].label =
                    `Elpris (${averagePrice.toFixed(2)} SEK/kWh, Totalt: ${totalCostDisplay} SEK)`;
            }
        }
        
        window.priceChart.chartInstance.update();
    }
});

const updateChart = async (dayOffset) => {
    // Query energy data for historical days
    if (dayOffset <= 0) {
        const influxOffset = dayOffset === -1 ? 1 : 0;
        window.queryHourlyEnergy?.(influxOffset);
    }

    if (dayOffset === -1) {  // Yesterday
        if (window.priceChart.pricesYesterday.length === 0) {
            const result = await fetchElectricityPrices(-1);
            if (result) {
                renderChart(result.labels, result.prices, true, false);
                updatePriceStats(result.prices);
            }
        } else {
            renderChart(window.priceChart.labelsYesterday, window.priceChart.pricesYesterday, true, false);
            updatePriceStats(window.priceChart.pricesYesterday);
        }
    } else if (dayOffset === 0) {  // Today
        if (window.priceChart.pricesToday.length === 0) {
            const result = await fetchElectricityPrices(0);
            if (result) {
                renderChart(result.labels, result.prices, true, true);
                updatePriceStats(result.prices);
            }
        } else {
            renderChart(window.priceChart.labelsToday, window.priceChart.pricesToday, true, true);
            updatePriceStats(window.priceChart.pricesToday);
        }
    } else if (dayOffset === 1) {  // Tomorrow – disable current hour highlighting
        if (window.priceChart.pricesTomorrow.length === 0) {
            const result = await fetchElectricityPrices(1);
            if (result) {
                renderChart(result.labels, result.prices, false, false);
                updatePriceStats(result.prices);
            }
        } else {
            renderChart(window.priceChart.labelsTomorrow, window.priceChart.pricesTomorrow, false, false);
            updatePriceStats(window.priceChart.pricesTomorrow);
        }
    }
};

const initializePrices = async () => {
    await fetchElectricityPrices(-1); // Yesterday
    await fetchElectricityPrices(0);  // Today
    await fetchElectricityPrices(1);  // Tomorrow
    
    // Initialize with today's data (value 0)
    updateChart(0);
};

// Set the update interval in milliseconds (e.g., 1 minute or 1 hour)
const UPDATE_INTERVAL = 900000; // 900000ms = 15 minutes

const schedulePriceUpdates = () => {
    const now = new Date();
    // Calculate the next boundary based on UPDATE_INTERVAL.
    // This works by rounding the current time up to the next multiple of UPDATE_INTERVAL.
    const nextBoundary = Math.ceil(now.getTime() / UPDATE_INTERVAL) * UPDATE_INTERVAL;
    const delay = nextBoundary - now.getTime();

    setTimeout(() => {
        updateAllPriceData();
        // Then set the interval for all subsequent updates:
        setInterval(updateAllPriceData, UPDATE_INTERVAL);
    }, delay);
};

const updateAllPriceData = async () => {
    await fetchElectricityPrices(-1);
    await fetchElectricityPrices(0);
    await fetchElectricityPrices(1);

    const selector = document.getElementById('priceSelector');
    if (selector) {
        updateChart(Number(selector.value));
    }
};

window.addEventListener('DOMContentLoaded', async () => {
    await initializePrices();
    schedulePriceUpdates();

    const selector = document.getElementById('priceSelector');
    if (selector) {
        selector.addEventListener('change', (e) => updateChart(Number(e.target.value)));
    } else {
        console.error("Dropdown med ID 'priceSelector' hittades inte i DOM.");
    }
});