const expo = require('./app.json').expo;
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();

if (googleMapsApiKey) {
  expo.plugins = [
    ...(expo.plugins || []).filter(
      (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) !== 'react-native-maps'
    ),
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
        iosGoogleMapsApiKey: googleMapsApiKey,
      },
    ],
  ];
  expo.android = {
    ...expo.android,
    config: {
      ...expo.android?.config,
      googleMaps: {
        ...expo.android?.config?.googleMaps,
        apiKey: googleMapsApiKey,
      },
    },
  };
  expo.ios = {
    ...expo.ios,
    config: {
      ...expo.ios?.config,
      googleMapsApiKey,
    },
  };
}

module.exports = { expo };
