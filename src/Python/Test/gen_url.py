from flask import Flask, jsonify, request
from datetime import datetime
import requests

app = Flask(__name__)

@app.route('/fetch_data', methods=['GET'])
def fetch_data():
    # Hämta dagens datum
    base_url = "https://www.elprisetjustnu.se/api/v1/prices"
    year = datetime.now().strftime("%Y")
    month = datetime.now().strftime("%m")
    day = datetime.now().strftime("%d")
    price_class = request.args.get('price_class', 'SE3')  # Default SE3

    # Skapa den dynamiska URL:en
    dynamic_url = f"{base_url}/{year}/{month}-{day}_{price_class}.json"

    # Hämta data från den dynamiska URL:en
    try:
        response = requests.get(dynamic_url)
        response.raise_for_status()  # Kontrollera om begäran lyckades
        data = response.json()  # Hämta JSON-data
        return jsonify(data)  # Returnera JSON till Grafana
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
