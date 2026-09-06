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

interface GoogleDriverMapProps {
  rideState?: 'ACCEPTED' | 'ARRIVING' | 'IN_PROGRESS' | 'COMPLETED';
  pickupLat?: number;
  pickupLng?: number;
  destLat?: number;
  destLng?: number;
  driverLat?: number;
  driverLng?: number;
  isMoving?: boolean;
  vehicleType?: 'MOTO' | 'CAR';
  pickupName?: string;
  destName?: string;
  passengers?: PassengerMarker[];
  onArrivePickup?: () => void;
  onArriveDestination?: () => void;
}

export default function GoogleDriverMap({
  rideState = 'ACCEPTED',
  pickupLat = 3.8400,
  pickupLng = 11.5000,
  destLat = 3.8750,
  destLng = 11.5180,
  driverLat = 3.8450,
  driverLng = 11.5050,
  isMoving = true,
  vehicleType = 'CAR',
  pickupName = 'Pickup Location',
  destName = 'Destination',
  passengers = [],
  onArrivePickup,
  onArriveDestination,
}: GoogleDriverMapProps) {
  const isEnRouteToPickup = rideState === 'ACCEPTED' || rideState === 'ARRIVING';

  // 2-Phase Map Coordinates
  const startLat = isEnRouteToPickup ? driverLat : pickupLat;
  const startLng = isEnRouteToPickup ? driverLng : pickupLng;
  const endLat = isEnRouteToPickup ? pickupLat : destLat;
  const endLng = isEnRouteToPickup ? pickupLng : destLng;

  const vehicleEmoji = vehicleType === 'MOTO' ? '🏍️' : '🚕';

  const phaseTitle = !isMoving
    ? `Driver (${vehicleType === 'MOTO' ? 'Moto Taxi' : 'Taxi'}) • Awaiting Passenger Confirmation`
    : isEnRouteToPickup
    ? `Driver En Route to Pickup (${pickupName})`
    : `Trip in Progress to Destination (${destName})`;

  const initialMins = isEnRouteToPickup ? 2 : 6;
  const initialDist = isEnRouteToPickup ? 1.0 : 5.8;

  // Google Maps HTML with 100% Automated 2-Phase Continuous Movement & PostMessage Signal
  const googleMapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html, #gmap { margin: 0; padding: 0; height: 100%; width: 100%; background: #0f172a; }
        .car-anim { transition: all 0.5s linear; }
        .eta-pill { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 1000; background: rgba(15, 23, 42, 0.94); color: ${isMoving ? '#00E676' : '#FFD600'}; border: 1.5px solid ${isMoving ? '#00E676' : '#FFD600'}; padding: 6px 16px; border-radius: 20px; font-weight: 800; font-family: sans-serif; font-size: 12px; box-shadow: 0 4px 14px rgba(0,0,0,0.5); white-space: nowrap; }
      </style>
    </head>
    <body>
      <div id="eta-pill" class="eta-pill">⏱️ ${phaseTitle}</div>
      <div id="gmap"></div>
      <script>
        var map = L.map('gmap', { zoomControl: false }).setView([${startLat}, ${startLng}], 15);

        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
          attribution: '© Google Maps'
        }).addTo(map);

        var greenIcon = L.divIcon({
          className: 'custom-div-icon',
          html: "<div style='background-color:#00E676;width:24px;height:24px;border-radius:12px;display:flex;justify-content:center;align-items:center;border:2.5px solid #ffffff;box-shadow:0 0 12px #00E676;color:#0B1325;font-weight:900;font-size:11px;'>P1</div>",
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        var redIcon = L.divIcon({
          className: 'custom-div-icon',
          html: "<div style='background-color:#FF5252;width:20px;height:20px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 12px #FF5252;'></div>",
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        var driverIcon = L.divIcon({
          className: 'car-anim',
          html: "<div style='background-color:${vehicleType === 'MOTO' ? '#00E676' : '#FFD600'};width:34px;height:34px;border-radius:17px;display:flex;justify-content:center;align-items:center;border:2px solid #000;box-shadow:0 4px 10px rgba(0,0,0,0.5);font-size:18px;'>${vehicleEmoji}</div>",
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });

        var pMarker = L.marker([${pickupLat}, ${pickupLng}], {icon: greenIcon}).addTo(map)
          .bindPopup("<b style='color:#00E676;'>Primary Passenger (P1): ${pickupName}</b>");
        var dMarker = L.marker([${destLat}, ${destLng}], {icon: redIcon}).addTo(map);
        var driverMarker = L.marker([${startLat}, ${startLng}], {icon: driverIcon}).addTo(map);

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

        var osrmUrl = "https://router.project-osrm.org/route/v1/driving/" + ${startLng} + "," + ${startLat} + ";" + ${endLng} + "," + ${endLat} + "?overview=full&geometries=geojson";
        var routeLine = L.polyline([], { color: '#0288D1', weight: 6, opacity: 0.95 }).addTo(map);

        fetch(osrmUrl)
          .then(function(res) { return res.json(); })
          .then(function(data) {
            if (data.routes && data.routes.length > 0) {
              var coords = data.routes[0].geometry.coordinates;
              var latLngs = coords.map(function(c) { return [c[1], c[0]]; });
              routeLine.setLatLngs(latLngs);
              map.fitBounds(routeLine.getBounds(), { padding: [45, 45] });

              var shouldMove = ${isMoving ? 'true' : 'false'};
              if (shouldMove) {
                var totalSteps = latLngs.length;
                var step = 0;

                var animInterval = setInterval(function() {
                  if (step < totalSteps) {
                    driverMarker.setLatLng(latLngs[step]);
                    routeLine.setLatLngs(latLngs.slice(step));

                    var remainingRatio = (totalSteps - step) / totalSteps;
                    var remDist = (remainingRatio * ${initialDist}).toFixed(1);
                    var remMins = Math.max(1, Math.ceil(remainingRatio * ${initialMins}));

                    var etaPill = document.getElementById('eta-pill');
                    if (etaPill) {
                      etaPill.innerText = "⏱️ ${phaseTitle} • " + remMins + " mins (" + remDist + " km left)";
                    }

                    step++;
                  } else {
                    var etaPill = document.getElementById('eta-pill');
                    var isPickupStage = ${isEnRouteToPickup ? 'true' : 'false'};

                    if (etaPill) {
                      if (isPickupStage) {
                        etaPill.innerText = "🎯 Driver Arrived at Pickup Point!";
                      } else {
                        etaPill.innerText = "🎯 Arrived at Destination!";
                      }
                    }

                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(isPickupStage ? 'ARRIVED_PICKUP' : 'ARRIVED_DESTINATION');
                    }
                    clearInterval(animInterval);
                  }
                }, 400);
              }
            }
          })
          .catch(function(e) {
            map.setView([${startLat}, ${startLng}], 14);
          });
      </script>
    </body>
    </html>
  `;

  const handleMessage = (event: any) => {
    const data = event.nativeEvent.data;
    if (data === 'ARRIVED_PICKUP' && onArrivePickup) {
      onArrivePickup();
    } else if (data === 'ARRIVED_DESTINATION' && onArriveDestination) {
      onArriveDestination();
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        {React.createElement('iframe', {
          srcDoc: googleMapHTML,
          style: { width: '100%', height: '100%', border: 'none' },
          title: 'Google Driver Progression Map',
        })}
      </View>
    );
  }

  const { WebView } = require('react-native-webview');
  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={['*']}
        source={{ html: googleMapHTML }}
        onMessage={handleMessage}
        style={{ flex: 1, backgroundColor: '#0F172A' }}
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
