document.addEventListener("DOMContentLoaded", function () {
    // Initialize map centered on Helsinki
    var map = L.map("map", {
        center: [60.1699, 24.9384],
        zoom: 12,
        minZoom: 5, // Set minimum zoom level
        maxZoom: 15, // Set maximum zoom level
        maxBounds: [[60.045, 24.7], [60.297, 25.2]],
        maxBoundsViscosity: 1.0
    });

    // Add CartoDB Positron tiles
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Define custom icons
    var greenDotIcon = L.icon({
        iconUrl: 'assets/green-dot.png', // Relative path to your green dot image
        iconSize: [10, 10], // size of the icon
        iconAnchor: [5, 5], // point of the icon which will correspond to marker's location
        popupAnchor: [0, -5] // point from which the popup should open relative to the iconAnchor
    });

    var blueDotIcon = L.icon({
        iconUrl: 'assets/blue-dot.png', // Relative path to your blue dot image
        iconSize: [10, 10], // size of the icon
        iconAnchor: [5, 5], // point of the icon which will correspond to marker's location
        popupAnchor: [0, -5] // point from which the popup should open relative to the iconAnchor
    });

    var redDotIcon = L.icon({
        iconUrl: 'assets/red-dot.png', // Relative path to your red dot image
        iconSize: [10, 10], // size of the icon
        iconAnchor: [5, 5], // point of the icon which will correspond to marker's location
        popupAnchor: [0, -5] // point from which the popup should open relative to the iconAnchor
    });

    // Function to apply a slight offset to coordinates
    function applyOffset(coordinates, offset) {
        return coordinates.map(coord => [coord[0] + offset, coord[1] + offset]);
    }

    const polylines = [];
    const markers = {};
    const polylineMap = {};
    let startStop = 'H0446'; // Default start stop ID

    // Fetch stops data
    fetch('data/tramstops.geojson')
        .then(response => response.json())
        .then(stopsData => {
            const stops = {};
            const connections = {};

            // Process each stop
            stopsData.features.forEach(feature => {
                const stopId = feature.properties.LYHYTTUNNU;
                const stopName = feature.properties.NIMI;
                const coordinates = feature.geometry.coordinates;
                const travelTime = feature.properties.TRAVELTIME;
                const line = feature.properties.REITTI;

                console.log(`Processing stop: ${stopName}, Travel Time: ${travelTime}`);

                // Create a unique identifier for each stop
                if (!stops[stopId]) {
                    stops[stopId] = {
                        id: stopId,
                        name: stopName,
                        coordinates: coordinates,
                        connections: [],
                        travelTimes: {},
                        line: line // Add line property
                    };
                }

                // Add connections (edges) between stops
                if (!connections[line]) {
                    connections[line] = [];
                }
                connections[line].push({ stopId, travelTime });
            });

            // Create edges between stops based on the line connections
            Object.values(connections).forEach(lineStops => {
                for (let i = 0; i < lineStops.length - 1; i++) {
                    const stop1 = lineStops[i].stopId;
                    const stop2 = lineStops[i + 1].stopId;
                    const travelTime = lineStops[i].travelTime;
                    stops[stop1].connections.push(stop2);
                    stops[stop1].travelTimes[stop2] = travelTime;
                    stops[stop2].connections.push(stop1);
                    stops[stop2].travelTimes[stop1] = travelTime;

                    console.log(`Connection added: ${stop1} to ${stop2}, Travel Time: ${travelTime}`);
                }
            });

            // Add markers for each stop
            stopsData.features.forEach(feature => {
                const stopId = feature.properties.LYHYTTUNNU;
                const stopCoordinates = feature.geometry.coordinates;
                const stopName = feature.properties.NIMI;
                const lines = feature.properties.REITTI;

                const marker = L.marker([stopCoordinates[1], stopCoordinates[0]], { icon: greenDotIcon }).addTo(map)
                    .bindPopup(`<b>${stopName}</b><br>Tram Line: ${lines}`);
                
                marker.on('click', function () {
                    startStop = stopId;
                    console.log(`Start stop set to: ${stopId}`);
                    updateReachableStops();
                });

                markers[stopId] = marker;
            });

            // Function to find reachable stops within the given travel time
            function findReachableStops(startStop, maxTravelTime, transferTime) {
                const queue = [[startStop, 0, stops[startStop].line]]; // Add current line to the queue
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
                                const neighborLine = stops[neighbor].line; // Get the line of the neighbor
                                const newTime = currentTime + travelTime + (currentLine !== null && currentLine !== neighborLine ? transferTime : 0);
                                queue.push([neighbor, newTime, neighborLine]);
                                console.log(`Queueing neighbor: ${neighbor}, New Time: ${newTime}, Current Line: ${currentLine}, Neighbor Line: ${neighborLine}`);
                            }
                        });
                    }
                }

                console.log(`Reachable stops from ${startStop} within ${maxTravelTime} minutes:`, reachableStops);
                return reachableStops;
            }

            // Update reachable stops based on slider values
            function updateReachableStops() {
                const maxTravelTime = parseInt(document.getElementById('travel-time-slider').value, 10);
                const transferTime = parseInt(document.getElementById('transfer-time-slider').value, 10);

                console.log(`Updating reachable stops with max travel time: ${maxTravelTime} and transfer time: ${transferTime}`);

                const reachableStops = findReachableStops(startStop, maxTravelTime, transferTime);

                // Reset all markers to green
                Object.values(markers).forEach(marker => {
                    marker.setIcon(greenDotIcon);
                });

                // Set reachable stops to blue
                reachableStops.forEach(stopId => {
                    if (markers[stopId]) {
                        markers[stopId].setIcon(blueDotIcon);
                    }
                });

                // Set the start stop to red
                if (markers[startStop]) {
                    markers[startStop].setIcon(redDotIcon);
                }
            }

            // Initialize travel time slider
            var travelTimeSlider = document.getElementById('travel-time-slider');
            var travelTimeValue = document.getElementById('travel-time-value');
            travelTimeSlider.addEventListener('input', function () {
                travelTimeValue.innerText = travelTimeSlider.value;
                updateReachableStops();
            });

            // Initialize transfer time slider
            var transferTimeSlider = document.getElementById('transfer-time-slider');
            var transferTimeValue = document.getElementById('transfer-time-value');
            transferTimeSlider.addEventListener('input', function () {
                transferTimeValue.innerText = transferTimeSlider.value;
                updateReachableStops();
            });

            // Initial update of reachable stops
            updateReachableStops();
        })
        .catch(error => console.error('Error loading stops GeoJSON data:', error));

    // Fetch tram lines data
    fetch('data/tramlines-MultiLineString.geojson')
        .then(response => response.json())
        .then(lineData => {
            // Add polylines to the map
            lineData.features.forEach((feature, index) => {
                if (feature.geometry && feature.geometry.coordinates) {
                    const line = feature.properties.NUMERO;
                    const offset = 0; // Apply a small offset based on the index

                    // Handle MultiLineString geometry
                    if (feature.geometry.type === "MultiLineString") {
                        const allCoordinates = feature.geometry.coordinates.map(lineSegment => 
                            applyOffset(lineSegment.map(coord => [coord[1], coord[0]]), offset)
                        );

                        // Create inside polyline
                        const polyline = L.polyline(allCoordinates, {
                            color: '#91c9b4', // Initial color
                            weight: 4,
                            opacity: 0.7
                        }).addTo(map).bindPopup(`Tram Line: ${line}`);
                        polylines.push(polyline);

                        // Store polyline in polylineMap
                        polylineMap[line] = polyline;

                        // Change color to blue on click
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

    // Add custom control for sliders
    var customControl = L.Control.extend({
        options: {
            position: 'topright' // Position of the control
        },
        onAdd: function (map) {
            var container = L.DomUtil.create('div', 'leaflet-control-custom');
            container.innerHTML = `
                <div id="controls">
                    <div>
                        <label for="travel-time-slider">Travel Time (minutes): <span id="travel-time-value">10</span></label>
                        <input type="range" id="travel-time-slider" min="3" max="85" step="1" value="10">
                    </div>
                    <div>
                        <label for="transfer-time-slider">Time Lost in Transfer (minutes): <span id="transfer-time-value">3</span></label>
                        <input type="range" id="transfer-time-slider" min="0" max="15" step="1" value="3">
                    </div>
                </div>
            `;

            // Initialize travel time slider
            var travelTimeSlider = container.querySelector('#travel-time-slider');
            var travelTimeValue = container.querySelector('#travel-time-value');
            travelTimeSlider.addEventListener('input', function () {
                travelTimeValue.innerText = travelTimeSlider.value;
            });

            // Initialize transfer time slider
            var transferTimeSlider = container.querySelector('#transfer-time-slider');
            var transferTimeValue = container.querySelector('#transfer-time-value');
            transferTimeSlider.addEventListener('input', function () {
                transferTimeValue.innerText = transferTimeSlider.value;
            });

            return container;
        }
    });
    map.addControl(new customControl());
});