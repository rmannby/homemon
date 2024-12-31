from flask import Flask, jsonify, request
from datetime import datetime

app = Flask(__name__)

@app.route('/generate_url', methods=['GET'])
def generate_url():
    # Hämta dagens datum
    base_url = "https://www.elprisetjustnu.se/api/v1/prices"
    year = datetime.now().strftime("%Y")
    month = datetime.now().strftime("%m")
    day = datetime.now().strftime("%d")
    price_class = request.args.get('price_class', 'SE3')  # Default SE3

    # Skapa den dynamiska URL:en
    url = f"{base_url}/{year}/{month}-{day}_{price_class}.json"
    return jsonify({"url": url})

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
