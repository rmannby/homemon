from wallbox import Wallbox, Statuses
import time
import datetime
from datetime import datetime as dt
import configparser
import os

def load_config():
    config = configparser.ConfigParser()
    config_path = 'config.ini'
    
    if not os.path.exists(config_path):
        raise FileNotFoundError(
            f"Configuration file not found. Please create {config_path} based on config.ini.example"
        )
    
    config.read(config_path)
    return config

# w = Wallbox("roger.mannby@icloud.com", "clear")

# # Authenticate with the credentials above
# w.authenticate()

# # Print a list of chargers in the account
# print(w.getChargersList())

def format_timestamp(timestamp):
    return dt.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

def main():
    # Load configuration
    config = load_config()
    
    # Initialize Wallbox with credentials from config
    w = Wallbox(
        config['Wallbox']['email'],
        config['Wallbox']['password']
    )
    
    # Authenticate
    w.authenticate()
    
    # Rest of your code...
    for chargerId in w.getChargersList():
        endDate = datetime.datetime.now()
        startDate = endDate - datetime.timedelta(days=60)
        sessionList = w.getSessionList(chargerId, startDate, endDate)
    
        print(f"\nCharging Sessions for Charger {chargerId}:")
        print("-" * 80)
        
        for session in sessionList['data']:
            attrs = session['attributes']
            print(f"Session ID: {session['id']}")
            print(f"Date: {format_timestamp(attrs['start'])} to {format_timestamp(attrs['end'])}")
            print(f"Energy Used: {attrs['energy']:.2f} {attrs['energy_unit']}")
            print(f"Duration: {attrs['time'] // 3600}h {(attrs['time'] % 3600) // 60}m")
            print(f"Cost: {attrs['cost']:.2f} {attrs['cost_unit']}")
            print(f"User: {attrs['user_name']}")
            print(f"Range Added: {attrs['range']} km")
            print("-" * 80)
        

if __name__ == "__main__":
    main()
