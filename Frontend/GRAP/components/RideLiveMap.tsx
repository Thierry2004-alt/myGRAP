import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import type { RidePosition } from '../hooks/useRideLocationTracking';

interface RideLiveMapProps {
  rideState: string;
  pickupLat: number;
  pickupLng: number;
  destinationLat: number;
  destinationLng: number;
  driverPosition: RidePosition | null;
  passengerPosition: RidePosition | null;
  driverHome?: boolean;
}

export default function RideLiveMap({
  rideState,
  pickupLat,
  pickupLng,
  destinationLat,
  destinationLng,
  driverPosition,
  passengerPosition,
  driverHome = false,
}: RideLiveMapProps) {
  const webViewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const routeTarget = ['IN_PROGRESS', 'ARRIVED_AT_DESTINATION'].includes(rideState)
    ? 'destination'
    : 'pickup';
  const initialCenter = useRef(driverPosition || { lat: pickupLat, lng: pickupLng }).current;
  const mapHTML = useMemo(
    () => `
      <!doctype html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
        <style>html,body,#map{height:100%;margin:0;background:#0f172a}.leaflet-control-attribution{font-size:9px}</style>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var pickup = [${pickupLat}, ${pickupLng}];
          var destination = [${destinationLat}, ${destinationLng}];
          var target = '${routeTarget}' === 'destination' ? destination : pickup;
          var map = L.map('map', { zoomControl: true }).setView(
            ${driverHome ? `[${initialCenter.lat}, ${initialCenter.lng}]` : 'pickup'},
            ${driverHome ? '16' : '14'}
          );
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          var pickupIcon = L.divIcon({
            className: '',
            html: '<div style="background:#00c853;color:#07130c;border:2px solid white;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;font-weight:bold">P</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });
          var destinationIcon = L.divIcon({
            className: '',
            html: '<div style="background:#ff5252;border:2px solid white;border-radius:50%;width:22px;height:22px"></div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });
          var driverIcon = L.divIcon({
            className: '',
            html: '<div style="background:#ffd600;border:2px solid #111;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;font-size:16px">🚕</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });
          var passengerIcon = L.divIcon({
            className: '',
            html: '<div style="background:#0288d1;color:white;border:2px solid white;border-radius:50%;width:24px;height:24px;display:grid;place-items:center;font-weight:bold">P</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          });

          if (!${driverHome ? 'true' : 'false'}) {
            L.marker(pickup, { icon: pickupIcon }).addTo(map).bindPopup('Pickup location');
            L.marker(destination, { icon: destinationIcon }).addTo(map).bindPopup('Destination');
          }
          var driverMarker = null;
          var passengerMarker = null;
          var routeLine = L.polyline([], { color: '#1677ff', weight: 6, opacity: 0.9 }).addTo(map);
          var lastDriverPosition = null;
          var firstRoute = true;

          window.setRideLocations = function(driver, passenger) {
            var hadDriver = !!lastDriverPosition;
            if (driver && isFinite(driver.lat) && isFinite(driver.lng)) {
              lastDriverPosition = [driver.lat, driver.lng];
              if (driverMarker) driverMarker.setLatLng(lastDriverPosition);
              else driverMarker = L.marker(lastDriverPosition, { icon: driverIcon }).addTo(map).bindPopup('Driver');
              if (!hadDriver && ${driverHome ? 'true' : 'false'}) {
                map.setView(lastDriverPosition, map.getZoom(), { animate: false });
              }
              if (!hadDriver) window.refreshRideRoute();
            } else if (driverMarker) {
              map.removeLayer(driverMarker);
              driverMarker = null;
              lastDriverPosition = null;
            }
            if (passenger && isFinite(passenger.lat) && isFinite(passenger.lng)) {
              var point = [passenger.lat, passenger.lng];
              if (passengerMarker) passengerMarker.setLatLng(point);
              else passengerMarker = L.marker(point, { icon: passengerIcon }).addTo(map).bindPopup('Passenger near pickup');
            } else if (passengerMarker) {
              map.removeLayer(passengerMarker);
              passengerMarker = null;
            }
          };

          window.refreshRideRoute = function() {
            if (${driverHome ? 'true' : 'false'}) {
              routeLine.setLatLngs([]);
              return;
            }
            if (['DRIVER_AT_PICKUP', 'ARRIVED_AT_DESTINATION'].includes('${rideState}')) {
              routeLine.setLatLngs([]);
              return;
            }
            var start = lastDriverPosition || pickup;
            var url = 'https://router.project-osrm.org/route/v1/driving/' +
              start[1] + ',' + start[0] + ';' + target[1] + ',' + target[0] +
              '?overview=full&geometries=geojson';
            fetch(url).then(function(response) {
              if (!response.ok) throw new Error('Route request failed');
              return response.json();
            }).then(function(data) {
              if (!data.routes || !data.routes.length) throw new Error('No route found');
              var points = data.routes[0].geometry.coordinates.map(function(point) {
                return [point[1], point[0]];
              });
              routeLine.setLatLngs(points);
              if (firstRoute) {
                map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
                firstRoute = false;
              }
            }).catch(function(error) {
              console.warn('Unable to render the road route:', error);
            });
          };

          window.addEventListener('message', function(event) {
            if (event.data && event.data.type === 'ride_locations') {
              window.setRideLocations(event.data.driverPosition, event.data.passengerPosition);
            }
          });

          window.refreshRideRoute();
          setInterval(window.refreshRideRoute, 30000);
        </script>
      </body>
      </html>
    `,
    [destinationLat, destinationLng, driverHome, initialCenter.lat, initialCenter.lng, pickupLat, pickupLng, rideState, routeTarget]
  );

  useEffect(() => {
    const driver = driverPosition ? JSON.stringify(driverPosition) : 'null';
    const passenger = passengerPosition ? JSON.stringify(passengerPosition) : 'null';
    if (Platform.OS === 'web') {
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'ride_locations', driverPosition, passengerPosition },
        '*',
      );
      return;
    }
    webViewRef.current?.injectJavaScript(`if (window.setRideLocations) window.setRideLocations(${driver}, ${passenger}); true;`);
  }, [driverPosition, passengerPosition]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {React.createElement('iframe', {
          ref: iframeRef,
          srcDoc: mapHTML,
          onLoad: () => iframeRef.current?.contentWindow?.postMessage(
            { type: 'ride_locations', driverPosition, passengerPosition },
            '*',
          ),
          style: { width: '100%', height: '100%', border: 'none' },
          title: 'Live ride map',
        })}
      </View>
    );
  }

  const { WebView } = require('react-native-webview');
  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: mapHTML }}
        style={styles.webView}
        onLoadEnd={() => {
          const driver = driverPosition ? JSON.stringify(driverPosition) : 'null';
          const passenger = passengerPosition ? JSON.stringify(passengerPosition) : 'null';
          webViewRef.current?.injectJavaScript(
            `if (window.setRideLocations) window.setRideLocations(${driver}, ${passenger}); true;`
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#0f172a',
  },
  webView: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
});
