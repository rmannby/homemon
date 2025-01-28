const showMinMax_outNorth = document.querySelector('#outNorthRoom')
const showMinMax_outSouth = document.querySelector('#outSouthRoom')
const showMinMax_glassroom = document.querySelector('#glassroom')
const showMinMax_livingroom = document.querySelector('#livingroom')
const showMinMax_pool = document.querySelector('#pool')
const showMinMax_poolHeat = document.querySelector('#poolHeat')
const showMinMax_garage = document.querySelector('#garage')

let minMax = {} //Save min/max object
let pubnubInstance; // Declare variable to hold PubNub instance

document.addEventListener('DOMContentLoaded', function () {
    console.log('Document ready');
    
    // Initialize PubNub
    pubnubInstance = PUBNUB.init({
        subscribe_key: 'sub-c-9e12300c-4af3-11e7-bf50-02ee2ddab7fe',
        publish_key: 'pub-c-6a121d53-b962-4a48-b425-10281417b24d',
        uuid: 'mannbyUUID',
        ssl: true
    });
    
    // Subscribe to RpiGate channel
    pubnubInstance.subscribe({
        channel: 'RpiGate',  // Changed from channels array to single channel
        message: function(message, env, channel) {  // Old version callback format
            if (message && message.data_type === 'hourly_energy_import') {
                const usageData = message.hourly_usage.map(hour => hour.usage_kwh);
                const event = new CustomEvent('energyDataReceived', { 
                    detail: usageData 
                });
                window.dispatchEvent(event);
            } else {
                updateDOM(message);
            }
        },
        connect: function() {  // Changed to function instead of arrow function
            console.log('PubNub RpiGate channel connected');
            pubnubInstance.publish({
                channel: 'RpiGate',
                message: 'Connected'
            });
        }
    });

    // Subscribe to Query channel separately
    pubnubInstance.subscribe({
        channel: 'Channel-Query',
        message: function(message, env, channel) {
            if (message && message.data_type === 'hourly_energy_import') {
                const usageData = message.hourly_usage.map(hour => hour.usage_kwh);
                const event = new CustomEvent('energyDataReceived', { 
                    detail: usageData 
                });
                window.dispatchEvent(event);
            }
        }
    });
});

// Make queryHourlyEnergy wait for pubnubInstance to be available
function queryHourlyEnergy(dayOffset) {
    if (!pubnubInstance) {
        console.error('PubNub not yet initialized');
        return;
    }
    pubnubInstance.publish({
        channel: "RpiGate",
        message: {
            type: "query_request",
            query_type: "hourly_energy",
            day_offset: dayOffset,
            response_channel: "Channel-Query"
        }
    });
}

function updateDOM(res) {
    if (res.MinMax) {
        minMax = res.MinMax
    }

    if (res.Glassroom === "-99.9") {
        glassRoomTemp.innerHTML = ("--.-°C");
    } else if (res.Glassroom) {
        glassRoomTemp.innerHTML = (res.Glassroom + "°C");
    }

    if (res.indoor === "-99.9") {
        livingRoomTemp.innerHTML = ("--.-°C");
    } else if (res.indoor) {
        livingRoomTemp.innerHTML = (res.indoor + "°C");
    }

    if (res["Outdoor north"] === "-99.9") {
        outsideNorthTemp.innerHTML = ("--.-°C");
    } else if (res["Outdoor north"]) {
        outsideNorthTemp.innerHTML = res["Outdoor north"] + "°C";
    }

    if (res["Outdoor south"] === "-99.9") {
        outsideSouthTemp.innerHTML = ("--.-°C");
    } else if (res["Outdoor south"]) {
        outsideSouthTemp.innerHTML = res["Outdoor south"] + "°C";
    }

    if (res["Garage"] === "-99.9") {
        garageTemp.innerHTML = ("--.-°C");
    } else if (res["Garage"]) {
        garageTemp.innerHTML = (res["Garage"] + "°C");
    }

    if (res["Pool"] === "-99.9") {
        poolTemp.innerHTML = ("--.-°C");
    } else if (res["Pool"]) {
        poolTemp.innerHTML = (res["Pool"] + "°C");
    }

    var mouse = document.getElementById("icon-mouse-trap");
    if (res["Mouse trapped"] === "Trip") {
        mouse.style.display = "inline";
    } else {
        mouse.style.display = "none";
    }
    
    getTime();
}

function getTime() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    if (m < 10) {
        m = '0' + m;
    }
    var updateTime = d.toLocaleTimeString();
    var headerTime = h + ':' + m;

    mainHeader.innerHTML = `Home Monitor ${headerTime}`;
}

// Event listeners
showMinMax_outNorth.addEventListener('click', () => {
    alert(`UTE NORR \nMax: ${minMax.outdoor_north_max}°C \nMin: ${minMax.outdoor_north_min}°C`)
})

showMinMax_outSouth.addEventListener('click', () => {
    alert(`UTE SÖDER \nMax: ${minMax.outdoor_south_max}°C \nMin: ${minMax.outdoor_south_min}°C`)
})

showMinMax_glassroom.addEventListener('click', () => {
    alert(`UTERUM \nMax: ${minMax.glassroom_max}°C \nMin: ${minMax.glassroom_min}°C`)
})

showMinMax_livingroom.addEventListener('click', () => {
    alert(`VARDAGSRUM \nMax: ${minMax.indoor_max}°C \nMin: ${minMax.indoor_min}°C`)
})

showMinMax_pool.addEventListener('click', () => {
    alert(`POOL \nMax: ${minMax.pool_max}°C \nMin: ${minMax.pool_min}°C`)
})

showMinMax_garage.addEventListener('click', () => {
    alert(`GARAGE \nMax: ${minMax.garage_max}°C \nMin: ${minMax.garage_min}°C`)
})