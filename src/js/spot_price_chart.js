// spot_price_chart.js
// Add this at the top of your spot_price_chart.js file, right after your Chart.js import or script tag

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


// Simpler solution: Single dataset with custom legend generation
// This ensures thick bars while providing proper legend

const renderChart = (labels, prices, spotPricesRaw, showConsumption = true, highlightCurrentHour = true) => {
    const canvas = document.getElementById('priceChart');
    canvas.height = 75;
    const ctx = canvas.getContext('2d');

    // Disable old global plugins that might interfere
    try {
        Chart.unregister('currentHourHighlighter');
        Chart.unregister('currentHourStackBorder');
    } catch (e) {
        // Plugins might not be registered, ignore error
    }

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
    };

    // Get current hour for highlighting
    const currentHour = new Date().getHours();
    
    // Get colors for components
    const getComponentColors = (hour, isCurrentHour, componentIndex) => {
        const baseColors = [
            'rgba(13, 71, 161, 0.8)',   // Spot price - dark blue
            'rgba(25, 118, 210, 0.8)',  // Sales - medium blue  
            'rgba(66, 165, 245, 0.8)'   // Distribution - light blue
        ];
        
        if (highlightCurrentHour && hour === currentHour) {
            const brighterColors = [
                'rgba(13, 71, 161, 0.9)',   // Spot price - slightly brighter
                'rgba(25, 118, 210, 0.9)',  // Sales - slightly brighter
                'rgba(66, 165, 245, 0.9)'   // Distribution - slightly brighter
            ];
            return brighterColors[componentIndex];
        } else {
            return baseColors[componentIndex];
        }
    };

    // Calculate component values
    const spotPricesWithVAT = spotPricesRaw.map((price) => {
        return price * (1 + VAT_RATE);
    });

    const salesCostWithVAT = TOTAL_SALES * (1 + VAT_RATE);
    const distributionCostWithVAT = TOTAL_DISTRIBUTION * (1 + VAT_RATE);

    // Calculate total prices for the main bars
    const totalPrices = spotPricesWithVAT.map(spotPrice => 
        spotPrice + salesCostWithVAT + distributionCostWithVAT
    );

    // Single dataset approach for thick bars
    const datasets = [
        {
            label: 'Totalkostnad',
            data: totalPrices,
            backgroundColor: 'rgba(66, 165, 245, 0.7)', // Will be overridden by custom drawing
            borderColor: 'rgba(66, 165, 245, 0.8)',
            borderWidth: 1,
            yAxisID: 'y'
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
            order: -1 // Ensure line is drawn on top
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
                        padding: 15,
                        // Generate custom legend entries
                        generateLabels: function(chart) {
                            const original = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            
                            // Replace the first dataset legend with our custom component legends
                            const customLegend = [
                                {
                                    text: 'Spotpris',
                                    fillStyle: 'rgba(13, 71, 161, 0.8)',
                                    strokeStyle: 'rgba(13, 71, 161, 0.9)',
                                    lineWidth: 1,
                                    hidden: false,
                                    index: 0
                                },
                                {
                                    text: 'Försäljning',
                                    fillStyle: 'rgba(25, 118, 210, 0.8)',
                                    strokeStyle: 'rgba(25, 118, 210, 0.9)',
                                    lineWidth: 1,
                                    hidden: false,
                                    index: 1
                                },
                                {
                                    text: 'Distribution',
                                    fillStyle: 'rgba(66, 165, 245, 0.8)',
                                    strokeStyle: 'rgba(66, 165, 245, 0.9)',
                                    lineWidth: 1,
                                    hidden: false,
                                    index: 2
                                }
                            ];
                            
                            // Add consumption legend if it exists
                            if (original.length > 1) {
                                customLegend.push(original[1]); // Add the line dataset legend
                            }
                            
                            return customLegend;
                        }
                    }
                },
                title: { display: true, text: 'El-spotpris - Kostnadsfördelning' },
                annotation: { annotations },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataIndex = context.dataIndex;
                            const spotPrice = spotPricesWithVAT[dataIndex];
                            const total = totalPrices[dataIndex];
                            
                            if (context.datasetIndex === 0) {
                                // Main cost breakdown
                                return [
                                    `Spotpris: ${spotPrice.toFixed(4)} SEK/kWh`,
                                    `Försäljning: ${salesCostWithVAT.toFixed(4)} SEK/kWh`,
                                    `Distribution: ${distributionCostWithVAT.toFixed(4)} SEK/kWh`,
                                    `Total: ${total.toFixed(4)} SEK/kWh`
                                ];
                            } else {
                                // Consumption line
                                return `${context.dataset.label}: ${context.parsed.y} kWh`;
                            }
                        }
                    }
                },
                currentHourHighlighter: {
                    disabled: !highlightCurrentHour
                }
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
        },
        // Custom plugins for drawing segments and highlighting
        plugins: [{
            id: 'costBreakdown',
            beforeDatasetsDraw(chart) {
                const ctx = chart.ctx;
                const meta = chart.getDatasetMeta(0);
                
                meta.data.forEach((bar, index) => {
                    const spotPrice = spotPricesWithVAT[index];
                    const totalPrice = totalPrices[index];
                    
                    const x = bar.x;
                    const width = bar.width;
                    const bottom = bar.base;
                    const top = bar.y;
                    const totalHeight = bottom - top;
                    
                    // Calculate segment heights based on proportions
                    const spotHeight = (spotPrice / totalPrice) * totalHeight;
                    const salesHeight = (salesCostWithVAT / totalPrice) * totalHeight;
                    const distributionHeight = (distributionCostWithVAT / totalPrice) * totalHeight;
                    
                    let currentY = bottom;
                    
                    // Draw spot price segment
                    if (spotPrice !== 0) {
                        ctx.fillStyle = getComponentColors(parseInt(labels[index]), 
                            highlightCurrentHour && parseInt(labels[index]) === currentHour, 0);
                        ctx.fillRect(x - width/2, currentY - Math.abs(spotHeight), width, Math.abs(spotHeight));
                        currentY -= spotHeight;
                    }
                    
                    // Draw sales segment
                    ctx.fillStyle = getComponentColors(parseInt(labels[index]), 
                        highlightCurrentHour && parseInt(labels[index]) === currentHour, 1);
                    ctx.fillRect(x - width/2, currentY - salesHeight, width, salesHeight);
                    currentY -= salesHeight;
                    
                    // Draw distribution segment
                    ctx.fillStyle = getComponentColors(parseInt(labels[index]), 
                        highlightCurrentHour && parseInt(labels[index]) === currentHour, 2);
                    ctx.fillRect(x - width/2, currentY - distributionHeight, width, distributionHeight);
                });
            }
        }, {
            id: 'currentHourHighlight',
            beforeDatasetsDraw(chart) {
                // Only draw if highlighting is enabled
                if (!highlightCurrentHour) return;
                
                const currentHour = new Date().getHours();
                const ctx = chart.ctx;
                
                // Find the current hour bar
                const hourIndex = chart.data.labels.findIndex(
                    label => parseInt(label) === currentHour
                );
                
                if (hourIndex === -1) return;
                
                const meta = chart.getDatasetMeta(0);
                if (!meta.data || !meta.data[hourIndex]) return;
                
                const bar = meta.data[hourIndex];
                const x = bar.x;
                const width = bar.width;
                const top = bar.y;
                const bottom = bar.base;
                
                // Draw red border around the entire bar
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 99, 132, 1)';
                ctx.lineWidth = 4;
                ctx.strokeRect(x - width/2, top, width, bottom - top);
                ctx.restore();
            }
        }]
    });
};

// Event handler for energy consumption data
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
        
        // Find the consumption dataset (it's the line dataset)
        const consumptionDatasetIndex = window.priceChart.chartInstance.data.datasets.findIndex(
            dataset => dataset.type === 'line'
        );
        
        if (consumptionDatasetIndex !== -1) {
            // Add to consumption dataset
            window.priceChart.chartInstance.data.datasets[consumptionDatasetIndex].data = energyData;
            window.priceChart.chartInstance.data.datasets[consumptionDatasetIndex].label = `Förbrukning (${totalEnergy.toFixed(1)} kWh)`;
            
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
    }
});

const updateChart = async (dayOffset) => {
    // Query energy data for historical days
    if (dayOffset <= 0) {
        const influxOffset = dayOffset === -1 ? 1 : 0;
        window.queryHourlyEnergy?.(influxOffset);
    }

    // Set highlightCurrentHour flag to true ONLY for today's view (dayOffset === 0)
    const highlightCurrentHour = (dayOffset === 0);

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
                false // Explicitly set to false for yesterday
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
                true // Explicitly set to true for today
            );
            updatePriceStats(window.priceChart.pricesToday);
        }
    } else if (dayOffset === 1) {  // Tomorrow
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
                false // Explicitly set to false for tomorrow
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