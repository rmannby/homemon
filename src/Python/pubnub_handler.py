from pubnub.pnconfiguration import PNConfiguration
from pubnub.pubnub import PubNub
from pubnub.callbacks import SubscribeCallback
from typing import Dict, Any, Optional

class PubNubHandler:
    def __init__(self, subscribe_key: str, publish_key: str, user_id: str):
        self.pnconfig = PNConfiguration()
        self.pnconfig.subscribe_key = subscribe_key
        self.pnconfig.publish_key = publish_key
        self.pnconfig.user_id = user_id
        
        self.pubnub = PubNub(self.pnconfig)
        self.pubnub.add_listener(self.MySubscribeCallback())
        self.pubnub.subscribe().channels('RpiGate').execute()

    class MySubscribeCallback(SubscribeCallback):
        def status(self, pubnub, status):
            pass

        def presence(self, pubnub, presence):
            pass

        def message(self, pubnub, message):
            if message.message == 'Connected':
                print('hello client')
                print('Connected! Publish data')
                # You might want to handle this differently or pass a callback
            else:
                print(message.message)

    def publish_data(self, data: Dict[str, Any], channel: str = 'RpiGate'):
        """Publish data to PubNub channel"""
        def publish_callback(result, status):
            if not status.is_error():
                print('Message published successfully')
            else:
                print('Publish failed')

        self.pubnub.publish().channel(channel).message(data).pn_async(publish_callback)