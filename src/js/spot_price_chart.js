// JavaScript code to fetch electricity prices and render them in a chart
const fetchElectricityPrices = async () => {
    try {
        // Dynamically construct the API URL based on today's date and price class (SE3)
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

        const prices = data.map(entry => entry.SEK_per_kWh);

        // Calculate statistics
        const averagePrice = (prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2);
        const maxPrice = Math.max(...prices).toFixed(2);
        const minPrice = Math.min(...prices).toFixed(2);

        // Display statistics in a horizontal layout
        const statsContainer = document.querySelector('.electricity-prices');
        const statsElement = document.createElement('div');
        statsElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-top: 1em;">
                <p><strong>Genomsnitt:</strong> ${averagePrice} SEK/kWh</p>
                <p><strong>Högsta pris:</strong> ${maxPrice} SEK/kWh</p>
                <p><strong>Lägsta pris:</strong> ${minPrice} SEK/kWh</p>
            </div>
        `;
        statsContainer.appendChild(statsElement);

        renderChart(labels, prices);
    } catch (error) {
        console.error('Error fetching electricity prices:', error);
    }
};

const renderChart = (labels, data) => {
    const canvas = document.getElementById('priceChart');
    canvas.height = 75; // Sätt önskad höjd i pixlar

    const ctx = canvas.getContext('2d');

    // Adjust parent container styles for spanning three columns
    document.querySelector('.electricity-prices').style.gridColumn = "span 3";

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'El-spotpris (SEK/kWh)',
                data: data,
                borderColor: 'rgba(2, 169, 231, 1)',
                backgroundColor: 'rgba(2, 169, 231, 0.2)',
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true, // Keep the aspect ratio consistent
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: 'Dagens El-spotpris'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Tid'
                    }
                },
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
    setInterval(fetchElectricityPrices, 60 * 60 * 1000); // Uppdatera varje timme
});
