# influxdb_handler.py
from influxdb import InfluxDBClient
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

class InfluxDBHandler:
    # Time formats
    TIME_FORMAT = '%Y-%m-%dT%H:%M:%SZ'
    
    # Valid time intervals for grouping
    VALID_TIME_INTERVALS = ['1m', '5m', '10m', '15m', '30m', '1h', '6h', '12h', '1d', '7d', '30d']
    
    def __init__(self, host: str = 'localhost', port: int = 8086, database: str = 'energy_monitoring'):
        """Initialize InfluxDB connection and handler"""
        self.client = InfluxDBClient(
            host=host,
            port=port,
            database=database
        )
        self.database = database
        
        # Define allowed measurements and their fields
        self.allowed_measurements = {
            'energy_usage': ['power_usage_w', 'import_kwh', 'export_kwh', 
                           'l1_power', 'l1_voltage', 'l1_current',
                           'l2_power', 'l2_voltage', 'l2_current',
                           'l3_power', 'l3_voltage', 'l3_current'],
            'temperature_sensors': ['indoor_temp', 'outdoor_north_temp', 
                                  'outdoor_south_temp', 'glassroom_temp',
                                  'pool_temp', 'pool_heat_temp', 'garage_temp',
                                  'mouse_trap_status'],
            'electricity_price': ['price']
        }
        
        # Define allowed functions and operators
        self.allowed_functions = ['mean', 'sum', 'count', 'min', 'max', 'last', 'difference']
        self.allowed_operators = ['DIFFERENCE', 'LAST']

    def validate_query_params(self, params: Dict[str, Any]) -> Tuple[bool, str]:
        """Validate query parameters for security and correctness"""
        # Check required fields
        required_fields = ['measurement', 'fields', 'time_range']
        if not all(field in params for field in required_fields):
            return False, "Missing required fields"

        # Validate measurement
        if params['measurement'] not in self.allowed_measurements:
            return False, f"Invalid measurement. Allowed: {list(self.allowed_measurements.keys())}"

        # Validate group_by if present
        if 'group_by' in params and params['group_by'] not in self.VALID_TIME_INTERVALS:
            return False, f"Invalid group_by interval. Allowed: {self.VALID_TIME_INTERVALS}"

        # Validate fields
        allowed_fields = self.allowed_measurements[params['measurement']]
        for field in params['fields']:
            # Handle complex field expressions (e.g., "DIFFERENCE(LAST(field_name))")
            if any(op in field.upper() for op in self.allowed_operators):
                try:
                    field_name = field.split('(')[-1].split(')')[0].strip('"')
                    if field_name not in allowed_fields:
                        return False, f"Invalid field in expression: {field_name}"
                except:
                    return False, f"Invalid field expression: {field}"
            # Handle simple function expressions (e.g., "mean(field_name)")
            elif '(' in field:
                try:
                    func = field.split('(')[0].strip().lower()
                    field_name = field.split('(')[1].split(')')[0].strip()
                    if func not in self.allowed_functions:
                        return False, f"Invalid function. Allowed: {self.allowed_functions}"
                    if field_name not in allowed_fields:
                        return False, f"Invalid field in function: {field_name}"
                except:
                    return False, f"Invalid function format: {field}"
            # Handle simple fields
            elif field not in allowed_fields:
                return False, f"Invalid field. Allowed for {params['measurement']}: {allowed_fields}"

        # Validate time range format
        try:
            start_time = params['time_range'].get('start')
            end_time = params['time_range'].get('end')
            if not (start_time and end_time):
                return False, "Missing start or end time"
            # Optionally validate time string format
            datetime.strptime(start_time.split('.')[0], self.TIME_FORMAT)
            datetime.strptime(end_time.split('.')[0], self.TIME_FORMAT)
        except ValueError as e:
            return False, f"Invalid time format. Expected {self.TIME_FORMAT}: {str(e)}"
        except Exception:
            return False, "Invalid time range format"

        return True, ""

    def build_query(self, params: Dict[str, Any]) -> str:
        """Build InfluxDB query from parameters"""
        # Build SELECT clause
        select_clause = "SELECT " + ", ".join(params['fields'])
        from_clause = f"FROM {params['measurement']}"
        
        # Build WHERE clause
        where_conditions = [
            f"time >= '{params['time_range']['start']}'",
            f"time <= '{params['time_range']['end']}'"
        ]
        
        # Add any additional filters
        if 'filters' in params:
            for field, value in params['filters'].items():
                if field in self.allowed_measurements[params['measurement']]:
                    where_conditions.append(f"{field} = '{value}'")
        
        where_clause = "WHERE " + " AND ".join(where_conditions)
        
        # Add group by if specified
        group_clause = ""
        if 'group_by' in params:
            group_clause = f"GROUP BY time({params['group_by']})"
        
        # Combine all clauses
        return f"{select_clause} {from_clause} {where_clause} {group_clause}"

    def execute_query(self, query_params: Dict[str, Any]) -> Tuple[bool, Any]:
        """Execute a validated query and return results"""
        try:
            # Validate parameters
            is_valid, error_message = self.validate_query_params(query_params)
            if not is_valid:
                return False, error_message

            # Build and execute query
            query = self.build_query(query_params)
            result = self.client.query(query)

            # Format response
            response_data = list(result.get_points())
            return True, response_data

        except Exception as e:
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
            # Convert string values to float and check for -99.9
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