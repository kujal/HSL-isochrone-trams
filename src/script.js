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

    // Define a custom green dot icon
    var greenDotIcon = L.icon({
        iconUrl: '../assets/green-dot.png', // Relative path to your green dot image
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

    // Fetch stops data
    fetch('../data/tramstops-Points.geojson')
        .then(response => response.json())
        .then(stopsData => {
            // Fetch processed tram line data
            fetch('../data/tramlines-MultiLineString.geojson')
                .then(response => response.json())
                .then(lineData => {
                    // Add polylines to the map
                    lineData.features.forEach((feature, index) => {
                        if (feature.geometry && feature.geometry.coordinates) {
                            const line = feature.properties.NUMERO;
                            const offset = 0; // Apply a small offset based on the index

                            // Handle LineString geometry
                            if (feature.geometry.type === "LineString") {
                                const coordinates = applyOffset(feature.geometry.coordinates.map(coord => [coord[1], coord[0]]), offset);
                                
                                // Create border polyline
                                const borderPolyline = L.polyline(coordinates, {
                                    color: '#0a7c50', // Border color
                                    weight: 5,
                                    opacity: 1.0
                                }).addTo(map);

                                // Create inside polyline
                                const polyline = L.polyline(coordinates, {
                                    color: '#91c9b4', // Initial color
                                    weight: 4,
                                    opacity: 0.5
                                }).addTo(map).bindPopup(`Tram Line: ${line}`);
                                polylines.push(polyline);

                                // Change color to blue on click
                                polyline.on('click', function () {
                                    polylines.forEach(p => p.setStyle({ color: '#91c9b4', opacity: 0.1 }));
                                    polyline.setStyle({ color: 'blue', opacity: 1.0 });
                                    selectedPolyline = polyline;
                                });
                            }
                            // Handle MultiLineString geometry
                            else if (feature.geometry.type === "MultiLineString") {
                                const allCoordinates = feature.geometry.coordinates.map(lineSegment => 
                                    applyOffset(lineSegment.map(coord => [coord[1], coord[0]]), offset)
                                );

                                // Create border polyline
                                const borderPolyline = L.polyline(allCoordinates, {
                                    color: '#0a7c50', // Border color
                                    weight: 5,
                                    opacity: 1.0
                                }).addTo(map);

                                // Create inside polyline
                                const polyline = L.polyline(allCoordinates, {
                                    color: '#91c9b4', // Initial color
                                    weight: 4,
                                    opacity: 0.5
                                }).addTo(map).bindPopup(`Tram Line: ${line}`);
                                polylines.push(polyline);

                                // Change color to blue on click
                                polyline.on('click', function () {
                                    polylines.forEach(p => p.setStyle({ color: '#91c9b4', opacity: 0.1 }));
                                    polyline.setStyle({ color: 'blue', opacity: 1.0 });
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
                        const stopCoordinates = feature.geometry.coordinates;
                        const stopName = feature.properties.name;
                        const lines = feature.properties.lines;

                        lines.forEach(line => {
                            L.marker([stopCoordinates[1], stopCoordinates[0]], { icon: greenDotIcon }).addTo(map)
                                .bindPopup(`<b>${stopName}</b><br>Tram Line: ${line}`);
                        });
                    });
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