from pubnub.pnconfiguration import PNConfiguration
from pubnub.pubnub import PubNub
from pubnub.callbacks import SubscribeCallback
from typing import Dict, Any, Optional

class PubNubHandler:
    def __init__(self, subscribe_key: str, publish_key: str, user_id: str, message_callback=None):
        self.pnconfig = PNConfiguration()
        self.pnconfig.subscribe_key = subscribe_key
        self.pnconfig.publish_key = publish_key
        self.pnconfig.user_id = user_id
        self.message_callback = message_callback
        
        self.pubnub = PubNub(self.pnconfig)
        # Create callback instance with reference to self
        self.pubnub.add_listener(self.MySubscribeCallback(self))
        self.pubnub.subscribe().channels('RpiGate').execute()

    class MySubscribeCallback(SubscribeCallback):
        def __init__(self, handler):
            super().__init__()
            self.handler = handler

        def status(self, pubnub, status):
            pass

        def presence(self, pubnub, presence):
            pass

        def message(self, pubnub, message):
            print(f"Received message: {message.message}")  # Debug print
            if self.handler.message_callback:
                print("Calling message callback")  # Debug print
                self.handler.message_callback(message.message)
            elif message.message == 'Connected':
                print('hello client')
                print('Connected! Publish data')
            else:
                print(f"Unhandled message: {message.message}")  # Debug print

    def publish_data(self, data: Dict[str, Any], channel: str = 'RpiGate'):
        """Publish data to PubNub channel"""
        def publish_callback(result, status):
            if not status.is_error():
                print(f'Message published successfully to {channel}')
            else:
                print(f'Publish failed to {channel}: {status.error}')

        self.pubnub.publish().channel(channel).message(data).pn_async(publish_callback)