# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

HomeMon is a Progressive Web App (PWA) for home monitoring that collects real-time sensor data from XBee wireless temperature sensors, HomeWizard energy monitors, and provides electricity price tracking with weather forecasts. The system uses a Raspberry Pi gateway to collect and publish data via PubNub to a web interface.

## Architecture

The system follows a hub-and-spoke architecture:

- **Frontend (PWA)**: HTML5/CSS3/JavaScript with Chart.js for data visualization, installable on mobile/desktop
- **Gateway (Python)**: Raspberry Pi-based collector that interfaces with:
  - XBee wireless temperature sensors via serial communication
  - HomeWizard P1 energy meter via HTTP API
  - External electricity price APIs (Swedish market)
- **Real-time Communication**: PubNub for bidirectional messaging between gateway and web clients
- **Data Storage**: InfluxDB time-series database for historical sensor and energy data
- **Hardware**: XBee modules for Zigbee sensors, HomeWizard P1 meter, Raspberry Pi gateway

Data flows from sensors → XBee → Raspberry Pi gateway → InfluxDB storage + PubNub publishing → Web frontend.

## Common Development Commands

### Frontend Development
```bash
# Install dependencies
npm install

# Start local development server (serves on http://localhost:8080)
npm start

# The PWA can be installed locally for testing
```

### Python Gateway Development
```bash
# Install Python dependencies
pip install pubnub influxdb-client requests pyserial

# Run the main gateway script
python src/Python/xbeegw.py

# Test Wallbox integration
python src/Python/Test/wallbox_test.py
```

## Configuration

The system uses environment variables with fallback defaults defined in `src/Python/config.py`:

### Required Environment Variables
- `PUBNUB_SUB_KEY` / `PUBNUB_PUB_KEY`: PubNub credentials for real-time messaging
- `INFLUX_HOST` / `INFLUX_DATABASE`: InfluxDB connection details
- `HOMEWIZARD_IP`: HomeWizard device IP address
- `XBEE_SERIAL_PORT`: Serial port for XBee module (default: `/dev/ttyS0`)

### Configuration Files
- `config.ini`: Main configuration file (copy from `config.ini.exemple`)
- Contains Wallbox credentials and other service configurations

### Example .env Setup
```bash
PUBNUB_SUB_KEY=your_subscribe_key
PUBNUB_PUB_KEY=your_publish_key
INFLUX_HOST=localhost
INFLUX_DATABASE=energy_monitoring
HOMEWIZARD_IP=192.168.1.100
XBEE_SERIAL_PORT=/dev/ttyUSB0
TIMEZONE_OFFSET_HOURS=1
```

## Hardware Integration

### Supported Hardware
- **Raspberry Pi**: Runs the Python gateway (`xbeegw.py`)
- **XBee Modules**: Zigbee wireless communication with temperature sensors
- **HomeWizard P1 Meter**: Smart electricity meter for energy monitoring

### Hardware Setup
1. **XBee Configuration**: Connect XBee module to Raspberry Pi serial port
2. **Sensor Deployment**: Place temperature sensors in monitored locations
3. **Network Setup**: Ensure HomeWizard device is accessible on local network
4. **Serial Permissions**: Add user to dialout group on Linux: `sudo usermod -a -G dialout $USER`

### Sensor Locations (as configured)
- Outside North/South (outdoor temperature sensors)
- Glass room (uterum) 
- Living room (vardagsrum)
- Pool temperature
- Garage temperature

## Key Modules and Handlers

### Python Gateway Components (`src/Python/`)
- `xbeegw.py`: Main gateway orchestrator and PubNub message handler
- `xbee_handler.py`: Serial communication with XBee modules
- `homewizard_handler.py`: HTTP client for HomeWizard energy data
- `influxdb_handler.py`: Time-series data storage operations
- `pubnub_handler.py`: Real-time messaging and client communication
- `electricityprices_handler.py`: External API integration for electricity pricing
- `config.py`: Environment-based configuration management

### Frontend JavaScript (`src/js/`)
- `app.js`: Service worker registration and PWA functionality
- `pubnub-gateway.js`: Real-time data updates and DOM manipulation
- `spot_price_chart.js`: Chart.js integration for electricity price visualization
- `weathermap.js`: Weather forecast display logic

## Development Workflows

### Adding a New Sensor Type
1. Extend XBee handler in `xbee_handler.py` to parse new sensor data format
2. Update DOM manipulation in `pubnub-gateway.js` to display new sensor data
3. Add corresponding HTML elements and CSS styling
4. Update InfluxDB schema in `influxdb_handler.py` if persistent storage needed

### Testing Real-time Communication
1. Start the Python gateway: `python src/Python/xbeegw.py`
2. Open the web interface in browser
3. Check browser console and gateway logs for PubNub connectivity
4. Verify sensor data updates in real-time on the web interface

### Data Query Development
The system supports querying historical energy data via PubNub messages:
```javascript
// Query hourly energy data
window.queryHourlyEnergy(0); // Today
window.queryHourlyEnergy(-1); // Yesterday
```

### Electricity Price Chart Features
The price chart automatically handles both hourly and 15-minute electricity spot price data:
- **Automatic aggregation**: 15-minute data is aggregated into hourly averages for main visualization
- **Reference bars**: Thin black bars show actual 15-minute total costs (spot + sales + distribution + VAT) overlaid on hourly averages
- **Enhanced tooltips**: Hover over hourly bars to see both average and individual 15-minute total costs
- **Touch-friendly tooltips**: On mobile devices, tooltips auto-hide after 3 seconds or on next tap
- **Smart consumption display**: Red consumption line excludes current hour (incomplete data) for today's view
- **Backward compatibility**: Maintains support for hourly data format

## Troubleshooting

### Common Issues
1. **XBee Communication**: Check serial port permissions and baud rate (9600)
2. **PubNub Connection**: Verify subscribe/publish keys in configuration
3. **InfluxDB Connection**: Ensure database is running and accessible
4. **HomeWizard Timeout**: Check device IP and network connectivity
5. **Service Worker Updates**: PWA checks for updates hourly automatically

### Debug Logging
- Gateway logs to console with timestamps
- Frontend logs PubNub messages to browser console
- Check `log/` directory for historical gateway logs

## File Structure Reference
```
homemon/
├── src/
│   ├── Python/           # Gateway and data handlers
│   ├── js/              # Frontend JavaScript modules  
│   ├── css/             # Styling
│   └── images/          # Icons and weather assets
├── index.html           # Main PWA entry point
├── manifest.json        # PWA configuration
├── sw.js               # Service worker
└── config.ini.exemple  # Configuration template
```