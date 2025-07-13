# HomeMon - PWA Home Monitor

HomeMon is a Progressive Web App (PWA) designed for home monitoring. It provides real-time data on temperature from various sensors, weather forecasts, and electricity prices. The system uses a Raspberry Pi as a gateway to collect data from XBee wireless sensors and a HomeWizard energy monitor, and then publishes the data to the frontend using the PubNub real-time communication platform.

## Key Features

*   **Real-time Sensor Data:** Monitor temperature from multiple locations (e.g., living room, outdoors, pool, garage) using XBee wireless sensors.
*   **Energy Monitoring:** Track real-time power consumption and daily energy usage with data from a HomeWizard device.
*   **Electricity Price Tracking:** View current and historical electricity prices, and see forecasts for the next day. Data is visualized in an interactive chart using Chart.js.
*   **Weather Forecast:** Get a 4-day weather forecast for your location.
*   **Progressive Web App (PWA):** Installable on mobile devices and desktops for a native-app-like experience.
*   **Real-time Communication:** Utilizes PubNub for low-latency data streaming between the Raspberry Pi gateway and the web interface.
*   **Data Persistence:** Sensor and energy data are stored in an InfluxDB time-series database for historical analysis.

## Technology Stack

### Frontend

*   **HTML5, CSS3, JavaScript (ES6)**
*   **Chart.js:** For interactive electricity price charts.
*   **PubNub SDK:** For real-time data updates.
*   **PWA:** Manifest for installability and offline capabilities.

### Backend (Gateway)

*   **Python 3:** The core language for the gateway script.
*   **Raspberry Pi:** The hardware platform for the gateway.
*   **PubNub:** Real-time messaging.
*   **InfluxDB:** Time-series database for data storage.
*   **pyserial (for XBee):** Communication with Zigbee wireless sensors.
*   **requests (for HomeWizard & Electricity Prices):** To fetch data from the HomeWizard API and electricity price data source.

### Hardware

*   **Raspberry Pi:** Runs the Python gateway script.
*   **XBee Modules:** For wireless communication with temperature sensors.
*   **HomeWizard P1 Meter:** To monitor electricity consumption.

## Project Structure

```
homemon/
├── .gitignore
├── config.ini.exemple      # Example configuration file
├── index.html              # Main HTML file
├── manifest.json           # PWA manifest
├── package.json            # Frontend dependencies
├── README.md               # This file
├── sw.js                   # Service worker for PWA
└── src/
    ├── css/
    │   └── style.css       # Stylesheets
    ├── images/             # Image assets
    ├── js/
    │   ├── app.js          # Main application logic
    │   ├── pubnub-gateway.js # PubNub communication
    │   ├── spot_price_chart.js # Electricity price chart logic
    │   └── weathermap.js   # Weather forecast logic
    └── Python/
        ├── xbeegw.py       # Main Python gateway script
        ├── config.py       # Loads configuration
        ├── influxdb_handler.py # InfluxDB communication
        ├── homewizard_handler.py # HomeWizard communication
        ├── pubnub_handler.py # PubNub communication
        ├── xbee_handler.py # XBee communication
        └── electricityprices_handler.py # Electricity price fetching
```

## Installation and Usage

### Frontend

1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Start the web server:**
    ```bash
    npm start
    ```
    This will start a local web server, and you can access the application at `http://localhost:8080`.

### Backend (Gateway)

1.  **Set up the hardware:**
    *   Connect the XBee module to your Raspberry Pi's serial port.
    *   Ensure your HomeWizard P1 meter is connected to your network.
    *   Set up an InfluxDB instance and create a database.

2.  **Configure the gateway:**
    *   Copy `config.ini.exemple` to `config.ini`.
    *   Edit `config.ini` with your credentials and settings for InfluxDB, PubNub, HomeWizard, and the XBee serial port.

3.  **Install Python dependencies:**
    ```bash
    pip install pubnub influxdb-client requests pyserial
    ```

4.  **Run the gateway:**
    ```bash
    python src/Python/xbeegw.py
    ```
    The gateway will start collecting data and publishing it to the PubNub channel.

## License

This project is licensed under the ISC License. See the `LICENSE` file for details.
