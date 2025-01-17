# xbeegw.py
from datetime import datetime, timedelta
from typing import Dict, Any, List
import time

from influxdb_handler import InfluxDBHandler
from homewizard_handler import HomeWizardHandler
from xbee_handler import XBeeHandler
from pubnub_handler import PubNubHandler
from electricityprices_handler import get_electricity_prices
from config import (INFLUX_CONFIG, HOMEWIZARD_CONFIG, 
                   PUBNUB_CONFIG, XBEE_CONFIG)

# Constants
PUBNUB_CHANNEL = 'RpiGate'
DEFAULT_PRICE_REGION = "SE3"

class Gateway:
    def __init__(self):
        # Initialize all handlers
        self.influx_handler = InfluxDBHandler(**INFLUX_CONFIG)
        self.homewizard_handler = HomeWizardHandler(HOMEWIZARD_CONFIG['device_ip'])
        self.xbee_handler = XBeeHandler(
            XBEE_CONFIG['serial_port'], 
            XBEE_CONFIG['baud_rate']
        )
        # Initialize PubNub with the message handler
        self.pubnub_handler = PubNubHandler(
            subscribe_key=PUBNUB_CONFIG['subscribe_key'],
            publish_key=PUBNUB_CONFIG['publish_key'],
            user_id=PUBNUB_CONFIG['user_id'],
            message_callback=self.handle_pubnub_message
        )
        
        self.last_price_fetch = None
        print('Starting Up ZigBee Gateway!')
        
        # Initial electricity price fetch
        self.fetch_electricity_prices()

    def _convert_legacy_hourly_query(self, day_offset: int) -> Dict[str, Any]:
        """Convert legacy hourly energy query to new format"""
        today = datetime.now()
        return {
            'measurement': 'energy_usage',
            'fields': ['DIFFERENCE(LAST("import_kwh")) as hourly_usage'],
            'time_range': {
                'start': (today - timedelta(days=day_offset)).strftime('%Y-%m-%dT00:00:00Z'),
                'end': (today - timedelta(days=day_offset-1)).strftime('%Y-%m-%dT00:00:00Z')
            },
            'group_by': '1h'
        }

    def _format_legacy_response(self, result: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Format query result to match legacy response structure"""
        hourly_data = []
        for point in result:
            if point.get('hourly_usage') is not None:
                timestamp = datetime.fromisoformat(point['time'].replace('Z', '+00:00'))
                hourly_data.append({
                    'hour': timestamp.hour,
                    'datetime': timestamp.isoformat(),
                    'usage_kwh': round(point['hourly_usage'], 3) if point['hourly_usage'] > 0 else 0
                })
        return hourly_data

    def handle_pubnub_message(self, message):
        """Handle incoming PubNub messages"""
        try:
            if not isinstance(message, dict):
                return

            if message.get('type') == 'query_request':
                response_channel = message.get('response_channel', 'RpiGate')
                query_type = message.get('query_type')
                
                if query_type == 'database_query':
                    query_params = message.get('query_params', {})
                    success, result = self.influx_handler.execute_query(query_params)
                    
                    response = {
                        'Channel': response_channel,
                        'data_type': 'query_response',
                        'status': 'success' if success else 'error',
                        'data' if success else 'error': result,
                        'query_params': query_params,
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    self.pubnub_handler.publish_data(response, response_channel)
                    
                elif query_type == 'hourly_energy':
                    # Handle legacy hourly energy query
                    day_offset = message.get('day_offset', 0)
                    query_params = self._convert_legacy_hourly_query(day_offset)
                    success, result = self.influx_handler.execute_query(query_params)
                    
                    if success:
                        hourly_data = self._format_legacy_response(result)
                        response = {
                            'Channel': response_channel,
                            'data_type': 'hourly_energy_import',
                            'day_offset': day_offset,
                            'hourly_usage': hourly_data,
                            'timestamp': datetime.now().isoformat()
                        }
                    else:
                        response = {
                            'Channel': response_channel,
                            'data_type': 'hourly_energy_import',
                            'status': 'error',
                            'error': result
                        }
                    
                    self.pubnub_handler.publish_data(response, response_channel)
                    
            elif message == 'Connected':
                print('Connected! Publishing current data...')
                current_data = self.xbee_handler.get_current_data()
                self.pubnub_handler.publish_data(current_data)
                
        except Exception as e:
            print(f"Error handling PubNub message: {e}")
            import traceback
            traceback.print_exc()

    def fetch_electricity_prices(self):
        """Fetch and store electricity prices"""
        print('Fetching electricity prices')
        prices = get_electricity_prices(price_region=DEFAULT_PRICE_REGION)
        if prices and self.influx_handler.store_electricity_prices(prices):
            self.last_price_fetch = datetime.now()
            print("Electricity prices stored successfully")
        else:
            print("Failed to fetch/store electricity prices, will retry at next scheduled time")

    def check_and_update_prices(self, current_time):
        """Check if prices need to be updated and fetch if necessary"""
        if (self.last_price_fetch is None or 
            current_time.date() > self.last_price_fetch.date()) and \
            current_time.hour == 1:
            self.fetch_electricity_prices()

    def process_and_store_sensor_data(self):
        """Process and store sensor data from XBee"""
        sensor_data = self.xbee_handler.get_current_data()
        print('Publishing sensor data!')
        self.pubnub_handler.publish_data(sensor_data)
        self.influx_handler.store_sensor_data(sensor_data)

    def process_and_store_energy_data(self):
        """Process and store energy data from HomeWizard"""
        energy_data = self.homewizard_handler.process_data()
        if energy_data:
            print("Power usage:", energy_data['power_usage']['current_usage_w'], "W")
            print("Import:", energy_data['power_usage']['import_kwh'], "kWh")
            print("Export:", energy_data['power_usage']['export_kwh'], "kWh")
            self.influx_handler.store_energy_data(energy_data)

    def run(self):
        """Main gateway loop"""
        try:
            while True:
                current_time = datetime.now()
                
                # Check if we need to fetch new prices
                self.check_and_update_prices(current_time)
                
                # Wait for 60 seconds while collecting data
                for _ in range(60):
                    time.sleep(1)
                
                # Process and store all data
                self.process_and_store_sensor_data()
                self.process_and_store_energy_data()
                                        
        except KeyboardInterrupt:
            print("\nShutting down...")
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