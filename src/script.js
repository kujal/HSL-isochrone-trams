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

    // Function to apply a slight offset to coordinates
    function applyOffset(coordinates, offset) {
        return coordinates.map(coord => [coord[0] + offset, coord[1] + offset]);
    }

    let selectedPolyline = null;
    const polylines = [];
    const markers = {};
    const polylineMap = {};

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
                const travelTime = feature.properties.travel_time;

                // Create a unique identifier for each stop
                if (!stops[stopId]) {
                    stops[stopId] = {
                        id: stopId,
                        name: stopName,
                        coordinates: coordinates,
                        connections: [],
                        travelTimes: {}
                    };
                }

                // Add connections (edges) between stops
                const line = feature.properties.REITTI;
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
                }
            });

            // Example: Find the shortest path between two stops
            const startStop = 'H0446'; // Replace with actual start stop ID
            const endStop = 'H0301'; // Replace with actual end stop ID
            const result = bfsShortestPath(stops, startStop, endStop);

            if (result) {
                const { path, totalTime } = result;
                console.log('Shortest path:', path);
                console.log('Estimated travel time:', totalTime, 'minutes');
            } else {
                console.log('No path found');
            }

            // Fetch processed tram line data
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
                                    selectedPolyline = polyline;
                                });
                            } else {
                                console.error('Unsupported geometry type:', feature.geometry.type);
                            }
                        } else {
                            console.error('Invalid feature geometry:', feature);
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
                        
                        markers[stopId] = marker;
                    });

                    // Highlight the stops in the shortest path
                    if (result && result.path) {
                        result.path.forEach(stopId => {
                            if (markers[stopId]) {
                                markers[stopId].setIcon(blueDotIcon);
                            }
                        });

                        // Highlight the polylines in the shortest path
                        for (let i = 0; i < result.path.length - 1; i++) {
                            const stop1 = result.path[i];
                            const stop2 = result.path[i + 1];
                            Object.values(polylineMap).forEach(polyline => {
                                const latlngs = polyline.getLatLngs();
                                for (let j = 0; j < latlngs.length - 1; j++) {
                                    if ((latlngs[j].lat === stops[stop1].coordinates[1] && latlngs[j].lng === stops[stop1].coordinates[0] &&
                                         latlngs[j + 1].lat === stops[stop2].coordinates[1] && latlngs[j + 1].lng === stops[stop2].coordinates[0]) ||
                                        (latlngs[j].lat === stops[stop2].coordinates[1] && latlngs[j].lng === stops[stop2].coordinates[0] &&
                                         latlngs[j + 1].lat === stops[stop1].coordinates[1] && latlngs[j + 1].lng === stops[stop1].coordinates[0])) {
                                        polyline.setStyle({ color: 'blue', opacity: 1.0 });
                                    }
                                }
                            });
                        }
                    }
                })
                .catch(error => console.error('Error loading processed GeoJSON data:', error));
        })
        .catch(error => console.error('Error loading stops GeoJSON data:', error));

    // Initialize travel time slider
    var travelTimeSlider = document.getElementById('travel-time-slider');
    var travelTimeValue = document.getElementById('travel-time-value');
    travelTimeSlider.addEventListener('input', function () {
        travelTimeValue.innerText = travelTimeSlider.value;
    });

    // Initialize transfer time slider
    var transferTimeSlider = document.getElementById('transfer-time-slider');
    var transferTimeValue = document.getElementById('transfer-time-value');
    transferTimeSlider.addEventListener('input', function () {
        transferTimeValue.innerText = transferTimeSlider.value;
    });
});

// BFS function to find the shortest path
function bfsShortestPath(graph, start, end) {
    const queue = [[start]];
    const visited = new Set();
    const travelTimes = { [start]: 0 };

    while (queue.length > 0) {
        const path = queue.shift();
        const node = path[path.length - 1];

        if (node === end) {
            return { path, totalTime: travelTimes[node] };
        }

        if (!visited.has(node)) {
            visited.add(node);
            const neighbors = graph[node].connections;

            neighbors.forEach(neighbor => {
                if (!visited.has(neighbor)) {
                    const newPath = path.slice();
                    newPath.push(neighbor);
                    queue.push(newPath);
                    travelTimes[neighbor] = travelTimes[node] + graph[node].travelTimes[neighbor];
                }
            });
        }
    }

    return null; // No path found
}