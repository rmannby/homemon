from datetime import datetime
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

    def handle_pubnub_message(self, message):
        """Handle incoming PubNub messages"""
        print(f"Gateway handling message: {message}")  # Debug print
        try:
            if isinstance(message, dict):
                # Skip processing our own published responses
                if message.get('data_type') == 'hourly_energy_import':
                    print("Skipping processing of our own response")
                    return
                # Handle query requests
                if message.get('type') == 'query_request':
                    query_type = message.get('query_type')
                    
                    if query_type == 'hourly_energy':
                        # Get the requested day offset and response channel
                        day_offset = message.get('day_offset', 0)
                        response_channel = message.get('response_channel', PUBNUB_CHANNEL)
                        
                        print(f"Processing hourly_energy request: offset={day_offset}, channel={response_channel}")  # Debug print
                        
                        # Validate day_offset
                        try:
                            day_offset = int(day_offset)
                            if day_offset < 0:
                                raise ValueError("day_offset must be non-negative")
                        except (TypeError, ValueError) as e:
                            print(f"Invalid day_offset: {e}")
                            return
                            
                        self.publish_hourly_energy_import(day_offset, response_channel)
                    else:
                        print(f"Unsupported query type: {query_type}")
                        
            elif message == 'Connected':
                print('hello client')
                print('Connected! Publishing current data...')
                current_data = self.xbee_handler.get_current_data()
                self.pubnub_handler.publish_data(current_data)
            else:
                print(f"Unhandled message type: {type(message)}")
                
        except Exception as e:
            print(f"Error handling PubNub message: {e}")
            import traceback
            traceback.print_exc()  # Print full stack trace

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
            
    def publish_hourly_energy_import(self, day_offset: int = 0, response_channel: str = PUBNUB_CHANNEL):
        """Publish hourly energy import data to PubNub"""
        try:
            hourly_data = self.influx_handler.get_hourly_energy_import(day_offset)
            if hourly_data:
                summary_data = {
                    'Channel': response_channel,
                    'data_type': 'hourly_energy_import',
                    'day_offset': day_offset,
                    'hourly_usage': hourly_data,
                    'timestamp': datetime.now().isoformat()
                }
                self.pubnub_handler.publish_data(summary_data, response_channel)
                print(f"Published hourly energy import data (day offset: {day_offset})")
            else:
                print(f"No hourly energy data available for day offset: {day_offset}")
                
        except Exception as e:
            print(f"Error publishing hourly energy import: {e}")

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