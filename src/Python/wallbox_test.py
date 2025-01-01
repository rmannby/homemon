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

def format_timestamp(timestamp):
    return dt.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

def set_max_current(wallbox, charger_id, max_amps):
    """
    Set the maximum charging current for a specific charger
    
    Args:
        wallbox: Wallbox instance
        charger_id: ID of the charger to modify
        max_amps: Maximum current in Amperes (typically between 6 and 32)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Get current status to verify the change
        initial_status = wallbox.getChargerStatus(charger_id)
        
        # Set the max charging current
        wallbox.setMaxChargingCurrent(charger_id, max_amps)
        
        # Wait a moment for the change to take effect
        time.sleep(2)
        
        # Verify the change
        new_status = wallbox.getChargerStatus(charger_id)
        
        # Print confirmation
        print(f"Changed max current for charger {charger_id}")
        print(f"Previous max current: {initial_status['config_data']['max_charging_current']}A")
        print(f"New max current: {new_status['config_data']['max_charging_current']}A")
        
        return True
    except Exception as e:
        print(f"Error setting max current: {str(e)}")
        return False

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
        # Example: Set max current to 10A
        set_max_current(w, chargerId, 10)
        
         # Get and print session information
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
