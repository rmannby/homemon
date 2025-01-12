import os
from typing import Dict, Any

def get_influx_config() -> Dict[str, Any]:
    """Get InfluxDB configuration from environment variables or defaults"""
    return {
        'host': os.getenv('INFLUX_HOST', 'localhost'),
        'port': int(os.getenv('INFLUX_PORT', '8086')),
        'database': os.getenv('INFLUX_DATABASE', 'energy_monitoring')
    }

def get_homewizard_config() -> Dict[str, str]:
    """Get HomeWizard configuration from environment variables or defaults"""
    return {
        'device_ip': os.getenv('HOMEWIZARD_IP', '192.168.87.153')
    }

def get_pubnub_config() -> Dict[str, str]:
    """Get PubNub configuration from environment variables"""
    return {
        'subscribe_key': os.getenv('PUBNUB_SUB_KEY', 'sub-c-9e12300c-4af3-11e7-bf50-02ee2ddab7fe'),
        'publish_key': os.getenv('PUBNUB_PUB_KEY', 'pub-c-6a121d53-b962-4a48-b425-10281417b24d'),
        'user_id': os.getenv('PUBNUB_USER_ID', 'mby_user')
    }

def get_xbee_config() -> Dict[str, Any]:
    """Get XBee configuration from environment variables or defaults"""
    return {
        'serial_port': os.getenv('XBEE_SERIAL_PORT', '/dev/ttyS0'),
        'baud_rate': int(os.getenv('XBEE_BAUD_RATE', '9600'))
    }

# Export configurations
INFLUX_CONFIG = get_influx_config()
HOMEWIZARD_CONFIG = get_homewizard_config()
PUBNUB_CONFIG = get_pubnub_config()
XBEE_CONFIG = get_xbee_config()