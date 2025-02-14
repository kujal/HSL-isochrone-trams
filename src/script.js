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

    // Fetch stops data
    fetch('../data/hsl-trams.geojson')
        .then(response => response.json())
        .then(stopsData => {
            // Fetch processed tram line data
            fetch('../data/tramlines-MultiLineString.geojson')
                .then(response => response.json())
                .then(lineData => {
                    // Add polylines to the map
                    lineData.features.forEach(feature => {
                        if (feature.geometry && feature.geometry.coordinates) {
                            const line = feature.properties.NUMERO;

                            // Handle LineString geometry
                            if (feature.geometry.type === "LineString") {
                                const coordinates = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                                L.polyline(coordinates, {
                                    color: getColorForLine(line), // Function to get a distinct color for each line
                                    weight: 4,
                                    opacity: 0.7
                                }).addTo(map).bindPopup(`Tram Line: ${line}`);
                            }
                            // Handle MultiLineString geometry
                            else if (feature.geometry.type === "MultiLineString") {
                                feature.geometry.coordinates.forEach(lineSegment => {
                                    const coordinates = lineSegment.map(coord => [coord[1], coord[0]]);
                                    L.polyline(coordinates, {
                                        color: getColorForLine(line), // Function to get a distinct color for each line
                                        weight: 4,
                                        opacity: 0.7
                                    }).addTo(map).bindPopup(`Tram Line: ${line}`);
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
                            L.marker([stopCoordinates[1], stopCoordinates[0]], { icon: redDotIcon }).addTo(map)
                                .bindPopup(`<b>${stopName}</b><br>Tram Line: ${line}`);
                        });
                    });
                })
                .catch(error => console.error('Error loading processed GeoJSON data:', error));
        })
        .catch(error => console.error('Error loading stops GeoJSON data:', error));
});

// Function to get a distinct color for each tram line
function getColorForLine(line) {
    var colors = {
        "1": "red",
        "2": "blue",
        "3": "green",
        "4": "purple",
        "5": "orange",
        "6": "yellow",
        "7": "pink",
        "8": "brown",
        "9": "black",
        "10": "cyan",
        "11": "magenta",
        "12": "lime",
        "13": "maroon",
        "14": "navy",
        "15": "olive"
    };
    return colors[line] || 'gray';
}