// JavaScript code to fetch electricity prices and render them in a chart
let chartInstance = null;

const fetchElectricityPrices = async () => {
    try {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const priceClass = 'SE3';
        const apiUrl = `https://www.elprisetjustnu.se/api/v1/prices/${year}/${month}-${day}_${priceClass}.json`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        const labels = data.map(entry => {
            const date = new Date(entry.time_start);
            return `${date.getHours()}:00`;
        });

        // Vattenfall's price formula: (spot price × 1.25) + (13.53/100)
        const prices = data.map(entry => (entry.SEK_per_kWh * 1.25 + 13.53/100).toFixed(2));

        const averagePrice = (prices.reduce((sum, price) => sum + Number(price), 0) / prices.length).toFixed(2);
        const maxPrice = Math.max(...prices.map(Number)).toFixed(2);
        const minPrice = Math.min(...prices.map(Number)).toFixed(2);

        const statsElement = document.getElementById('priceStats');
        const [avgElement, maxElement, minElement] = statsElement.querySelectorAll('p');

        avgElement.innerHTML = `Genomsnitt: ${averagePrice} SEK/kWh`;
        maxElement.innerHTML = `Högsta pris: ${maxPrice} SEK/kWh`;
        minElement.innerHTML = `Lägsta pris: ${minPrice} SEK/kWh`;

        renderChart(labels, prices);
    } catch (error) {
        console.error('Error fetching electricity prices:', error);
    }
};
const renderChart = (labels, data) => {
    const canvas = document.getElementById('priceChart');
    canvas.height = 75; // Sätt önskad höjd i pixlar

    const ctx = canvas.getContext('2d');

    // Destroy existing chart instance if it exists
    if (chartInstance) {
        const now = new Date();
        console.log(`[${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}] Destroying existing chart instance.`);
        chartInstance.destroy();
    }

    // Determine the current hour
    const now = new Date();
    const currentHour = `${now.getHours()}:00`;

    console.log(`[${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}] Re-rendering chart with updated data.`);

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Vattenfall-timpris (SEK/kWh)',
                data: data,
                borderColor: 'rgba(2, 169, 231, 1)',
                backgroundColor: 'rgba(2, 169, 231, 0.2)',
                fill: true,
                pointBackgroundColor: labels.map(label => label === currentHour ? 'red' : 'rgba(2, 169, 231, 1)'),
                pointRadius: labels.map(label => label === currentHour ? 6 : 3),
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Dagens El-spotpris'
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 1.5,
                            yMax: 1.5,
                            borderColor: 'rgba(255, 99, 132, 1)',
                            borderWidth: 2,
                            borderDash: [6, 6],
                            label: {
                                content: '1.5 SEK',
                                enabled: true,
                                position: 'end',
                                backgroundColor: 'rgba(255, 99, 132, 0.2)'
                            }
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'SEK/kWh'
                    }
                }
            }
        }
    });
};

// Fetch and render electricity prices on page load
window.addEventListener('DOMContentLoaded', () => {
    fetchElectricityPrices();
    setInterval(() => {
        fetchElectricityPrices();
    }, 5 * 60 * 1000); // Uppdatera var femte minut
});
