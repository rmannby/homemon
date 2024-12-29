import serial, time, datetime, sys
from pubnub import Pubnub
from xbee import ZigBee

pubnub = Pubnub(publish_key='pub-c-6a121d53-b962-4a48-b425-10281417b24d', subscribe_key='sub-c-9e12300c-4af3-11e7-bf50-02ee2ddab7fe')
channel = 'RpiGate'

pool_node = '\x14\xa6'
pool_node_long = '\x00\x13\xa2\x00A\x05p;'
glassroom_node = '7\xc2'
glassroom_node_long = '\x00\x13\xa2\x00A\x05n\xdf'
livingroom_long = '\x00\x13\xa2\x00AO8l'
garage_node = '%\xd0'
garage_node_long = '\x00\x13\xa2\x00AO8\x1c'

#router_node = '\xfb\x8b'

pool = {}
glassroom = {}
router = {}
livingroom = {}
garage = {}
pub_msg = {}

pool_temp_out = 0
pool_temp_in = 0
pool_temp_south = 0
glassroom_temp = 0
glassroom_north = 0
indoor_temp = 0
garage_temp = 0
mouse_trapped = "Trip"

#MinMax
pool_temp_out_max = -100
pool_temp_in_max = -100
pool_temp_south_max = -100
glassroom_temp_max = -100
glassroom_north_max = -100
indoor_temp_max = -100
garage_temp_max = -100

pool_temp_out_min = 100
pool_temp_in_min = 100
pool_temp_south_min = 100
glassroom_temp_min = 100
glassroom_north_min = 100
indoor_temp_min = 100
garage_temp_min = 100


pool_node_cnt = 0
glassroom_node_cnt = 0
livingroom_node_cnt = 0
garage_node_cnt = 0

SERIALPORT = "/dev/ttyAMA0"    # the com/serial port the XBee is connected to, the pi GPIO should always be ttyAMA0
BAUDRATE = 9600      # the baud rate we talk to the xbee

ser = serial.Serial(SERIALPORT, BAUDRATE)

#xbee = ZigBee(ser)

#temp1 = (adc-x * 0.001216 - 0.5) * 100;
#get the current temp from a list of voltage readings
def get_tempature(data, cal = 0.0, channel="adc-0", format="C"):
    #iterate over data elements
    #readings = []
    for item in data:
        #readings.append(item.get('adc-0'))
        adc = item.get(channel)

    #start by averaging the data
    #adc = sum(readings)/float(len(readings))
    
    #now calculate the proper mv
    #we are using a 3.3v usb explorer so the formula is slightly different
    tempature = (((adc * 0.001216) - 0.5) * 100) - cal    

    if format=="F":
        #convert to farenheit
        tempature = (tempature * 1.8) + 32

    return tempature


#get the current battery voltage readings
def get_battery(data, channel="adc-2"):
    #iterate over data elements
    for item in data:
        adc = item.get(channel)

    #now calculate the proper mv
    #bat = ((xbeeMsg.b1_hi * 256 + xbeeMsg.b1_lo) * 0.0476 - 5.5935) / 10;    
    battery = adc    

    return battery

#get mouse trapped or not
def get_mouse_trapped(data, channel="dio-1"):
    #iterate over data elements
    for item in data:
        dio = item.get(channel)
        
    if dio == False:
        trapped = "Trip"
    else:
        trapped = "Set"
        
            

    return trapped

def pub_back(m):
  print(m)

def publish(msg):
    pubnub.publish(channel, msg, callback=pub_back, error=pub_back)

def message_received(data):
    #print(data)
    global pub_msg
    global pool_temp_out
    global pool_temp_in
    global pool_temp_south
    global glassroom_temp
    global glassroom_north
    global indoor_temp
    global garage_temp
    global mouse_trapped

    global pool_temp_out_max
    global pool_temp_in_max
    global pool_temp_south_max
    global glassroom_temp_max
    global glassroom_north_max
    global indoor_temp_max
    global garage_temp_max

    global pool_temp_out_min
    global pool_temp_in_min
    global pool_temp_south_min
    global glassroom_temp_min
    global glassroom_north_min
    global indoor_temp_min
    global garage_temp_min

    global pool_node_cnt
    global glassroom_node_cnt
    global livingroom_node_cnt
    global garage_node_cnt

    #Node presence counter
    pool_node_cnt += 1
    glassroom_node_cnt += 1
    livingroom_node_cnt += 1
    garage_node_cnt += 1
    
    address = data['source_addr_long']
    if address == pool_node_long:
        pool_node_cnt = 0
        pool = data
        pool_temp_out = get_tempature(pool['samples'], 1.92, "adc-0", format="C")
        pool_temp_in = get_tempature(pool['samples'], 1.8, "adc-1", format="C")
        pool_temp_south = get_tempature(pool['samples'], 2.0, "adc-2", format="C")

        #MinMax
        if pool_temp_out > pool_temp_out_max:
            pool_temp_out_max = pool_temp_out
            
        if pool_temp_out < pool_temp_out_min:
            pool_temp_out_min = pool_temp_out

        if pool_temp_in > pool_temp_in_max:
            pool_temp_in_max = pool_temp_in
            
        if pool_temp_in < pool_temp_in_min:
            pool_temp_in_min = pool_temp_in

        if pool_temp_south > pool_temp_south_max:
            pool_temp_south_max = pool_temp_south

        if pool_temp_south < pool_temp_south_min:
            pool_temp_south_min = pool_temp_south

        print('Pool output: {:.2f}'.format(pool_temp_out))
        print('Pool input: {:.2f}'.format(pool_temp_in))
        print('Pool south: {:.2f}'.format(pool_temp_south))

##        print('Pool output max: {:.2f}'.format(pool_temp_out_max))
##        print('Pool input max: {:.2f}'.format(pool_temp_in_max))
##        print('Pool south max: {:.2f}'.format(pool_temp_south_max))
##        
##        print('Pool output min: {:.2f}'.format(pool_temp_out_min))
##        print('Pool input min: {:.2f}'.format(pool_temp_in_min))
##        print('Pool south min: {:.2f}'.format(pool_temp_south_min))

    if address == glassroom_node_long:
        glassroom_node_cnt = 0
        glassroom = data
        glassroom_temp = get_tempature(glassroom['samples'], 2.0, "adc-0", format="C")
        glassroom_north = get_tempature(glassroom['samples'], 2.0, "adc-1", format="C")

        if glassroom_temp > glassroom_temp_max:
            glassroom_temp_max = glassroom_temp

        if glassroom_temp < glassroom_temp_min:
            glassroom_temp_min = glassroom_temp

        if glassroom_north > glassroom_north_max:
            glassroom_north_max = glassroom_north

        if glassroom_north < glassroom_north_min:
            glassroom_north_min = glassroom_north

        print('Glass room temp: {:.2f}'.format(glassroom_temp))
        print('Glass room north: {:.2f}'.format(glassroom_north))

##        print('Glass room temp max: {:.2f}'.format(glassroom_temp_max))
##        print('Glass room north max: {:.2f}'.format(glassroom_north_max))
##
##        print('Glass room temp min: {:.2f}'.format(glassroom_temp_min))
##        print('Glass room north min: {:.2f}'.format(glassroom_north_min))

    if address == livingroom_long:
        livingroom_node_cnt = 0
        livingroom = data
        indoor_temp = get_tempature(livingroom['samples'], 2.0, "adc-0", format="C")

        if indoor_temp > indoor_temp_max:
            indoor_temp_max = indoor_temp
        
        if indoor_temp < indoor_temp_min:
            indoor_temp_min = indoor_temp
        
        print('livingroom temp: {:.2f}'.format(indoor_temp))

##        print('livingroom temp max: {:.2f}'.format(indoor_temp_max))
##        print('livingroom temp min: {:.2f}'.format(indoor_temp_min))

    if address == garage_node_long:
        garage_node_cnt = 0
        garage = data
        garage_temp = get_tempature(garage['samples'], 2.0, "adc-0", format="C")
        mouse_trapped = get_mouse_trapped(garage['samples'], "dio-1")

        if garage_temp > garage_temp_max:
            garage_temp_max = garage_temp
            
        if garage_temp < garage_temp_min:
            garage_temp_min = garage_temp
            
        print('Garage temp: {:.2f}'.format(garage_temp))

##        print('Garage temp max: {:.2f}'.format(garage_temp_max))
##        print('Garage temp min: {:.2f}'.format(garage_temp_max))

        s = 'The trap is: ' + mouse_trapped
        print(s)

    #Presence handling
    if pool_node_cnt > 20:
        pool_node_cnt = 0
        pool_temp_out = -99.9
        pool_temp_in = -99.9
        pool_temp_south = -99.9
        
    if glassroom_node_cnt > 20:
        glassroom_node_cnt = 0
        glassroom_temp = -99.9
        glassroom_north = -99.9
       
    if livingroom_node_cnt > 20:
        livingroom_node_cnt = 0
        indoor_temp = -99.9

    if garage_node_cnt > 20:
        garage_node_cnt = 0
        garage_temp = -99.9
        mouse_trapped = "Trip"

        
    #Publish to PubNub
    pub_msg = {
        'Channel': 'RpiGate',
        'indoor': '{:.1f}'.format(indoor_temp),
        'Outdoor north': '{:.1f}'.format(glassroom_north),
        'Outdoor south': '{:.1f}'.format(pool_temp_south),
        'Glassroom': '{:.1f}'.format(glassroom_temp),
        'Pool': '{:.1f}'.format(pool_temp_out),
        'Poolheat': '{:.1f}'.format(pool_temp_in),
        'Garage': '{:.1f}'.format(garage_temp),
        'Mouse trapped': mouse_trapped,
        'MinMax': {
            'indoor_max': '{:.1f}'.format(indoor_temp_max),
            'indoor_min': '{:.1f}'.format(indoor_temp_min),
            'glassroom_max': '{:.1f}'.format(glassroom_temp_max),
            'glassroom_min': '{:.1f}'.format(glassroom_temp_min),
            'outdoor_north_max': '{:.1f}'.format(glassroom_north_max),
            'outdoor_north_min': '{:.1f}'.format(glassroom_north_min),
            'outdoor_south_max': '{:.1f}'.format(pool_temp_south_max),
            'outdoor_south_min': '{:.1f}'.format(pool_temp_south_min),
            'pool_max': '{:.1f}'.format(pool_temp_out_max),
            'pool_min': '{:.1f}'.format(pool_temp_out_min),
            'pool_heat_max': '{:.1f}'.format(pool_temp_in_max),
            'pool_heat_min': '{:.1f}'.format(pool_temp_in_min),
            'garage_max': '{:.1f}'.format(garage_temp_max),
            'garage_min': '{:.1f}'.format(garage_temp_min)
            }
    }
    
    #pubnub.publish(channel, pub_msg, callback=pub_back, error=pub_back)
    #publish(pub_msg)

def clear_minmax():
    print('minmax clear')
    pool_temp_out_max = pool_temp_out          
    pool_temp_out_min = pool_temp_out
    pool_temp_in_max = pool_temp_in        
    pool_temp_in_min = pool_temp_in
    pool_temp_south_max = pool_temp_south
    pool_temp_south_min = pool_temp_south

    glassroom_temp_max = glassroom_temp
    glassroom_temp_min = glassroom_temp
    glassroom_north_max = glassroom_north
    glassroom_north_min = glassroom_north

    indoor_temp_max = indoor_temp
    indoor_temp_min = indoor_temp

    garage_temp_max = garage_temp
    garage_temp_min = garage_temp



# Create API object, which spawns a new thread
xbee = ZigBee(ser, callback=message_received)

def sub_error(msg):
  print('Subscribe error')  
  print(msg)

def sub_msg(msg, channel):
  #print('Subscribe callback')
  if msg == 'connected':
      print('Publish data!')
      publish(pub_msg)
    #   clear_minmax()
      #print(pub_msg)
  
# Subrscribe to PubNub channel
pubnub.subscribe(channel, callback=sub_msg, error=sub_error)

print ('Starting Up ZigBee Gateway!')


# Continuously read and print packets
while True:
    try:

        time.sleep(60)
        print('Publish data!')
        publish(pub_msg)
            
    
    except KeyboardInterrupt:
        break

ser.close()
