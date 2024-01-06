# homemon
PWA home monitor app with PubNub/Rasperry pi gateway

Purpose and Functionality:

The app likely allows users to monitor the temperature and possibly other environmental data from different rooms or locations around the home, such as the living room, pool, garage, and outdoor areas.
It includes weather forecasting features, displaying predictions for upcoming days with corresponding weather icons and temperature highs and lows.
Technology Stack:

The front-end is built with HTML, CSS, and JavaScript, with snippets indicating the use of jQuery and a weather-related jQuery plugin (jquery.simpleWeather).
The back-end or server-side might involve a Raspberry Pi acting as a gateway to collect sensor data and communicate with the PubNub network for real-time updates.
Design and Layout:

The app has a responsive design, with CSS indicating the use of a grid layout for displaying room information and media queries for adapting to different screen sizes.
The weather forecast is presented in a horizontal layout with separate sections for each day.
The app's color scheme includes gradients and a dark background, with a focus on readability and a modern aesthetic.
PWA Features:

The manifest.json file indicates that the app is designed to be installed on the home screen of a device, with a full range of icons for different resolutions and a standalone display mode.
The app is designed to be mobile-friendly, with meta tags for iOS and Windows devices to enhance the mobile web experience.
Development and Deployment:

The package.json file suggests that the app uses http-server as a simple, zero-configuration command-line HTTP server for development and testing.
The project is version-controlled with Git, and its repository is hosted on GitHub.
Authorship and Licensing:

The app is authored by Roger Mannby, as indicated in the package.json file.
It is licensed under the ISC license, a permissive free software license published by the Internet Systems Consortium.