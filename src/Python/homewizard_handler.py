import json
import subprocess
from typing import Any, Dict, Optional


class HomeWizardHandler:
    def __init__(self, device_ip: str):
        """Initialize HomeWizard handler with device IP"""
        self.device_ip = device_ip

    def fetch_data(self) -> Optional[Dict[str, Any]]:
        """Fetch data from HomeWizard device"""
        try:
            result = subprocess.run(
                ["curl", f"http://{self.device_ip}/api/v1/data"],
                capture_output=True,
                text=True,
                timeout=10
            )

            if result.returncode != 0:
                print("Error executing curl:", result.stderr)
                return None

            return json.loads(result.stdout)

        except json.JSONDecodeError:
            print("Failed to parse JSON response.")
        except subprocess.TimeoutExpired:
            print("Request timed out.")
        except Exception as e:
            print("An unexpected error occurred:", e)

        return None

    def process_data(self) -> Optional[Dict[str, Any]]:
        """Fetch and process HomeWizard data"""
        data = self.fetch_data()
        if not data:
            print("Failed to fetch HomeWizard data")
            return None

        try:
            processed_data = {
                'power_usage': {
                    'current_usage_w': data['active_power_w'],
                    'import_kwh': data['total_power_import_kwh'],
                    'export_kwh': data['total_power_export_kwh']
                },
                'per_phase': {
                    'L1': {
                        'power_w': data['active_power_l1_w'],
                        'voltage_v': data['active_voltage_l1_v'],
                        'current_a': data['active_current_l1_a']
                    },
                    'L2': {
                        'power_w': data['active_power_l2_w'],
                        'voltage_v': data['active_voltage_l2_v'],
                        'current_a': data['active_current_l2_a']
                    },
                    'L3': {
                        'power_w': data['active_power_l3_w'],
                        'voltage_v': data['active_voltage_l3_v'],
                        'current_a': data['active_current_l3_a']
                    }
                },
                'wifi': {
                    'ssid': data['wifi_ssid'],
                    'strength': data['wifi_strength']
                }
            }
            print("Processed HomeWizard data successfully")
            return processed_data

        except KeyError as e:
            print(f"Missing expected field in HomeWizard data: {e}")
            return None
        