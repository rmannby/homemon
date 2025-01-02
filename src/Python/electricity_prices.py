from urllib import request
from datetime import datetime
import json

def get_electricity_prices(date=None, price_region="SE3"):
    """
    Hämtar eltimpriser för vald region och datum och konverterar till InfluxDB line protocol
    
    Args:
        date (datetime, optional): Datum att hämta priser för. Default är dagens datum.
        price_region (str, optional): Prisklass att hämta (SE1/SE2/SE3/SE4). Default är SE3.
    
    Returns:
        list: Lines in InfluxDB line protocol format
    """
    try:
        # Använd angivet datum eller dagens datum
        if date is None:
            date = datetime.now()
            
        # Validera prisregion
        valid_regions = ["SE1", "SE2", "SE3", "SE4"]
        if price_region not in valid_regions:
            raise ValueError(f"Ogiltig prisregion. Måste vara en av {valid_regions}")
        
        # Formatera URL:en med datum och region
        url = f"https://www.elprisetjustnu.se/api/v1/prices/{date.year}/{date.month:02d}-{date.day:02d}_{price_region}.json"
        
        # Gör API-anropet
        with request.urlopen(url) as response:
            data = json.loads(response.read())
        
        # Convert to InfluxDB line protocol
        influx_lines = []
        
        for price_data in data:
            # Parse timestamp from time_start
            timestamp = datetime.fromisoformat(price_data["time_start"])
            # Convert to Unix timestamp in nanoseconds
            timestamp_ns = int(timestamp.timestamp() * 1_000_000_000)
            
            # Apply Vattenfall's price formula
            spot_price = price_data["SEK_per_kWh"]
            final_price = (spot_price * 1.25) + (13.53/100)
            
            # Create line protocol entry for calculated price
            line = f'electricity_price,region={price_region} price={final_price} {timestamp_ns}'
            influx_lines.append(line)
        
        return influx_lines
        
    except ValueError as e:
        print(f"Valideringsfel: {e}")
        return None
    except Exception as e:
        print(f"Ett fel uppstod: {e}")
        return None

# Exempel på användning
if __name__ == "__main__":
    # Exempel 1: Använd standardvärden (dagens datum, SE3)
    print("Exempel 1: Standardvärden (dagens datum, SE3)")
    lines = get_electricity_prices()
    if lines:
        for line in lines:
            print(line)
    
    # # Exempel 2: Specifikt datum och region
    # print("\nExempel 2: Specifikt datum (2024-01-15) och region (SE4)")
    # specific_date = datetime(2024, 1, 15)
    # lines = get_electricity_prices(date=specific_date, price_region="SE4")
    # if lines:
    #     for line in lines:
    #         print(line)