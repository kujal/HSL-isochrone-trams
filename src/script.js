document.addEventListener("DOMContentLoaded", function () {
    // Initialize map centered on Helsinki
    var map = L.map("map", {
        center: [60.1699, 24.9384],
        zoom: 12,
        minZoom: 10, // Set minimum zoom level
        maxZoom: 15, // Set maximum zoom level
        maxBounds: [[60.045, 24.7], [60.297, 25.2]],
        maxBoundsViscosity: 1.0
    });

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Define a custom red dot icon
    var redDotIcon = L.icon({
        iconUrl: '../assets/round.png', // Relative path to your red dot image
        iconSize: [10, 10], // size of the icon
        iconAnchor: [5, 5], // point of the icon which will correspond to marker's location
        popupAnchor: [0, -5] // point from which the popup should open relative to the iconAnchor
    });

    // Fetch GeoJSON data and add markers to the map
    fetch('../data/hsl-trams.geojson')
        .then(response => response.json())
        .then(data => {
            data.features.forEach(feature => {
                var coordinates = feature.geometry.coordinates;
                var properties = feature.properties;
                L.marker([coordinates[1], coordinates[0]], { icon: redDotIcon }).addTo(map)
                    .bindPopup(`<b>${properties.name}</b><br>Lines: ${properties.lines.join(", ")}`);
            });
        })
        .catch(error => console.error('Error loading GeoJSON data:', error));
});