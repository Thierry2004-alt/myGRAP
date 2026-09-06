import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

export interface PassengerMarker {
  id: string | number;
  name: string;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  colorHex?: string;
}

interface LeafletMapProps {
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  pickupName?: string;
  destName?: string;
  passengers?: PassengerMarker[];
  onSelectLocation?: (lat: number, lng: number, name: string) => void;
}

export default function LeafletMap({
  pickupLat = 3.8400,
  pickupLng = 11.5000,
  destLat = 3.8750,
  destLng = 11.5180,
  pickupName = 'Current Location (Mvan)',
  destName = 'Bastos Ambassades',
  passengers = [],
  onSelectLocation,
}: LeafletMapProps) {
  const leafletAssets = Platform.OS === 'web'
    ? '<link rel="stylesheet" href="/leaflet/leaflet.css" /><script src="/leaflet/leaflet.js"></script>'
    : '<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" /><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>';

  // Leaflet OpenStreetMap HTML with OSRM Real Street Turn-by-Turn Road Polylines
  const leafletHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      ${leafletAssets}
      <style>
        body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; background: #0f172a; }
        .leaflet-tile { filter: brightness(0.85) contrast(1.1); }
        .custom-popup { color: #0288D1; font-weight: bold; font-family: sans-serif; font-size: 12px; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false }).setView([${pickupLat}, ${pickupLng}], 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '© OpenStreetMap'
        }).addTo(map);

        // Primary Pickup Marker (Green Pulse Circle with P1 Badge)
        var greenIcon = L.divIcon({
          className: 'custom-div-icon',
          html: "<div style='background-color:#00E676;width:24px;height:24px;border-radius:12px;display:flex;justify-content:center;align-items:center;border:2.5px solid #ffffff;box-shadow:0 0 12px #00E676;color:#0B1325;font-weight:900;font-size:11px;'>P1</div>",
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        // Destination Marker (Red Pin)
        var redIcon = L.divIcon({
          className: 'custom-div-icon',
          html: "<div style='background-color:#FF5252;width:20px;height:20px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 12px #FF5252;'></div>",
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        // Driver Car Marker (Yellow Yango Car)
        var carIcon = L.divIcon({
          className: 'custom-div-icon',
          html: "<div style='background-color:#FFD600;width:26px;height:26px;border-radius:13px;display:flex;justify-content:center;align-items:center;border:2px solid #000;box-shadow:0 3px 6px rgba(0,0,0,0.4);font-size:15px;'>🚖</div>",
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        var pMarker = L.marker([${pickupLat}, ${pickupLng}], {icon: greenIcon, draggable: true}).addTo(map)
          .bindPopup("<b class='custom-popup'>P1 Pickup: ${pickupName} (Drag to adjust)</b>").openPopup();

        // Render Distinct Color Icons for Additional Joined Passengers
        var passengerColors = ['#0288D1', '#AB47BC', '#FF9800', '#E91E63'];
        var passengersData = ${JSON.stringify(passengers || [])};

        if (passengersData && passengersData.length > 0) {
          passengersData.forEach(function(p, idx) {
            var color = p.colorHex || passengerColors[idx % passengerColors.length];
            var pNum = idx + 2;
            var pIcon = L.divIcon({
              className: 'custom-div-icon',
              html: "<div style='background-color:" + color + ";width:26px;height:26px;border-radius:13px;display:flex;justify-content:center;align-items:center;border:2.5px solid #ffffff;box-shadow:0 0 12px " + color + ";color:#FFFFFF;font-weight:900;font-family:sans-serif;font-size:11px;'>P" + pNum + "</div>",
              iconSize: [28, 28],
              iconAnchor: [14, 14]
            });
            L.marker([p.pickupLat, p.pickupLng], {icon: pIcon}).addTo(map)
              .bindPopup("<b style='color:" + color + ";font-family:sans-serif;'>Passenger P" + pNum + ": " + p.name + "</b><br/><span style='font-size:11px;color:#cbd5e1;'>" + p.pickupName + "</span>");
          });
        }

        pMarker.on('dragend', function(e) {
          var lat = e.target.getLatLng().lat.toFixed(6);
          var lng = e.target.getLatLng().lng.toFixed(6);
          var msgData = JSON.stringify({ type: 'PICKUP_MOVED', lat: lat, lng: lng });
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(msgData);
          } else {
            window.parent.postMessage(msgData, '*');
          }
        });

        var dMarker = L.marker([${destLat}, ${destLng}], {icon: redIcon}).addTo(map)
          .bindPopup("<b class='custom-popup'>Destination: ${destName}</b>");

        var routePolyline = L.polyline([], { color: '#0288D1', weight: 6, opacity: 0.95 }).addTo(map);
        var driverCarMarker = null;

        // FETCH REAL OSRM STREET ROUTE GEOMETRY
        var osrmUrl = "https://router.project-osrm.org/route/v1/driving/" + ${pickupLng} + "," + ${pickupLat} + ";" + ${destLng} + "," + ${destLat} + "?overview=full&geometries=geojson";

        fetch(osrmUrl)
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (data.routes && data.routes.length > 0) {
              var coords = data.routes[0].geometry.coordinates;
              var latLngs = coords.map(function(c) { return [c[1], c[0]]; });
              routePolyline.setLatLngs(latLngs);
              map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

              // Place Driver Car on the midpoint of real road polyline
              if (latLngs.length > 0) {
                var midIdx = Math.floor(latLngs.length / 2);
                driverCarMarker = L.marker(latLngs[midIdx], {icon: carIcon}).addTo(map);
              }
            } else {
              // Fallback to straight line if OSRM offline
              var fallbackLatLngs = [[${pickupLat}, ${pickupLng}], [${destLat}, ${destLng}]];
              routePolyline.setLatLngs(fallbackLatLngs);
              map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
            }
          })
          .catch(function(err) {
            var fallbackLatLngs = [[${pickupLat}, ${pickupLng}], [${destLat}, ${destLng}]];
            routePolyline.setLatLngs(fallbackLatLngs);
            map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
          });

        map.on('click', function(e) {
          var lat = e.latlng.lat.toFixed(6);
          var lng = e.latlng.lng.toFixed(6);
          dMarker.setLatLng(e.latlng);
          var msgData = JSON.stringify({ type: 'MAP_CLICK', lat: lat, lng: lng });
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(msgData);
          } else {
            window.parent.postMessage(msgData, '*');
          }
        });
      </script>
    </body>
    </html>
  `;

  React.useEffect(() => {
    if (Platform.OS === 'web' && onSelectLocation) {
      const handleWebMessage = (event: MessageEvent) => {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data && (data.type === 'MAP_CLICK' || data.type === 'PICKUP_MOVED')) {
            onSelectLocation(parseFloat(data.lat), parseFloat(data.lng), `Pin @ (${data.lat}, ${data.lng})`);
          }
        } catch (e) {
          // ignore non-json messages
        }
      };
      window.addEventListener('message', handleWebMessage);
      return () => window.removeEventListener('message', handleWebMessage);
    }
  }, [onSelectLocation]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {React.createElement('iframe', {
          srcDoc: leafletHTML,
          style: { width: '100%', height: '100%', border: 'none' },
          title: 'Leaflet OSRM Street Map',
        })}
      </View>
    );
  }

  const { WebView } = require('react-native-webview');
  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: leafletHTML }}
        style={{ flex: 1, backgroundColor: '#0F172A' }}
        onMessage={(event: any) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if ((data.type === 'MAP_CLICK' || data.type === 'PICKUP_MOVED') && onSelectLocation) {
              onSelectLocation(parseFloat(data.lat), parseFloat(data.lng), `Pin @ (${data.lat}, ${data.lng})`);
            }
          } catch (e) {
            console.log('WebView message error:', e);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
  },
});
