# influxdb_handler.py
from datetime import datetime
from typing import Any, Dict, List, Tuple

from influxdb import InfluxDBClient


class InfluxDBHandler:
    def __init__(self, host: str = 'localhost', port: int = 8086, database: str = 'energy_monitoring'):
        """Initialize InfluxDB connection and handler"""
        self.client = InfluxDBClient(
            host=host,
            port=port,
            database=database
        )
        self.database = database

    def get_hourly_energy_usage(self, start_time: str, end_time: str) -> Tuple[bool, Any]:
        """Get hourly energy usage for specified time range"""
        try:
            query = f"""
                SELECT
                    SPREAD("import_kwh") AS hourly_import_kwh,
                    SPREAD("export_kwh") AS hourly_export_kwh
                FROM energy_usage
                WHERE time >= '{start_time}' AND time <= '{end_time}'
                GROUP BY time(1h)
            """
            result = self.client.query(query)
            return True, list(result.get_points())
        except Exception as e:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] Error executing InfluxDB query: {e}")
            return False, f"Query execution failed: {str(e)}"

    def store_energy_data(self, data: Dict[str, Any]) -> bool:
        """Store HomeWizard energy data in InfluxDB"""
        try:
            json_body = [{
                "measurement": "energy_usage",
                "tags": {
                    "source": "homewizard"
                },
                "fields": {
                    "power_usage_w": float(data['power_usage']['current_usage_w']),
                    "import_kwh": float(data['power_usage']['import_kwh']),
                    "export_kwh": float(data['power_usage']['export_kwh']),
                    "l1_power": float(data['per_phase']['L1']['power_w']),
                    "l1_voltage": float(data['per_phase']['L1']['voltage_v']),
                    "l1_current": float(data['per_phase']['L1']['current_a']),
                    "l2_power": float(data['per_phase']['L2']['power_w']),
                    "l2_voltage": float(data['per_phase']['L2']['voltage_v']),
                    "l2_current": float(data['per_phase']['L2']['current_a']),
                    "l3_power": float(data['per_phase']['L3']['power_w']),
                    "l3_voltage": float(data['per_phase']['L3']['voltage_v']),
                    "l3_current": float(data['per_phase']['L3']['current_a'])
                }
            }]
            
            self.client.write_points(json_body)
            print("Energy data stored in InfluxDB successfully")
            return True
            
        except Exception as e:
            print(f"Error storing energy data in InfluxDB: {e}")
            return False

    def store_sensor_data(self, data: Dict[str, Any]) -> bool:
        """Store sensor data in InfluxDB, converting -99.9 values to None"""
        try:
            fields = {
                "indoor_temp": None if float(data['indoor']) == -99.9 else float(data['indoor']),
                "outdoor_north_temp": None if float(data['Outdoor north']) == -99.9 else float(data['Outdoor north']),
                "outdoor_south_temp": None if float(data['Outdoor south']) == -99.9 else float(data['Outdoor south']),
                "glassroom_temp": None if float(data['Glassroom']) == -99.9 else float(data['Glassroom']),
                "pool_temp": None if float(data['Pool']) == -99.9 else float(data['Pool']),
                "pool_heat_temp": None if float(data['Poolheat']) == -99.9 else float(data['Poolheat']),
                "garage_temp": None if float(data['Garage']) == -99.9 else float(data['Garage']),
                "mouse_trap_status": data['Mouse trapped']
            }

            # Remove None values from fields
            fields = {k: v for k, v in fields.items() if v is not None}

            json_body = [{
                "measurement": "temperature_sensors",
                "tags": {
                    "source": "zigbee_gateway"
                },
                "fields": fields
            }]
            
            self.client.write_points(json_body)
            print("Sensor data stored in InfluxDB successfully")
            return True
            
        except Exception as e:
            print(f"Error storing sensor data in InfluxDB: {e}")
            return False

    def store_electricity_prices(self, lines: List[str]) -> bool:
        """Store electricity prices in InfluxDB using line protocol"""
        try:
            success = self.client.write(lines, {'db': self.database}, protocol='line')
            return success
                
        except Exception as e:
            print(f"Error storing electricity prices: {e}")
            return False