import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

export interface PassengerMarker {
  id: string | number;
  name: string;
  pickupName: string;
  pickupLat: number;
  pickupLng: number;
  colorHex?: string;
  pickup_order?: number;
}

interface GoogleDriverMapProps {
  rideState?: string;
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  driverLat?: number;
  driverLng?: number;
  vehicleType?: 'MOTO' | 'CAR';
  pickupName?: string;
  destName?: string;
  distanceKm?: number;
  passengers?: PassengerMarker[];
}

function sortPassengersByPickupOrder(passengers: PassengerMarker[], primaryLat = 3.8400, primaryLng = 11.5000): PassengerMarker[] {
  return [...passengers].sort((a, b) => {
    const ao = a.pickup_order || 0;
    const bo = b.pickup_order || 0;
    if (ao !== bo) return ao - bo;
    const da = Math.hypot(a.pickupLat - primaryLat, a.pickupLng - primaryLng);
    const db = Math.hypot(b.pickupLat - primaryLat, b.pickupLng - primaryLng);
    return da - db;
  });
}

export default function GoogleDriverMap({
  rideState = 'ACCEPTED',
  pickupLat = 3.8400,
  pickupLng = 11.5000,
  destLat = 3.8750,
  destLng = 11.5180,
  driverLat = 3.8450,
  driverLng = 11.5050,
  vehicleType = 'CAR',
  pickupName = 'Pickup Location',
  destName = 'Destination',
  distanceKm,
  passengers = [],
}: GoogleDriverMapProps) {
  const isRequested = rideState === 'REQUESTED' || rideState === 'MATCHING';
  const isEnRouteToPickup = rideState === 'ACCEPTED' || rideState === 'DRIVER_ARRIVING' || rideState === 'ARRIVING';
  const isAtPickup = rideState === 'DRIVER_AT_PICKUP';
  const isInProgress = rideState === 'IN_PROGRESS';
  const isCompleted = rideState === 'COMPLETED';

  const sortedPassengers = useMemo(
    () => sortPassengersByPickupOrder(passengers, pickupLat, pickupLng),
    [passengers, pickupLat, pickupLng]
  );

  const vehicleEmoji = vehicleType === 'MOTO' ? '🏍️' : '🚕';

  const phaseTitle = isRequested
    ? '🔍 Finding nearby verified drivers...'
    : isEnRouteToPickup
    ? `🚕 Driver en route to pickup (${pickupName})`
    : isAtPickup
    ? '📍 Driver arrived at pickup location'
    : isInProgress
    ? `🚀 Trip in progress to ${destName}`
    : isCompleted
    ? '🏁 Trip completed'
    : '🚕 Active Trip';

  const calcDist = Math.hypot(destLat - pickupLat, destLng - pickupLng) * 111.32;
  const exactDist = distanceKm || (calcDist > 0.1 ? Number(calcDist.toFixed(1)) : 4.5);

  const passengersJson = useMemo(() => JSON.stringify(sortedPassengers || []), [sortedPassengers]);

  // Construct waypoints for OSRM
  const osrmWaypoints = useMemo(() => {
    const points: { lat: number; lng: number }[] = [];
    if (isEnRouteToPickup && driverLat && driverLng) {
      points.push({ lat: driverLat, lng: driverLng });
      points.push({ lat: pickupLat, lng: pickupLng });
    } else {
      points.push({ lat: pickupLat, lng: pickupLng });
      if (sortedPassengers.length > 0) {
        for (const p of sortedPassengers) {
          points.push({ lat: Number(p.pickupLat), lng: Number(p.pickupLng) });
        }
      }
      points.push({ lat: destLat, lng: destLng });
    }
    return points.map((pt) => `${pt.lng},${pt.lat}`).join(';');
  }, [isEnRouteToPickup, driverLat, driverLng, pickupLat, pickupLng, destLat, destLng, sortedPassengers]);

  const mapHTML = useMemo(() => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #gmap { margin: 0; padding: 0; height: 100%; width: 100%; background: #0f172a; }
        .eta-pill {
          position: absolute;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          background: rgba(15, 23, 42, 0.94);
          color: ${isRequested ? '#29B6F6' : isInProgress ? '#FF9800' : '#00E676'};
          border: 1.5px solid ${isRequested ? '#29B6F6' : isInProgress ? '#FF9800' : '#00E676'};
          padding: 6px 16px;
          border-radius: 20px;
          font-weight: 800;
          font-family: sans-serif;
          font-size: 12px;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
          white-space: nowrap;
        }
        .custom-popup { font-family: sans-serif; font-size: 12px; }
      </style>
    </head>
    <body>
      <div id="eta-pill" class="eta-pill">${phaseTitle} • ${exactDist} km</div>
      <div id="gmap"></div>
      <script>
        try {
          var map = L.map('gmap', { zoomControl: false }).setView([${pickupLat}, ${pickupLng}], 14);

          L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            maxZoom: 20,
            attribution: '© Google Maps'
          }).addTo(map);

          // Green Pickup Marker
          var greenIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div style='background-color:#00E676;width:24px;height:24px;border-radius:12px;display:flex;justify-content:center;align-items:center;border:2.5px solid #ffffff;box-shadow:0 0 12px #00E676;color:#0B1325;font-weight:900;font-size:11px;'>P1</div>",
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });
          L.marker([${pickupLat}, ${pickupLng}], {icon: greenIcon}).addTo(map)
            .bindPopup("<b class='custom-popup' style='color:#00E676;'>Pickup: ${pickupName}</b>");

          // Red Destination Marker
          var redIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div style='background-color:#FF5252;width:22px;height:22px;border-radius:11px;display:flex;justify-content:center;align-items:center;border:2.5px solid #ffffff;box-shadow:0 0 12px #FF5252;'><div style='width:6px;height:6px;background:#fff;border-radius:3px;'></div></div>",
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          L.marker([${destLat}, ${destLng}], {icon: redIcon}).addTo(map)
            .bindPopup("<b class='custom-popup' style='color:#FF5252;'>Destination: ${destName}</b>");

          // Driver Marker (if driver assigned)
          var showDriver = ${!isRequested ? 'true' : 'false'};
          if (showDriver) {
            var driverIcon = L.divIcon({
              className: 'custom-div-icon',
              html: "<div style='background-color:${vehicleType === 'MOTO' ? '#00E676' : '#FFD600'};width:34px;height:34px;border-radius:17px;display:flex;justify-content:center;align-items:center;border:2px solid #000;box-shadow:0 4px 10px rgba(0,0,0,0.5);font-size:18px;'>${vehicleEmoji}</div>",
              iconSize: [36, 36],
              iconAnchor: [18, 18]
            });
            var driverMarker = L.marker([${driverLat}, ${driverLng}], {icon: driverIcon}).addTo(map);
            driverMarker.bindPopup("<b class='custom-popup'>Driver Current Location</b>");
          }

          // Additional Shared Passengers
          var passengerColors = ['#0288D1', '#AB47BC', '#FF9800', '#E91E63'];
          var passengersData = ${passengersJson};
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
                .bindPopup("<b class='custom-popup' style='color:" + color + ";'>Passenger P" + pNum + ": " + p.name + "</b><br/><span style='font-size:11px;color:#cbd5e1;'>" + p.pickupName + "</span>");
            });
          }

          // Fetch Real Street Route Geometry via OSRM
          var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + '${osrmWaypoints}' + '?overview=full&geometries=geojson';
          var routeLine = L.polyline([], { color: '#0288D1', weight: 6, opacity: 0.92 }).addTo(map);

          fetch(osrmUrl)
            .then(function(res) { return res.json(); })
            .then(function(data) {
              if (data.routes && data.routes.length > 0) {
                var coords = data.routes[0].geometry.coordinates;
                var latLngs = coords.map(function(c) { return [c[1], c[0]]; });
                routeLine.setLatLngs(latLngs);
                map.fitBounds(routeLine.getBounds(), { padding: [45, 45] });
              } else {
                var fallback = [[${pickupLat}, ${pickupLng}], [${destLat}, ${destLng}]];
                routeLine.setLatLngs(fallback);
                map.fitBounds(routeLine.getBounds(), { padding: [45, 45] });
              }
            })
            .catch(function(e) {
              var fallback = [[${pickupLat}, ${pickupLng}], [${destLat}, ${destLng}]];
              routeLine.setLatLngs(fallback);
              map.fitBounds(routeLine.getBounds(), { padding: [45, 45] });
            });
        } catch (e) {
          console.error(e);
        }
      </script>
    </body>
    </html>
    `;
  }, [
    phaseTitle,
    exactDist,
    pickupLat,
    pickupLng,
    destLat,
    destLng,
    driverLat,
    driverLng,
    pickupName,
    destName,
    vehicleType,
    vehicleEmoji,
    isRequested,
    isInProgress,
    passengersJson,
    osrmWaypoints,
  ]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {React.createElement('iframe', {
          srcDoc: mapHTML,
          style: { width: '100%', height: '100%', border: 'none' },
          title: 'Live Trip Navigation Map',
        })}
      </View>
    );
  }

  const { WebView } = require('react-native-webview');
  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: mapHTML }}
        style={{ flex: 1, backgroundColor: '#0F172A' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: '#0F172A',
  },
});
