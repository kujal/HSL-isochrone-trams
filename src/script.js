document.addEventListener("DOMContentLoaded", function () {
    var map = L.map("map", {
        center: [60.1699, 24.9384],
        zoom: 12,
        minZoom: 5, 
        maxZoom: 15, 
        maxBounds: [[60.045, 24.7], [60.297, 25.2]],
        maxBoundsViscosity: 1.0
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    var greenDotIcon = L.icon({
        iconUrl: 'assets/green-dot.png',
        iconSize: [10, 10], 
        iconAnchor: [5, 5], 
        popupAnchor: [0, -5] 
    });

    var blueDotIcon = L.icon({
        iconUrl: 'assets/blue-dot.png',
        iconSize: [10, 10], 
        iconAnchor: [5, 5], 
        popupAnchor: [0, -5] 
    });

    var redDotIcon = L.icon({
        iconUrl: 'assets/red-dot.png',
        iconSize: [10, 10], 
        iconAnchor: [5, 5], 
        popupAnchor: [0, -5] 
    });

    const polylines = [];
    const markers = {};
    const polylineMap = {};
    let startStop = 'H0301'; // Default start stop, Rautatieasema

    fetch('data/tramstops.geojson')
        .then(response => response.json())
        .then(stopsData => {
            const stops = {};
            const connections = {};

            stopsData.features.forEach(feature => {
                const stopId = feature.properties.LYHYTTUNNU;
                const stopName = feature.properties.NIMI;
                const coordinates = feature.geometry.coordinates;
                const travelTime = feature.properties.TRAVELTIME;
                const line = feature.properties.REITTI;

                if (!stops[stopId]) {
                    stops[stopId] = {
                        id: stopId,
                        name: stopName,
                        coordinates: coordinates,
                        connections: [],
                        travelTimes: {},
                        line: line 
                    };
                }

                if (!connections[line]) {
                    connections[line] = [];
                }
                connections[line].push({ stopId, travelTime });
            });

            Object.values(connections).forEach(lineStops => {
                for (let i = 0; i < lineStops.length - 1; i++) {
                    const stop1 = lineStops[i].stopId;
                    const stop2 = lineStops[i + 1].stopId;
                    const travelTime = lineStops[i].travelTime;
                    stops[stop1].connections.push(stop2);
                    stops[stop1].travelTimes[stop2] = travelTime;
                    stops[stop2].connections.push(stop1);
                    stops[stop2].travelTimes[stop1] = travelTime;
                }
            });

            stopsData.features.forEach(feature => {
                const stopId = feature.properties.LYHYTTUNNU;
                const stopCoordinates = feature.geometry.coordinates;
                const stopName = feature.properties.NIMI;
                const lines = feature.properties.REITTI;

                const marker = L.marker([stopCoordinates[1], stopCoordinates[0]], { icon: greenDotIcon }).addTo(map)
                    .bindPopup(`<b>${stopName}</b><br>Tram Line: ${lines}`);
                
                marker.on('click', function () {
                    startStop = stopId;
                    updateReachableStops();
                });

                markers[stopId] = marker;
            });

            function findReachableStops(startStop, maxTravelTime) {
                const queue = [[startStop, 0, stops[startStop].line]];
                const visited = new Set();
                const reachableStops = new Set();

                while (queue.length > 0) {
                    const [currentStop, currentTime, currentLine] = queue.shift();

                    if (currentTime <= maxTravelTime) {
                        reachableStops.add(currentStop);
                        visited.add(currentStop);

                        stops[currentStop].connections.forEach(neighbor => {
                            if (!visited.has(neighbor)) {
                                const travelTime = stops[currentStop].travelTimes[neighbor];
                                const neighborLine = stops[neighbor].line;
                                const newTime = currentTime + travelTime;
                                queue.push([neighbor, newTime, neighborLine]);
                            }
                        });
                    }
                }

                console.log(`Reachable stops from ${startStop} within ${maxTravelTime} minutes:`, reachableStops);
                return reachableStops;
            }

            function updateReachableStops() {
                const maxTravelTime = parseInt(document.getElementById('travel-time-slider').value, 10);
                const reachableStops = findReachableStops(startStop, maxTravelTime);
                Object.values(markers).forEach(marker => {
                    marker.setIcon(greenDotIcon);
                });
                reachableStops.forEach(stopId => {
                    if (markers[stopId]) {
                        markers[stopId].setIcon(blueDotIcon);
                    }
                });
                if (markers[startStop]) {
                    markers[startStop].setIcon(redDotIcon);
                }
            }

            var travelTimeSlider = document.getElementById('travel-time-slider');
            var travelTimeValue = document.getElementById('travel-time-value');
            travelTimeSlider.addEventListener('input', function () {
                travelTimeValue.innerText = travelTimeSlider.value;
                updateReachableStops();
            });

            updateReachableStops();
        })
        .catch(error => console.error('Error loading stops GeoJSON data:', error));

    // Fetch tram lines data
    fetch('data/tramlines-MultiLineString.geojson')
        .then(response => response.json())
        .then(lineData => {
            lineData.features.forEach((feature, index) => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const line = feature.properties.NUMERO;
                    if (feature.geometry.type === "MultiLineString") {
                        const allCoordinates = feature.geometry.coordinates.map(lineSegment => 
                            lineSegment.map(coord => [coord[1], coord[0]])
                        );

                        const polyline = L.polyline(allCoordinates, {
                            color: '#91c9b4', 
                            weight: 4,
                            opacity: 0.7
                        }).addTo(map).bindPopup(`Tram Line: ${line}`);
                        polylines.push(polyline);
                        polylineMap[line] = polyline;

                        polyline.on('click', function () {
                            polylines.forEach(p => p.setStyle({ color: '#91c9b4', weight: 2, opacity: 0.7 }));
                            polyline.setStyle({ color: '#007ac9', weight: 5, opacity: 1.0 });
                        });
                    } else {
                        console.error('Unsupported geometry type:', feature.geometry.type);
                    }
                } else {
                    console.error('Invalid feature geometry:', feature);
                }
            });
        })
        .catch(error => console.error('Error loading tram lines GeoJSON data:', error));

    var customControl = L.Control.extend({
        options: {
            position: 'topright' 
        },
        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-control-custom');
            container.innerHTML = `
                <div id="controls">
                    <div>
                        <label for="travel-time-slider">Travel Time (minutes): <span id="travel-time-value">10</span></label>
                        <input type="range" id="travel-time-slider" min="3" max="85" step="1" value="10">
                    </div>
                </div>
            `;
            
            var travelTimeSlider = container.querySelector('#travel-time-slider');
            var travelTimeValue = container.querySelector('#travel-time-value');
            travelTimeSlider.addEventListener('input', function () {
                travelTimeValue.innerText = travelTimeSlider.value;
            });

            return container;
        }
    });
    map.addControl(new customControl());
});