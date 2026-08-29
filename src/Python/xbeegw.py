# xbeegw.py
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Tuple

from config import (GATEWAY_CONFIG, HOMEWIZARD_CONFIG, INFLUX_CONFIG,
                    PUBNUB_CONFIG, XBEE_CONFIG)
from electricityprices_handler import get_electricity_prices
from homewizard_handler import HomeWizardHandler
from influxdb_handler import InfluxDBHandler
from pubnub_handler import PubNubHandler
from xbee_handler import XBeeHandler

# Constants
PUBNUB_CHANNEL = 'RpiGate'
DEFAULT_PRICE_REGION = "SE3"

class Gateway:
    def build_hourly_net_energy(
        self, result: List[Dict[str, Any]], local_offset: timedelta
    ) -> Tuple[List[Dict[str, Any]], float, float, float]:
        """Convert hourly cumulative-meter spreads to import, export, and net energy."""
        hourly_data = []
        total_import = 0.0
        total_export = 0.0

        for point in result:
            hourly_import = point.get('hourly_import_kwh')
            hourly_export = point.get('hourly_export_kwh')

            if hourly_import is None and hourly_export is None:
                continue

            import_kwh = round(float(hourly_import or 0), 3)
            export_kwh = round(float(hourly_export or 0), 3)
            net_kwh = round(import_kwh - export_kwh, 3)
            point_time = datetime.fromisoformat(point['time'].replace('Z', '+00:00'))
            local_time = point_time + local_offset

            total_import += import_kwh
            total_export += export_kwh
            hourly_data.append({
                'hour': local_time.hour,
                'datetime': local_time.strftime('%Y-%m-%dT%H:%M:%S+01:00'),
                # Retain the existing field name for frontend compatibility.
                'usage_kwh': net_kwh,
                'import_kwh': import_kwh,
                'export_kwh': export_kwh,
                'net_kwh': net_kwh
            })

        return hourly_data, total_import, total_export, total_import - total_export
    def handle_pubnub_message(self, message):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] Raw message received: {message}")

        # Handle simple string messages first
        if message == 'Connected':
            print(f"[{timestamp}] New client connected - publishing current data")
            current_data = self.xbee_handler.get_current_data()
            # Publish to the main channel as response channel is not available
            self.pubnub_handler.publish_data(current_data, PUBNUB_CHANNEL)
            return

        # Process complex messages (expected to be JSON)
        if isinstance(message, str):
            try:
                message = json.loads(message.replace('Copy', '').strip())
                print(f"[{timestamp}] Parsed message: {message}")
            except json.JSONDecodeError as e:
                print(f"[{timestamp}] JSON parse error: {e} for message: {message}")
                return

        if not isinstance(message, dict):
            print(f"[{timestamp}] Error: Skipping non-dict message of type {type(message)}")
            return

        msg_type = message.get('type')
        query_type = message.get('query_type')

        print(f"[{timestamp}] Message Type: {msg_type}")
        print(f"[{timestamp}] Query Type: {query_type if query_type else 'N/A'}")

        if msg_type == 'query_request' and query_type == 'hourly_energy':
            response_channel = message.get('response_channel', 'RpiGate')
            day_offset = message.get('day_offset', 0)
            
            print(f"[{timestamp}] Processing hourly energy query:")
            print(f"├── Day Offset: {day_offset}")
            print(f"└── Response Channel: {response_channel}")
            
            # Calculate time range for the query
            today = datetime.now()
            local_offset = timedelta(hours=self.timezone_offset)
            
            # Start from local midnight (00:00) of the requested day
            local_start = (today - timedelta(days=day_offset)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            local_end = local_start + timedelta(days=1)
            
            # Convert local times to UTC for query
            utc_start = (local_start - local_offset).strftime('%Y-%m-%dT%H:%M:%SZ')
            utc_end = (local_end - local_offset).strftime('%Y-%m-%dT%H:%M:%SZ')
            
            print(f"├── Query Start (UTC): {utc_start}")
            print(f"└── Query End (UTC): {utc_end}")
            
            success, result = self.influx_handler.get_hourly_energy_usage(utc_start, utc_end)
            
            if success:
                print(f"[{timestamp}] InfluxDB query for hourly energy successful.")
                hourly_data, total_import, total_export, total_net = (
                    self.build_hourly_net_energy(result, local_offset)
                )
                
                response = {
                    'Channel': response_channel,
                    'data_type': 'hourly_energy_update',  # Changed from 'hourly_energy_import'
                    'day_offset': day_offset,
                    'hourly_usage': hourly_data,
                    'total_import_kwh': round(total_import, 3),
                    'total_export_kwh': round(total_export, 3),
                    'total_net_kwh': round(total_net, 3),
                    'timestamp': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
                }

                print(f"[{timestamp}] Query results:")
                print(f"├── Day Offset: {day_offset}")
                print(f"├── Data Points: {len(hourly_data)}")
                if hourly_data:
                    print(f"├── Time Range: {hourly_data[0]['datetime']} to {hourly_data[-1]['datetime']}")
                    print(f"├── Total Import: {total_import:.2f} kWh")
                    print(f"├── Total Export: {total_export:.2f} kWh")
                    print(f"└── Total Net: {total_net:.2f} kWh")
                else:
                    print(f"└── No data points found")
            else:
                response = {
                    'Channel': response_channel,
                    'data_type': 'hourly_energy_import',
                    'status': 'error',
                    'error': result,
                    'timestamp': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
                }
                print(f"[{timestamp}] Query error:")
                print(f"└── {result}")
                print(f"[{timestamp}] InfluxDB query for hourly energy failed: {result}")
            
            self.pubnub_handler.publish_data(response, response_channel)

    def __init__(self):
        """Initialize Gateway"""
        # Initialize all handlers
        self.influx_handler = InfluxDBHandler(**INFLUX_CONFIG)
        self.homewizard_handler = HomeWizardHandler(HOMEWIZARD_CONFIG['device_ip'])
        self.xbee_handler = XBeeHandler(
            XBEE_CONFIG['serial_port'], 
            XBEE_CONFIG['baud_rate']
        )
        self.pubnub_handler = PubNubHandler(
            subscribe_key=PUBNUB_CONFIG['subscribe_key'],
            publish_key=PUBNUB_CONFIG['publish_key'],
            user_id=PUBNUB_CONFIG['user_id'],
            message_callback=self.handle_pubnub_message
        )
        
        # Store configuration values
        self.update_interval = GATEWAY_CONFIG['update_interval']
        self.timezone_offset = GATEWAY_CONFIG['timezone_offset']
        self.price_update_hour = GATEWAY_CONFIG['price_update_hour']
        self.energy_update_interval = GATEWAY_CONFIG['energy_update_interval']
        
        # Initialize tracking variables
        self.last_price_fetch = None
        self.last_energy_update = None
        
        print('Starting Up ZigBee Gateway!')
        print(f'Configuration: UTC+{self.timezone_offset}, Update interval: {self.update_interval}s')
        print(f'Energy update interval: {self.energy_update_interval}s')
        
        # Initial data fetches
        self.fetch_electricity_prices()
        self.publish_current_day_energy()  # Add initial energy data publish
        
    def publish_current_day_energy(self):
        """Fetch and publish current day's hourly energy data"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"\n[{timestamp}] Publishing current day energy data")
        
        # Calculate time range for today
        local_offset = timedelta(hours=self.timezone_offset)
        local_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        local_end = datetime.now()
        
        # Convert to UTC for query
        utc_start = (local_start - local_offset).strftime('%Y-%m-%dT%H:%M:%SZ')
        utc_end = (local_end - local_offset).strftime('%Y-%m-%dT%H:%M:%SZ')
        
        success, result = self.influx_handler.get_hourly_energy_usage(utc_start, utc_end)
        
        if success:
            hourly_data, total_import, total_export, total_net = (
                self.build_hourly_net_energy(result, local_offset)
            )
            
            response = {
                'Channel': 'Channel-Query',
                'data_type': 'hourly_energy_update',  # New data type for automatic updates
                'day_offset': 0,
                'hourly_usage': hourly_data,
                'total_import_kwh': round(total_import, 3),
                'total_export_kwh': round(total_export, 3),
                'total_net_kwh': round(total_net, 3),
                'timestamp': datetime.now().strftime('%Y-%m-%dT%H:%M:%SZ')
            }
            
            print(f"[{timestamp}] Publishing energy update:")
            print(f"├── Data Points: {len(hourly_data)}")
            print(f"├── Total Import: {total_import:.2f} kWh")
            print(f"├── Total Export: {total_export:.2f} kWh")
            print(f"└── Total Net: {total_net:.2f} kWh")
            
            self.pubnub_handler.publish_data(response, 'Channel-Query')
            self.last_energy_update = datetime.now()

    def fetch_electricity_prices(self):
        """Fetch and store electricity prices"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"\n[{timestamp}] Fetching electricity prices")
        prices = get_electricity_prices(price_region=DEFAULT_PRICE_REGION)
        if prices and self.influx_handler.store_electricity_prices(prices):
            self.last_price_fetch = datetime.now()
            print(f"[{timestamp}] Electricity prices stored successfully")
        else:
            print(f"[{timestamp}] Failed to fetch/store electricity prices, will retry at next scheduled time")

    def check_and_update_prices(self, current_time):
        """Check if prices need to be updated and fetch if necessary"""
        if (self.last_price_fetch is None or 
            current_time.date() > self.last_price_fetch.date()) and \
            current_time.hour == 1:
            self.fetch_electricity_prices()

    def process_and_store_sensor_data(self):
        """Process and store sensor data from XBee"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        sensor_data = self.xbee_handler.get_current_data()
        print(f"\n[{timestamp}] Processing sensor data update")
        self.pubnub_handler.publish_data({
            **sensor_data,
            'data_type': 'sensor_update',
            'timestamp': datetime.now().isoformat()
        })
        self.influx_handler.store_sensor_data(sensor_data)

    def process_and_store_energy_data(self):
        """Process and store energy data from HomeWizard"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        energy_data = self.homewizard_handler.process_data()
        if energy_data:
            print(f"\n[{timestamp}] Processing energy data:")
            print(f"├── Power Usage: {energy_data['power_usage']['current_usage_w']} W")
            print(f"├── Import: {energy_data['power_usage']['import_kwh']} kWh")
            print(f"└── Export: {energy_data['power_usage']['export_kwh']} kWh")
            self.influx_handler.store_energy_data(energy_data)

    def run(self):
        """Main gateway loop"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] Starting Gateway main loop")
        try:
            while True:
                current_time = datetime.now()
                
                # Check if we need to fetch new prices
                self.check_and_update_prices(current_time)
                
                # Check if we need to publish energy update
                if self.last_energy_update is None:
                    print(f"[{timestamp}] No previous energy update, publishing...")
                    self.publish_current_day_energy()
                elif (current_time - self.last_energy_update).total_seconds() >= self.energy_update_interval:
                    print(f"[{timestamp}] Energy update interval reached ({self.energy_update_interval}s), publishing...")
                    self.publish_current_day_energy()
                
                # Wait for update_interval seconds while collecting data
                for _ in range(self.update_interval):
                    time.sleep(1)
                
                # Process and store all data
                self.process_and_store_sensor_data()
                self.process_and_store_energy_data()
                
        except KeyboardInterrupt:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"\n[{timestamp}] Shutting down...")
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources"""
        self.xbee_handler.close()

def main():
    gateway = Gateway()
    gateway.run()

if __name__ == "__main__":
    main()