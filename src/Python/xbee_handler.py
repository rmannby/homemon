from datetime import datetime
from typing import Any, Dict

import serial
from xbee import ZigBee


class XBeeHandler:
    """Handler for XBee sensor network communications"""
    
    # XBee node addresses
    POOL_NODE = '\x14\xa6'
    POOL_NODE_LONG = b'\x00\x13\xa2\x00A\x05p;'
    GLASSROOM_NODE = '7\xc2'
    GLASSROOM_NODE_LONG = b'\x00\x13\xa2\x00A\x05n\xdf'
    LIVINGROOM_LONG = b'\x00\x13\xa2\x00AO8l'
    GARAGE_NODE = '%\xd0'
    GARAGE_NODE_LONG = b'\x00\x13\xa2\x00AO8\x1c'

    def __init__(self, serial_port: str, baud_rate: int):
        """Initialize XBee handler"""
        try:
            self.ser = serial.Serial(serial_port, baud_rate)
            self.xbee = ZigBee(self.ser, callback=self._message_received)
            
            # Temperature values
            self.pool_temp_out = -99.9
            self.pool_temp_in = -99.9
            self.pool_temp_south = -99.9
            self.glassroom_temp = -99.9
            self.glassroom_north = -99.9
            self.indoor_temp = -99.9
            self.garage_temp = -99.9
            self.mouse_trapped = "Trip"

            # Min/Max values
            self.pool_temp_out_max = -100
            self.pool_temp_in_max = -100
            self.pool_temp_south_max = -100
            self.glassroom_temp_max = -100
            self.glassroom_north_max = -100
            self.indoor_temp_max = -100
            self.garage_temp_max = -100

            self.pool_temp_out_min = 100
            self.pool_temp_in_min = 100
            self.pool_temp_south_min = 100
            self.glassroom_temp_min = 100
            self.glassroom_north_min = 100
            self.indoor_temp_min = 100
            self.garage_temp_min = 100

            # Node presence counters
            self.pool_node_cnt = 0
            self.glassroom_node_cnt = 0
            self.livingroom_node_cnt = 0
            self.garage_node_cnt = 0
            
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] XBee Handler initialized successfully!")
            print(f"├── Serial Port: {serial_port}")
            print(f"└── Baud Rate: {baud_rate}")
            
        except Exception as e:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] Error initializing XBee Handler:")
            print(f"└── Error: {str(e)}")
            raise

    def get_temperature(self, data: Dict, cal: float = 0.0, channel: str = "adc-0", format: str = "C") -> float:
        """Calculate temperature from ADC readings"""
        for item in data:
            adc = item.get(channel)
            if adc is not None:
                temperature = (((adc * 0.001216) - 0.5) * 100) - cal    
                if format == "F":
                    temperature = (temperature * 1.8) + 32
                return temperature
        return -99.9

    def get_battery(self, data: Dict, channel: str = "adc-2") -> float:
        """Get battery reading from ADC"""
        for item in data:
            adc = item.get(channel)
            if adc is not None:
                return adc
        return 0.0

    def get_mouse_trapped(self, data: Dict, channel: str = "dio-1") -> str:
        """Get mouse trap status from digital input"""
        for item in data:
            dio = item.get(channel)
            if dio is not None:
                return "Trip" if dio == False else "Set"
        return "Trip"

    def _message_received(self, data: Dict[str, Any]):
        """Process received XBee message"""
        try:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"\n[{timestamp}] XBee message received")
            
            # Update node counters
            self.pool_node_cnt += 1
            self.glassroom_node_cnt += 1
            self.livingroom_node_cnt += 1
            self.garage_node_cnt += 1
            
            address = data['source_addr_long']
            
            if address == self.POOL_NODE_LONG:
                self.pool_node_cnt = 0
                self._process_pool_data(data)
            elif address == self.GLASSROOM_NODE_LONG:
                self.glassroom_node_cnt = 0
                self._process_glassroom_data(data)
            elif address == self.LIVINGROOM_LONG:
                self.livingroom_node_cnt = 0
                self._process_livingroom_data(data)
            elif address == self.GARAGE_NODE_LONG:
                self.garage_node_cnt = 0
                self._process_garage_data(data)

            self._check_node_presence()
            
        except Exception as e:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] Error processing XBee message:")
            print(f"└── Error: {str(e)}")

    def _process_pool_data(self, data: Dict[str, Any]):
        """Process data from pool node"""
        if 'samples' not in data:
            return

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] Processing pool node data")

        self.pool_temp_out = self.get_temperature(data['samples'], 1.92, "adc-0")
        self.pool_temp_in = self.get_temperature(data['samples'], 1.8, "adc-1")
        self.pool_temp_south = self.get_temperature(data['samples'], 2.0, "adc-2")

        # Update min/max
        if self.pool_temp_out > self.pool_temp_out_max:
            self.pool_temp_out_max = self.pool_temp_out
        if self.pool_temp_out < self.pool_temp_out_min:
            self.pool_temp_out_min = self.pool_temp_out

        if self.pool_temp_in > self.pool_temp_in_max:
            self.pool_temp_in_max = self.pool_temp_in
        if self.pool_temp_in < self.pool_temp_in_min:
            self.pool_temp_in_min = self.pool_temp_in

        if self.pool_temp_south > self.pool_temp_south_max:
            self.pool_temp_south_max = self.pool_temp_south
        if self.pool_temp_south < self.pool_temp_south_min:
            self.pool_temp_south_min = self.pool_temp_south

        print(f"├── Pool output: {self.pool_temp_out:.2f}°C")
        print(f"├── Pool input: {self.pool_temp_in:.2f}°C")
        print(f"└── Pool south: {self.pool_temp_south:.2f}°C")

    def _process_glassroom_data(self, data: Dict[str, Any]):
        """Process data from glassroom node"""
        if 'samples' not in data:
            return

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] Processing glass room data")

        self.glassroom_temp = self.get_temperature(data['samples'], 2.0, "adc-0")
        self.glassroom_north = self.get_temperature(data['samples'], 2.0, "adc-1")

        # Update min/max
        if self.glassroom_temp > self.glassroom_temp_max:
            self.glassroom_temp_max = self.glassroom_temp
        if self.glassroom_temp < self.glassroom_temp_min:
            self.glassroom_temp_min = self.glassroom_temp

        if self.glassroom_north > self.glassroom_north_max:
            self.glassroom_north_max = self.glassroom_north
        if self.glassroom_north < self.glassroom_north_min:
            self.glassroom_north_min = self.glassroom_north

        print(f"├── Glass room temp: {self.glassroom_temp:.2f}°C")
        print(f"└── Glass room north: {self.glassroom_north:.2f}°C")

    def _process_livingroom_data(self, data: Dict[str, Any]):
        """Process data from livingroom node"""
        if 'samples' not in data:
            return

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] Processing living room data")

        self.indoor_temp = self.get_temperature(data['samples'], 2.0, "adc-0")

        # Update min/max
        if self.indoor_temp > self.indoor_temp_max:
            self.indoor_temp_max = self.indoor_temp
        if self.indoor_temp < self.indoor_temp_min:
            self.indoor_temp_min = self.indoor_temp
            
        print(f"└── Living room temp: {self.indoor_temp:.2f}°C")

    def _process_garage_data(self, data: Dict[str, Any]):
        """Process data from garage node"""
        if 'samples' not in data:
            return

        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] Processing garage data")

        self.garage_temp = self.get_temperature(data['samples'], 2.0, "adc-0")
        self.mouse_trapped = self.get_mouse_trapped(data['samples'], "dio-1")

        # Update min/max
        if self.garage_temp > self.garage_temp_max:
            self.garage_temp_max = self.garage_temp
        if self.garage_temp < self.garage_temp_min:
            self.garage_temp_min = self.garage_temp

        print(f"├── Garage temp: {self.garage_temp:.2f}°C")
        print(f"└── Mouse trap status: {self.mouse_trapped}")

    def _check_node_presence(self):
        """Update values for nodes that haven't reported recently"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        if self.pool_node_cnt > 20:
            print(f"[{timestamp}] Pool node timeout - resetting values")
            self.pool_node_cnt = 0
            self.pool_temp_out = -99.9
            self.pool_temp_in = -99.9
            
        if self.glassroom_node_cnt > 20:
            print(f"[{timestamp}] Glass room node timeout - resetting values")
            self.glassroom_node_cnt = 0
            self.glassroom_temp = -99.9
            self.glassroom_north = -99.9
            
        if self.livingroom_node_cnt > 20:
            print(f"[{timestamp}] Living room node timeout - resetting values")
            self.livingroom_node_cnt = 0
            self.indoor_temp = -99.9
            
        if self.garage_node_cnt > 20:
            print(f"[{timestamp}] Garage node timeout - resetting values")
            self.garage_node_cnt = 0
            self.garage_temp = -99.9
            self.mouse_trapped = "Trip"

    def get_current_data(self) -> Dict[str, Any]:
        """Get current sensor data formatted for PubNub"""
        return {
            'Channel': 'RpiGate',
            'indoor': '{:.1f}'.format(self.indoor_temp),
            'Outdoor north': '{:.1f}'.format(self.glassroom_north),
            'Outdoor south': '{:.1f}'.format(self.pool_temp_south),
            'Glassroom': '{:.1f}'.format(self.glassroom_temp),
            'Pool': '{:.1f}'.format(self.pool_temp_out),
            'Poolheat': '{:.1f}'.format(self.pool_temp_in),
            'Garage': '{:.1f}'.format(self.garage_temp),
            'Mouse trapped': self.mouse_trapped,
            'MinMax': {
                'indoor_max': '{:.1f}'.format(self.indoor_temp_max),
                'indoor_min': '{:.1f}'.format(self.indoor_temp_min),
                'glassroom_max': '{:.1f}'.format(self.glassroom_temp_max),
                'glassroom_min': '{:.1f}'.format(self.glassroom_temp_min),
                'outdoor_north_max': '{:.1f}'.format(self.glassroom_north_max),
                'outdoor_north_min': '{:.1f}'.format(self.glassroom_north_min),
                'outdoor_south_max': '{:.1f}'.format(self.pool_temp_south_max),
                'outdoor_south_min': '{:.1f}'.format(self.pool_temp_south_min),
                'pool_max': '{:.1f}'.format(self.pool_temp_out_max),
                'pool_min': '{:.1f}'.format(self.pool_temp_out_min),
                'pool_heat_max': '{:.1f}'.format(self.pool_temp_in_max),
                'pool_heat_min': '{:.1f}'.format(self.pool_temp_in_min),
                'garage_max': '{:.1f}'.format(self.garage_temp_max),
                'garage_min': '{:.1f}'.format(self.garage_temp_min)
            }
        }

    def clear_minmax(self):
        """Reset min/max values to current readings"""
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{timestamp}] Clearing min/max values")
        self.pool_temp_out_max = self.pool_temp_out          
        self.pool_temp_out_min = self.pool_temp_out
        self.pool_temp_in_max = self.pool_temp_in        
        self.pool_temp_in_min = self.pool_temp_in
        self.pool_temp_south_max = self.pool_temp_south
        self.pool_temp_south_min = self.pool_temp_south

        self.glassroom_temp_max = self.glassroom_temp
        self.glassroom_temp_min = self.glassroom_temp
        self.glassroom_north_max = self.glassroom_north
        self.glassroom_north_min = self.glassroom_north

        self.indoor_temp_max = self.indoor_temp
        self.indoor_temp_min = self.indoor_temp

        self.garage_temp_max = self.garage_temp
        self.garage_temp_min = self.garage_temp

    def close(self):
        """Close serial connection"""
        self.ser.close()