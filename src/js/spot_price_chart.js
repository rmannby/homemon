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
    spotPricesRawTomorrow: [],
    // Add storage for 15-minute total cost data (spot + sales + distribution + VAT)
    quarterHourSpotPrices: [], // Actually stores total costs, not just spot prices
    quarterHourLabels: [],
    // Store 15-minute data per day
    quarterHourSpotPricesToday: [],
    quarterHourSpotPricesYesterday: [],
    quarterHourSpotPricesTomorrow: []
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

// Vattenfall network costs (öre/kWh)
const DISTRIBUTION_COSTS = {
    TRANSMISSION: 35.60,    // Elöverföring
    ENERGY_TAX: 36.00       // Energiskatt
};

// Calculate total distribution cost
const TOTAL_DISTRIBUTION = Object.values(DISTRIBUTION_COSTS).reduce((a, b) => a + b, 0) / 100;

// Bixia sales costs (öre/kWh)
const SALES_COSTS = {
    VARIABLE: 5.00                     // Rörligt påslag
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

        // Check if data has 15-minute intervals (96 entries) or hourly (24 entries)
        const isQuarterHourly = data.length > 50; // Assume > 50 means 15-minute intervals
        
        console.log(`Electricity price data: ${data.length} entries detected, ${isQuarterHourly ? 'aggregating 15-minute to hourly' : 'using hourly data directly'}`);
        
        let labels, spotPricesRaw, prices;
        
        if (isQuarterHourly) {
            // Calculate total cost for 15-minute data (spot + sales + distribution + VAT)
            const quarterHourTotalPrices = data.map(entry => 
                ((entry.SEK_per_kWh + TOTAL_SALES + TOTAL_DISTRIBUTION) * (1 + VAT_RATE))
            );
            const quarterHourLabels = data.map(entry => {
                const date = new Date(entry.time_start);
                return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
            });
            
            // Store 15-minute data globally for chart rendering
            window.priceChart.quarterHourSpotPrices = quarterHourTotalPrices;
            window.priceChart.quarterHourLabels = quarterHourLabels;
            
            // Also store per-day for proper switching
            if (dayOffset === -1) {
                window.priceChart.quarterHourSpotPricesYesterday = quarterHourTotalPrices;
            } else if (dayOffset === 0) {
                window.priceChart.quarterHourSpotPricesToday = quarterHourTotalPrices;
            } else if (dayOffset === 1) {
                window.priceChart.quarterHourSpotPricesTomorrow = quarterHourTotalPrices;
            }
            
            // Aggregate 15-minute data into hourly averages
            const hourlyData = [];
            
            for (let hour = 0; hour < 24; hour++) {
                // Get all 15-minute intervals for this hour
                const quarterHourData = data.filter(entry => {
                    const date = new Date(entry.time_start);
                    return date.getHours() === hour;
                });
                
                if (quarterHourData.length > 0) {
                    // Calculate average spot price for this hour
                    const avgSpotPrice = quarterHourData.reduce((sum, entry) => 
                        sum + entry.SEK_per_kWh, 0) / quarterHourData.length;
                    
                    hourlyData.push({
                        hour: hour,
                        SEK_per_kWh: avgSpotPrice,
                        time_start: quarterHourData[0].time_start // Use first entry's timestamp
                    });
                }
            }
            
            // Create labels and prices from aggregated hourly data
            labels = hourlyData.map(entry => `${entry.hour}:00`);
            spotPricesRaw = hourlyData.map(entry => entry.SEK_per_kWh);
            prices = hourlyData.map(entry => 
                ((entry.SEK_per_kWh + TOTAL_SALES + TOTAL_DISTRIBUTION) * (1 + VAT_RATE)).toFixed(2)
            );
        } else {
            // Handle original hourly data format
            labels = data.map(entry => {
                const date = new Date(entry.time_start);
                return `${date.getHours()}:00`;
            });

            // Store raw spot prices for component calculations
            spotPricesRaw = data.map(entry => entry.SEK_per_kWh);

            // Total prices (for backwards compatibility)
            prices = data.map(entry => (
                ((entry.SEK_per_kWh + TOTAL_SALES + TOTAL_DISTRIBUTION) * (1 + VAT_RATE)).toFixed(2)
            ));
            
            // Clear 15-minute data when using hourly data
            window.priceChart.quarterHourSpotPrices = [];
            window.priceChart.quarterHourLabels = [];
            
            // Also clear per-day storage
            if (dayOffset === -1) {
                window.priceChart.quarterHourSpotPricesYesterday = [];
            } else if (dayOffset === 0) {
                window.priceChart.quarterHourSpotPricesToday = [];
            } else if (dayOffset === 1) {
                window.priceChart.quarterHourSpotPricesTomorrow = [];
            }
        }

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

    // EV charging reference price line is defined inline in plugins.annotation.annotations

    // Get current hour for highlighting
    const currentHour = new Date().getHours();
    
    // Get colors for components
    const getComponentColors = (hour, isCurrentHour, componentIndex) => {
        const baseColors = [
            'rgba(13, 71, 161, 0.8)',   // Spot price - dark blue
            'rgba(25, 118, 210, 0.8)',  // Bixia - medium blue
            'rgba(66, 165, 245, 0.8)'   // Vattenfall - light blue
        ];
        
        if (highlightCurrentHour && hour === currentHour) {
            const brighterColors = [
                'rgba(13, 71, 161, 0.9)',   // Spot price - slightly brighter
            'rgba(25, 118, 210, 0.9)',  // Bixia - slightly brighter
            'rgba(66, 165, 245, 0.9)'   // Vattenfall - slightly brighter
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
            yAxisID: 'y',
            barPercentage: 1.0,
            categoryPercentage: 0.9
        }
    ];
    
    // Note: 15-minute reference bars are drawn manually via the 'quarterHourReference' plugin

    if (showConsumption) {
        datasets.push({
            label: 'Förbrukning (kWh)',
            data: [], // Will be populated by energyDataReceived event
            type: 'line',
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderWidth: 4, // Slightly thicker for better visibility
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: 'rgba(255, 99, 132, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 3,
            yAxisID: 'y1',
            order: -10, // Lower order number = drawn later (on top)
            // Simplest possible gap configuration
            spanGaps: false,
            // Ensure line is always rendered on top
            z: 1000
        });
    }

    const chartConfig = {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                annotation: {
                    annotations: [
                        {
                            type: 'line',
                            yMin: 1.5,
                            yMax: 1.5,
                            borderColor: 'rgb(255, 99, 132)',
                            borderWidth: 3,
                            borderDash: [8, 4]
                        }
                    ]
                },
                legend: {
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        boxHeight: 12,
                        padding: 15,
                        // Generate custom legend entries
                        generateLabels: function(chart) {
                            const original = Chart.defaults.plugins.legend.labels.generateLabels(chart);
                            
                            // Create custom legend for cost components
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
                                    text: 'Bixia',
                                    fillStyle: 'rgba(25, 118, 210, 0.8)',
                                    strokeStyle: 'rgba(25, 118, 210, 0.9)',
                                    lineWidth: 1,
                                    hidden: false,
                                    index: 1
                                },
                                {
                                    text: 'Vattenfall',
                                    fillStyle: 'rgba(66, 165, 245, 0.8)',
                                    strokeStyle: 'rgba(66, 165, 245, 0.9)',
                                    lineWidth: 1,
                                    hidden: false,
                                    index: 2
                                }
                            ];
                            
                            // Add 15-minute reference legend if available
                            if (window.priceChart.quarterHourSpotPrices && window.priceChart.quarterHourSpotPrices.length > 0) {
                                customLegend.push({
                                    text: '15-min totalkostnad',
                                    fillStyle: 'rgba(121, 121, 128, 0.48)',
                                    strokeStyle: 'rgba(8, 8, 8, 0.69)', 
                                    lineWidth: 1,
                                    hidden: false,
                                    index: 3
                                });
                            }
                            
                            // Add consumption legend if the line dataset exists
                            if (showConsumption && original.length > 1) {
                                // Find the consumption dataset in the original legends
                                const consumptionLegend = original.find(item => 
                                    item.text && (item.text.includes('Förbrukning') || item.datasetIndex === 1)
                                );
                                
                                if (consumptionLegend) {
                                    // Add the consumption legend with line styling
                                    customLegend.push({
                                        text: consumptionLegend.text,
                                        fillStyle: consumptionLegend.fillStyle,
                                        strokeStyle: consumptionLegend.strokeStyle || 'rgba(255, 99, 132, 1)',
                                        lineWidth: 3, // Thicker line to show it's a line dataset
                                        hidden: consumptionLegend.hidden || false,
                                        index: consumptionLegend.index || 1,
                                        pointStyle: 'line' // Show as line in legend
                                    });
                                }
                            }
                            
                            return customLegend;
                        }
                    }
                },
                title: { display: true, text: 'El-spotpris - Kostnadsfördelning' },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    position: 'nearest',
                    // Touch-friendly: auto-hide after 3 seconds on mobile
                    events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
                    callbacks: {
                        label: function(context) {
                            const dataIndex = context.dataIndex;
                            const spotPrice = spotPricesWithVAT[dataIndex];
                            const total = totalPrices[dataIndex];
                            
                            if (context.datasetIndex === 0) {
                                // Main cost breakdown
                                const tooltipLines = [
                                    `Spotpris (genomsnitt): ${spotPrice.toFixed(4)} SEK/kWh`,
                                    `Bixia: ${salesCostWithVAT.toFixed(4)} SEK/kWh`,
                                    `Vattenfall: ${distributionCostWithVAT.toFixed(4)} SEK/kWh`,
                                    `Total: ${total.toFixed(4)} SEK/kWh`
                                ];
                                
                                // Add 15-minute details if available
                                if (window.priceChart.quarterHourSpotPrices && window.priceChart.quarterHourSpotPrices.length > 0) {
                                    const quarterStart = dataIndex * 4;
                                    const quarterPrices = window.priceChart.quarterHourSpotPrices.slice(quarterStart, quarterStart + 4);
                                    
                                    if (quarterPrices.length > 0) {
                                        tooltipLines.push('');
                                        tooltipLines.push('15-min totalkostnader:');
                                        quarterPrices.forEach((price, idx) => {
                                            const minutes = idx * 15;
                                            const timeStr = `${dataIndex}:${minutes.toString().padStart(2, '0')}`;
                                            tooltipLines.push(`${timeStr} - ${price.toFixed(4)} SEK/kWh`);
                                        });
                                    }
                                }
                                
                                return tooltipLines;
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
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    min: 0,
                    beginAtZero: true
                },
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: { display: showConsumption, text: 'kWh' },
                    grid: { drawOnChartArea: false },
                    display: showConsumption,
                    suggestedMin: 0,
                    suggestedMax: 1
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
        }, {
            id: 'quarterHourReference',
            afterDatasetDraw(chart, args) {
                // Only draw after the main bar dataset (index 0), before the line dataset
                if (args.index !== 0) return;
                // Only draw if 15-minute data is available
                if (!window.priceChart.quarterHourSpotPrices || window.priceChart.quarterHourSpotPrices.length === 0) {
                    return;
                }
                
                const ctx = chart.ctx;
                const meta = chart.getDatasetMeta(0); // Main dataset
                
                // Get chart scale info
                const yScale = chart.scales.y;
                
                ctx.save();
                
                // Color options for 15-minute bars:
                // Option 1: Bright Yellow/Amber (current)
                // ctx.fillStyle = 'rgba(255, 193, 7, 0.7)';
                // ctx.strokeStyle = 'rgba(255, 193, 7, 0.9)';
                
                // Option 2: Light Orange (uncomment to use)
                // ctx.fillStyle = 'rgba(255, 152, 0, 0.7)';
                // ctx.strokeStyle = 'rgba(255, 152, 0, 0.9)';
                
                // Option 3: Bright Green (uncomment to use)
                // ctx.fillStyle = 'rgba(76, 175, 80, 0.7)';
                // ctx.strokeStyle = 'rgba(76, 175, 80, 0.9)';
                
                // Option 4: Light Purple (uncomment to use)
                ctx.fillStyle = 'rgba(121, 121, 128, 0.48)';
                ctx.strokeStyle = 'rgba(8, 8, 8, 0.69)';
                
                // Option 5: Cyan (uncomment to use)
                // ctx.fillStyle = 'rgba(0, 188, 212, 0.7)';
                // ctx.strokeStyle = 'rgba(0, 188, 212, 0.9)';
                
                ctx.lineWidth = 0.8;
                
                meta.data.forEach((bar, hourIndex) => {
                    if (hourIndex >= 24) return; // Safety check
                    
                    const quarterStart = hourIndex * 4;
                    const quarterPrices = window.priceChart.quarterHourSpotPrices.slice(quarterStart, quarterStart + 4);
                    
                    if (quarterPrices.length === 0) return;
                    
                    const barX = bar.x;
                    const barWidth = bar.width;
                    const quarterWidth = barWidth / 4; // Divide hour bar into 4 quarters
                    
                    quarterPrices.forEach((price, quarterIndex) => {
                        if (price == null || isNaN(price)) return;
                        
                        // Calculate position for this quarter
                        const quarterX = barX - (barWidth / 2) + (quarterIndex * quarterWidth) + (quarterWidth / 2);
                        const quarterHeight = yScale.getPixelForValue(price) - yScale.getPixelForValue(0);
                        const quarterTop = yScale.getPixelForValue(price);
                        const quarterBottom = yScale.getPixelForValue(0);
                        
                        // Draw thin quarter-hour bar
                        const thinWidth = quarterWidth * 0.6; // Make it 60% of quarter width
                        ctx.fillRect(
                            quarterX - (thinWidth / 2), 
                            quarterTop, 
                            thinWidth, 
                            quarterBottom - quarterTop
                        );
                        
                        // Optional: Draw border for better visibility
                        ctx.strokeRect(
                            quarterX - (thinWidth / 2), 
                            quarterTop, 
                            thinWidth, 
                            quarterBottom - quarterTop
                        );
                    });
                });
                
                ctx.restore();
            }
        }, {
            id: 'touchFriendlyTooltip',
            afterEvent(chart, args) {
                const event = args.event;
                
                // Handle touch events
                if (event.type === 'touchstart' || event.type === 'click') {
                    // Clear any existing timeout
                    if (chart._tooltipTimeout) {
                        clearTimeout(chart._tooltipTimeout);
                    }
                    
                    // If tooltip is currently shown, hide it on this tap
                    if (chart.tooltip && chart.tooltip.opacity > 0) {
                        chart.tooltip.setActiveElements([], {x: 0, y: 0});
                        chart.update();
                        return;
                    }
                    
                    // Set timeout to auto-hide tooltip after 3 seconds on touch devices
                    chart._tooltipTimeout = setTimeout(() => {
                        if (chart.tooltip && chart.tooltip.opacity > 0) {
                            chart.tooltip.setActiveElements([], {x: 0, y: 0});
                            chart.update();
                        }
                    }, 3000);
                }
                
                // Clear timeout on mouseout (desktop)
                if (event.type === 'mouseout') {
                    if (chart._tooltipTimeout) {
                        clearTimeout(chart._tooltipTimeout);
                        chart._tooltipTimeout = null;
                    }
                }
            }
        }, {
            id: 'dynamicYScale',
            beforeInit(chart) {
                // Calculate the maximum value from both hourly and 15-minute data
                let maxValue = 0;
                
                if (chart.data.datasets[0] && chart.data.datasets[0].data) {
                    maxValue = Math.max(...chart.data.datasets[0].data.map(Number));
                }
                
                if (window.priceChart.quarterHourSpotPrices && window.priceChart.quarterHourSpotPrices.length > 0) {
                    const maxQuarterHour = Math.max(...window.priceChart.quarterHourSpotPrices.map(Number));
                    maxValue = Math.max(maxValue, maxQuarterHour);
                }
                
                // Ensure annotation line (1.50) is always visible
                maxValue = Math.max(maxValue, 1.50);
                
                // Set the scale max with 10% padding
                if (maxValue > 0) {
                    chart.options.scales.y.max = maxValue * 1.1;
                }
            }
        }]
    };
    
    window.priceChart.chartInstance = new Chart(ctx, chartConfig);
};
// Replace your energyDataReceived event handler with this version that properly handles the new format:

window.addEventListener('energyDataReceived', function(e) {
    const selector = document.getElementById('priceSelector');
    if (!selector || !window.priceChart.chartInstance) {
        return;
    }

    const rawData = e.detail;
    const selectedValue = Number(selector.value);

    if (!rawData || typeof rawData !== 'object' || !Array.isArray(rawData.hourly_usage)) {
        console.error('Received energy data in an unexpected format:', rawData);
        return;
    }

    const energyData = new Array(24).fill(NaN);
    rawData.hourly_usage.forEach(hourData => {
        const hour = hourData.hour;
        if (hour >= 0 && hour < 24) {
            energyData[hour] = hourData.usage_kwh;
        }
    });

    let displayData = energyData;
    if (selectedValue === 0) {
        const currentHour = new Date().getHours();
        // Exclude current hour from line graph (it's incomplete)
        displayData = energyData.slice(0, currentHour);
    }

    const totalEnergy = displayData
        .filter(val => !isNaN(val) && val !== null)
        .reduce((sum, val) => sum + Number(val), 0);

    const consumptionDatasetIndex = window.priceChart.chartInstance.data.datasets.findIndex(
        dataset => dataset.type === 'line'
    );

    if (consumptionDatasetIndex !== -1) {
        const consumptionDataset = window.priceChart.chartInstance.data.datasets[consumptionDatasetIndex];
        consumptionDataset.data = displayData;
        consumptionDataset.label = `Förbrukning (${totalEnergy.toFixed(1)} kWh)`;

        if (selectedValue === 0 || selectedValue === -1) {
            const pricesArray = selectedValue === 0 
                ? window.priceChart.pricesToday 
                : window.priceChart.pricesYesterday;

            if (pricesArray && pricesArray.length > 0) {
                const prices = pricesArray.map(Number);
                let totalCost = 0;

                for (let i = 0; i < Math.min(displayData.length, prices.length); i++) {
                    const consumption = displayData[i];
                    if (!isNaN(consumption) && consumption !== null) {
                        totalCost += consumption * prices[i];
                    }
                }
                
                window.priceChart.chartInstance.options.plugins.title.text = 
                    `Förbrukningskostnad (${totalCost.toFixed(2)} SEK)`;
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

    // Set highlightCurrentHour flag to true ONLY for today's view (dayOffset === 0)
    const highlightCurrentHour = (dayOffset === 0);

    if (dayOffset === -1) {  // Yesterday
        // Set the correct 15-minute data for yesterday before rendering
        window.priceChart.quarterHourSpotPrices = window.priceChart.quarterHourSpotPricesYesterday || [];
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
        // Set the correct 15-minute data for today before rendering
        window.priceChart.quarterHourSpotPrices = window.priceChart.quarterHourSpotPricesToday || [];
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
        // Set the correct 15-minute data for tomorrow before rendering
        window.priceChart.quarterHourSpotPrices = window.priceChart.quarterHourSpotPricesTomorrow || [];
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