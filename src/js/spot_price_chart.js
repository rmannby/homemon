// spot_price_chart.js
// Add this at the top of your spot_price_chart.js file, right after your Chart.js import or script tag
Chart.register({
    id: 'currentHourHighlighter',
    beforeDraw: (chart) => {
        const currentHour = new Date().getHours();
        const ctx = chart.ctx;
        
        // Find the current hour bar
        const hourIndex = chart.data.labels.findIndex(
            label => parseInt(label) === currentHour
        );
        
        if (hourIndex === -1) return;
        
        // Get vertical dimensions from the first dataset
        let meta = chart.getDatasetMeta(0);
        if (!meta.data || !meta.data[hourIndex]) return;
        
        const bar = meta.data[hourIndex];
        const x = bar.x;
        const width = bar.width;
        
        // Calculate full height of the stack
        let topY = Number.MAX_VALUE;
        let bottomY = 0;
        
        // Go through all datasets to find top and bottom
        for (let i = 0; i < chart.data.datasets.length; i++) {
            if (chart.data.datasets[i].stack !== 'stack0') continue;
            
            const datasetMeta = chart.getDatasetMeta(i);
            if (!datasetMeta.visible) continue;
            
            const dataPoint = datasetMeta.data[hourIndex];
            if (!dataPoint) continue;
            
            topY = Math.min(topY, dataPoint.y);
            bottomY = Math.max(bottomY, dataPoint.base);
        }
        
        // Draw red border
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 99, 132, 1)';
        ctx.lineWidth = 4;
        ctx.strokeRect(x - width/2, topY, width, bottomY - topY);
        ctx.restore();
    }
});

// Additional debugging code to verify the plugin is being called
console.log('Current hour highlighter plugin registered');

// Initialize global state
window.priceChart = {
    chartInstance: null,
    pricesToday: [],
    labelsToday: [],
    pricesTomorrow: [],
    labelsTomorrow: [],
    pricesYesterday: [],
    labelsYesterday: [],
    // Add storage for component prices
    spotPricesRawToday: [],
    spotPricesRawYesterday: [],
    spotPricesRawTomorrow: []
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

// Distribution costs (öre/kWh)
const DISTRIBUTION_COSTS = {
    TRANSMISSION: 31.20,    // Elöverföring
    ENERGY_TAX: 43.90      // Energiskatt
};

// Calculate total distribution cost
const TOTAL_DISTRIBUTION = Object.values(DISTRIBUTION_COSTS).reduce((a, b) => a + b, 0) / 100;

// Sales costs (öre/kWh)
const SALES_COSTS = {
    VARIABLE: 3.54,                    // Rörliga kostnader
    FIXED_SPOT: 7.00,                  // Fast påslag spot
    FIXED_CERTIFICATE: 1.40            // Fast påslag elcertifikat
};

// Calculate total sales cost
const TOTAL_SALES = Object.values(SALES_COSTS).reduce((a, b) => a + b, 0) / 100;

const ADDITIONAL_COSTS = (TOTAL_SALES + TOTAL_DISTRIBUTION);

// Average spot price for last year (from previous calculations)
const AVG_SPOTPRICE_LAST_YEAR = 40.88 / 100;

// VAT rate (25%)
const VAT_RATE = 0.25;

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

        // Store raw spot prices for component calculations
        const spotPricesRaw = data.map(entry => entry.SEK_per_kWh);

        // Total prices (for backwards compatibility)
        const prices = data.map(entry => (
            ((entry.SEK_per_kWh + TOTAL_SALES + TOTAL_DISTRIBUTION) * (1 + VAT_RATE)).toFixed(2)
        ));

        if (dayOffset === -1) {
            window.priceChart.labelsYesterday = labels;
            window.priceChart.pricesYesterday = prices;
            window.priceChart.spotPricesRawYesterday = spotPricesRaw;
        } else if (dayOffset === 0) {
            window.priceChart.labelsToday = labels;
            window.priceChart.pricesToday = prices;
            window.priceChart.spotPricesRawToday = spotPricesRaw;
        } else {
            window.priceChart.labelsTomorrow = labels;
            window.priceChart.pricesTomorrow = prices;
            window.priceChart.spotPricesRawTomorrow = spotPricesRaw;
            const asterisk = document.getElementById('tomorrowAvailable');
            if (asterisk) asterisk.style.display = 'inline';
        }
        
        return { labels, prices, spotPricesRaw };

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

    avgElement.innerHTML = `<strong>Genomsnitt:</strong> ${averagePrice} SEK/kWh`;
    maxElement.innerHTML = `<strong>Högsta pris:</strong> ${maxPrice} SEK/kWh`;
    minElement.innerHTML = `<strong>Lägsta pris:</strong> ${minPrice} SEK/kWh`;
};

const renderChart = (labels, prices, spotPricesRaw, showConsumption = true, highlightCurrentHour = true) => {
    const canvas = document.getElementById('priceChart');
    canvas.height = 75;
    const ctx = canvas.getContext('2d');

    if (window.priceChart.chartInstance) {
        window.priceChart.chartInstance.destroy();
    }

    // Calculate annotation for EV charging reference price line
    const annotations = {
        evChargeLine: {
            type: 'line',
            yMin: 1.50,
            yMax: 1.50,
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
                content: '1.50 SEK - EV laddning på jobbet',
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(255, 99, 132, 0.2)'
            }
        }
        /* Original annotation hidden for now - can be re-enabled later
        line1: {
            type: 'line',
            yMin: annotationPrice,
            yMax: annotationPrice,
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
                content: annotationPrice.toFixed(2) + ' SEK',
                enabled: true,
                position: 'end',
                backgroundColor: 'rgba(255, 99, 132, 0.2)'
            }
        }
        */
    };

    // Get current hour for highlighting
    const currentHour = new Date().getHours();
    
    // Get colors for components
    const getComponentColors = (hour, isCurrentHour, componentIndex) => {
        // Base colors for the three components (dark blue, medium blue, light blue)
        const baseColors = [
            'rgba(13, 71, 161, 0.7)',   // Spot price - darker blue
            'rgba(25, 118, 210, 0.7)',  // Sales - medium blue
            'rgba(66, 165, 245, 0.7)'   // Distribution - light blue
        ];
        
        // Return slightly more vibrant colors for the current hour
        if (highlightCurrentHour && hour === currentHour) {
            const brighterColors = [
                'rgba(13, 71, 161, 0.85)',   // Spot price - slightly brighter
                'rgba(25, 118, 210, 0.85)',  // Sales - slightly brighter
                'rgba(66, 165, 245, 0.85)'   // Distribution - slightly brighter
            ];
            return brighterColors[componentIndex];
        } else {
            return baseColors[componentIndex];
        }
    };
    
    // Create a custom plugin to draw a red border around the entire stack for current hour
    const currentHourStackBorder = {
        id: 'currentHourStackBorder',
        beforeDraw: function(chart) {
            if (!highlightCurrentHour) return;
            
            const currentHour = new Date().getHours();
            const ctx = chart.ctx;
            
            // Find the index of current hour in labels
            const hourIndex = chart.data.labels.findIndex(
                label => parseInt(label) === currentHour
            );
            
            if (hourIndex === -1) return;
            
            // Get all datasets with the same stack
            const stackedDatasets = chart.data.datasets.filter(
                dataset => dataset.stack === 'stack0'
            );
            
            if (stackedDatasets.length === 0) return;
            
            // Find positions for drawing border
            let barX, barWidth, topY, bottomY;
            let initialized = false;
            
            for (let i = 0; i < stackedDatasets.length; i++) {
                const datasetIndex = chart.data.datasets.indexOf(stackedDatasets[i]);
                const meta = chart.getDatasetMeta(datasetIndex);
                
                if (!meta.visible) continue;
                
                const bar = meta.data[hourIndex];
                if (!bar) continue;
                
                if (!initialized) {
                    barX = bar.x;
                    barWidth = bar.width;
                    topY = bar.y;
                    bottomY = bar.base;
                    initialized = true;
                } else {
                    topY = Math.min(topY, bar.y);
                    bottomY = Math.max(bottomY, bar.base);
                }
            }
            
            if (!initialized) return;
            
            // Draw red border around entire stack
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 0, 0, 1)'; // Pure red for better visibility
            ctx.lineWidth = 4; // Thicker border
            ctx.beginPath();
            ctx.rect(barX - barWidth/2, topY, barWidth, bottomY - topY);
            ctx.stroke();
            ctx.restore();
        }
    };

    // Component 1: Spot price with VAT
    const spotPricesWithVAT = spotPricesRaw.map((price) => {
        return (price * (1 + VAT_RATE)).toFixed(4);
    });

    // Component 2: Sales costs with VAT
    const salesCostsWithVAT = spotPricesRaw.map(() => {
        return (TOTAL_SALES * (1 + VAT_RATE)).toFixed(4);
    });

    // Component 3: Distribution costs with VAT
    const distributionCostsWithVAT = spotPricesRaw.map(() => {
        return (TOTAL_DISTRIBUTION * (1 + VAT_RATE)).toFixed(4);
    });

    // Create datasets for stacked bar chart with enhanced highlighting
    const datasets = [
        {
            label: 'Spotpris',
            data: spotPricesWithVAT,
            backgroundColor: labels.map((label) => {
                const hour = parseInt(label);
                return getComponentColors(hour, hour === currentHour, 0);
            }),
            borderColor: 'rgba(13, 71, 161, 0.8)',
            borderWidth: 1,
            yAxisID: 'y',
            stack: 'stack0',
            order: 1
        },
        {
            label: 'Försäljning',
            data: salesCostsWithVAT,
            backgroundColor: labels.map((label) => {
                const hour = parseInt(label);
                return getComponentColors(hour, hour === currentHour, 1);
            }),
            borderColor: 'rgba(25, 118, 210, 0.8)',
            borderWidth: 1,
            yAxisID: 'y',
            stack: 'stack0',
            order: 2
        },
        {
            label: 'Distribution',
            data: distributionCostsWithVAT,
            backgroundColor: labels.map((label) => {
                const hour = parseInt(label);
                return getComponentColors(hour, hour === currentHour, 2);
            }),
            borderColor: 'rgba(66, 165, 245, 0.8)',
            borderWidth: 1,
            yAxisID: 'y',
            stack: 'stack0',
            order: 3
        }
    ];

    // Add consumption dataset if needed
    if (showConsumption) {
        datasets.push({
            label: 'Förbrukning (kWh)',
            data: [], // Will be populated by energyDataReceived event
            type: 'line',
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: 'rgba(255, 99, 132, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            yAxisID: 'y1',
            // Not part of the stack
            stack: 'consumption',
            // Use negative order to ensure it's drawn on top
            order: -1
        });
    }

    window.priceChart.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { 
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 15
                    }
                },
                title: { display: true, text: 'El-spotpris - Kostnadsfördelning' },
                annotation: { annotations },
                tooltip: {
                    callbacks: {
                        // Add a custom footer to show total price
                        footer: (tooltipItems) => {
                            // Calculate total from all stacks for this data point
                            const index = tooltipItems[0].dataIndex;
                            let total = 0;
                            
                            // Sum all components that are in the price stack
                            tooltipItems.forEach(item => {
                                if (item.dataset.stack === 'stack0') {
                                    total += parseFloat(item.raw);
                                }
                            });
                            
                            return `Totalt: ${total.toFixed(2)} SEK/kWh`;
                        }
                    }
                },
                // Explicitly register the custom plugin
                currentHourStackBorder
            },
            scales: {
                y: {
                    stacked: true, // Enable stacking on the price axis
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
                    stacked: true, // Enable stacking on the x-axis
                    grid: { color: 'rgba(255, 255, 255, 0.1)' }
                }
            }
        }
    });
};

window.addEventListener('energyDataReceived', function(e) {
    const selector = document.getElementById('priceSelector');
    if (selector && window.priceChart.chartInstance && window.priceChart.chartInstance.data.datasets.length > 3) {
        let energyData = e.detail;
        const selectedValue = Number(selector.value);
        
        if (selectedValue === 0) {
            const currentHour = new Date().getHours();
            energyData = energyData.slice(0, currentHour);
        }
        
        const totalEnergy = energyData.reduce((sum, val) => sum + Number(val), 0);
        
        // Add to consumption dataset (now at index 3)
        window.priceChart.chartInstance.data.datasets[3].data = energyData;
        window.priceChart.chartInstance.data.datasets[3].label = `Förbrukning (${totalEnergy.toFixed(1)} kWh)`;
        
        if (selectedValue === 0 || selectedValue === -1) {
            let pricesArray = selectedValue === 0 
                ? window.priceChart.pricesToday 
                : window.priceChart.pricesYesterday;
            
            if (pricesArray && pricesArray.length > 0) {
                const prices = pricesArray.map(Number);
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
                
                // Update chart title to show the total cost
                window.priceChart.chartInstance.options.plugins.title.text = 
                    `Förbrukningskostnad (${totalCostDisplay} SEK)`;
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
                renderChart(result.labels, result.prices, result.spotPricesRaw, true, false);
                updatePriceStats(result.prices);
            }
        } else {
            renderChart(
                window.priceChart.labelsYesterday, 
                window.priceChart.pricesYesterday, 
                window.priceChart.spotPricesRawYesterday, 
                true, 
                false
            );
            updatePriceStats(window.priceChart.pricesYesterday);
        }
    } else if (dayOffset === 0) {  // Today
        if (window.priceChart.pricesToday.length === 0) {
            const result = await fetchElectricityPrices(0);
            if (result) {
                renderChart(result.labels, result.prices, result.spotPricesRaw, true, true);
                updatePriceStats(result.prices);
            }
        } else {
            renderChart(
                window.priceChart.labelsToday, 
                window.priceChart.pricesToday, 
                window.priceChart.spotPricesRawToday, 
                true, 
                true
            );
            updatePriceStats(window.priceChart.pricesToday);
        }
    } else if (dayOffset === 1) {  // Tomorrow – disable current hour highlighting
        if (window.priceChart.pricesTomorrow.length === 0) {
            const result = await fetchElectricityPrices(1);
            if (result) {
                renderChart(result.labels, result.prices, result.spotPricesRaw, false, false);
                updatePriceStats(result.prices);
            }
        } else {
            renderChart(
                window.priceChart.labelsTomorrow, 
                window.priceChart.pricesTomorrow, 
                window.priceChart.spotPricesRawTomorrow, 
                false, 
                false
            );
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