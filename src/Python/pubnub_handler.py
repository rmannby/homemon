# pubnub_handler.py
from datetime import datetime
from typing import Any, Dict, Optional

from pubnub.callbacks import SubscribeCallback
from pubnub.pnconfiguration import PNConfiguration
from pubnub.pubnub import PubNub


class PubNubHandler:
    def __init__(self, subscribe_key: str, publish_key: str, user_id: str, message_callback=None):
        try:
            self.pnconfig = PNConfiguration()
            self.pnconfig.subscribe_key = subscribe_key
            self.pnconfig.publish_key = publish_key
            self.pnconfig.user_id = user_id
            self.message_callback = message_callback
            
            self.pubnub = PubNub(self.pnconfig)
            self.pubnub.add_listener(self.MySubscribeCallback(self))
            self.pubnub.subscribe().channels('RpiGate').execute()
        except Exception as e:
            print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Error initializing PubNub:")
            print(f"└── Error: {str(e)}")
            raise

    class MySubscribeCallback(SubscribeCallback):
        def __init__(self, handler):
            super().__init__()
            self.handler = handler

        def status(self, pubnub, status):
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] PubNub Status Event: {status.category}")
            if status.is_error():
                print(f"[{timestamp}] PubNub Error: {status.error_data.information}")

        def presence(self, pubnub, presence):
            pass

        def message(self, pubnub, message):
            try:
                # Just forward the message to the callback without logging here
                if self.handler.message_callback:
                    self.handler.message_callback(message.message)
                elif message.message == 'Connected':
                    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                    print(f"[{timestamp}] New client connected - sending current data")
                    
            except Exception as e:
                timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                print(f"[{timestamp}] Error in PubNub message handler:")
                print(f"└── Error: {str(e)}")

    def publish_data(self, data: Dict[str, Any], channel: str = 'RpiGate'):
        """Publish data to PubNub channel"""
        def publish_callback(result, status):
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            if not status.is_error():
                print(f"\n[{timestamp}] PubNub Energy Update Published Successfully:")
                print(f"├── Channel: Channel-Query")
                print(f"└── Timetoken: {result.timetoken}")
            else:
                print(f"\n[{timestamp}] PubNub Publish Error:")
                print(f"├── Channel: Channel-Query")
                print(f"└── Error: {status.error}")

        try:
            self.pubnub.publish().channel(channel).message(data).pn_async(publish_callback)
        except Exception as e:
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{timestamp}] Error publishing to PubNub:")
            print(f"├── Channel: {channel}")
            print(f"└── Error: {str(e)}")