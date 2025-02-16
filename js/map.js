// Add these at the very top of the file
window.addEventListener('error', function(e) {
    console.error('Google Maps Error Details:', {
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        error: e.error
    });
}, true);

let map;
let marker;
let autocomplete;
let savedPlaces = [];
let markers = new Map(); // To store all markers
let directionsService;
let directionsRenderer;
let currentRoute = null;
let currentTravelMode = 'DRIVING';

async function initMap() {
    try {
        // Initialize the map
        const mapStyle = [
            {
                "featureType": "water",
                "elementType": "geometry",
                "stylers": [{"color": "#e9e9e9"}, {"lightness": 17}]
            },
            {
                "featureType": "landscape",
                "elementType": "geometry",
                "stylers": [{"color": "#f5f5f5"}, {"lightness": 20}]
            },
            {
                "featureType": "road.highway",
                "elementType": "geometry.fill",
                "stylers": [{"color": "#ffffff"}, {"lightness": 17}]
            },
            {
                "featureType": "road.highway",
                "elementType": "geometry.stroke",
                "stylers": [{"color": "#ffffff"}, {"lightness": 29}, {"weight": 0.2}]
            },
            {
                "featureType": "road.arterial",
                "elementType": "geometry",
                "stylers": [{"color": "#ffffff"}, {"lightness": 18}]
            },
            {
                "featureType": "road.local",
                "elementType": "geometry",
                "stylers": [{"color": "#ffffff"}, {"lightness": 16}]
            },
            {
                "featureType": "poi",
                "elementType": "geometry",
                "stylers": [{"color": "#f5f5f5"}, {"lightness": 21}]
            },
            {
                "featureType": "poi.park",
                "elementType": "geometry",
                "stylers": [{"color": "#dedede"}, {"lightness": 21}]
            }
        ];

        map = new google.maps.Map(document.getElementById('map'), {
            zoom: 12,
            center: { lat: 0, lng: 0 },
            styles: mapStyle,
            disableDefaultUI: true, // Removes default UI elements
            zoomControl: true, // Add back zoom control
            mapTypeControl: false,
            scaleControl: true,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: true
        });

        // Initialize directions services
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: '#007AFF',
                strokeWeight: 4
            }
        });

        // Initialize autocomplete
        const input = document.getElementById('address-input');
        autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.bindTo('bounds', map);
        
        // Set up event listeners
        setupEventListeners();
        
        // Try to load saved places
        loadPlacesFromLocalStorage();

        // Get user location last
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    map.setCenter(pos);
                },
                () => {
                    console.warn('Geolocation failed');
                    // Continue without geolocation
                }
            );
        }
    } catch (error) {
        console.error('Error initializing map:', error);
        document.getElementById('map').innerHTML = 
            '<div style="padding: 20px; color: red;">' +
            'Error loading map. Please refresh the page. ' +
            'If the problem persists, check if you have enabled location services ' +
            'and try disabling any content blockers.</div>';
    }
}

function addMarker(location) {
    if (marker) {
        marker.setMap(null);
    }
    marker = new google.maps.Marker({
        position: location,
        map: map,
        animation: google.maps.Animation.DROP
    });
}

function handleLocationError(browserHasGeolocation) {
    console.log(
        browserHasGeolocation
            ? "Error: The Geolocation service failed."
            : "Error: Your browser doesn't support geolocation."
    );
}

// Update the gm_authFailure function
window.gm_authFailure = function() {
    const scriptTags = document.querySelectorAll('script[src*="maps.googleapis.com"]');
    const apiKeyInfo = Array.from(scriptTags).map(script => {
        const key = script.src.split('key=')[1]?.split('&')[0];
        return key ? `${key.substr(0, 4)}...` : 'No key found';
    });

    console.error('Google Maps Authentication Failed:', {
        apiKeys: apiKeyInfo,
        url: window.location.href,
        timestamp: new Date().toISOString()
    });

    document.getElementById('map').innerHTML = 
        '<div style="padding: 20px; color: red;">' +
        'Error: Google Maps authentication failed.<br><br>' +
        'Please check:<br>' +
        '1. API key is properly set<br>' +
        '2. Domain is authorized<br>' +
        '3. APIs are enabled<br>' +
        '</div>';
};

// Add this at the start of your file
window.addEventListener('error', function(e) {
    if (e.message.includes('google is not defined')) {
        console.error('Google Maps failed to load:', e);
        document.getElementById('map').innerHTML = 
            '<div style="padding: 20px; color: red;">' +
            'Error: Google Maps script failed to load. <br><br>' +
            'Please:<br>' +
            '1. Check if you have an ad blocker enabled and disable it for this site<br>' +
            '2. Refresh the page<br>' +
            'If the problem persists, check browser console for details.</div>';
    }
}, true);

function addToPlacesList(place) {
    if (!savedPlaces.some(p => p.place_id === place.place_id)) {
        const placeData = {
            place_id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
            }
        };
        
        savedPlaces.push(placeData);
        addMarkerToMap(placeData);
        updatePlacesList();
        savePlacesToLocalStorage();

        // Automatically optimize route when adding a new place
        if (savedPlaces.length >= 2) {
            optimizeRoute();
        }
    }
}

// Add this function to create numbered markers
function createNumberedMarker(number, color = '#007AFF') {
    return {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: color,
        fillOpacity: 1,
        strokeWeight: 2,
        strokeColor: '#FFFFFF',
        scale: 14,
        labelOrigin: new google.maps.Point(0, 0),
    };
}

// Update the updateRouteVisualization function
function updateRouteVisualization(result) {
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    markers.clear();

    // Create new markers with numbers
    savedPlaces.forEach((place, index) => {
        const marker = new google.maps.Marker({
            position: place.location,
            map: map,
            icon: createNumberedMarker('#007AFF'),
            label: {
                text: (index + 1).toString(),
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 'bold'
            },
            zIndex: 100 + index
        });

        markers.set(place.place_id, marker);

        // Add click listener
        marker.addListener('click', () => {
            map.setCenter(place.location);
            map.setZoom(17);
            
            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding: 8px;">
                        <h3 style="margin-bottom: 4px;">${place.name}</h3>
                        <p style="color: #666;">Stop #${index + 1}</p>
                    </div>
                `
            });
            infoWindow.open(map, marker);
        });
    });

    // Update the route line style
    const routeOptions = {
        polylineOptions: {
            strokeColor: '#007AFF',
            strokeWeight: 4,
            strokeOpacity: 0.8
        },
        suppressMarkers: true // Hide default markers since we're using custom ones
    };

    directionsRenderer.setOptions(routeOptions);
    directionsRenderer.setDirections(result);
}

// Update the optimizeRoute function
async function optimizeRoute() {
    if (savedPlaces.length < 2) {
        alert('Add at least 2 places to optimize the route');
        return;
    }

    const waypoints = savedPlaces.slice(1, -1).map(place => ({
        location: place.location,
        stopover: true
    }));

    try {
        const result = await calculateRoute(
            savedPlaces[0].location,
            savedPlaces[savedPlaces.length - 1].location,
            waypoints,
            currentTravelMode
        );

        // Get the optimized waypoint order
        const order = result.routes[0].waypoint_order;
        
        // Reorder saved places based on optimization
        const optimizedPlaces = [savedPlaces[0]];
        order.forEach(index => {
            optimizedPlaces.push(savedPlaces[index + 1]);
        });
        optimizedPlaces.push(savedPlaces[savedPlaces.length - 1]);

        // Update the saved places array with the optimized order
        savedPlaces = optimizedPlaces;
        
        // Update UI with animation
        await animateReordering(optimizedPlaces);
        updatePlacesList();
        savePlacesToLocalStorage();
        
        // Show route info
        displayRouteInfo(result.routes[0].legs);
        
        currentRoute = result;

        // Update markers and lines
        updateRouteVisualization(result);

        // Fit bounds to show all markers
        const bounds = new google.maps.LatLngBounds();
        savedPlaces.forEach(place => bounds.extend(place.location));
        map.fitBounds(bounds);
    } catch (error) {
        console.error('Route optimization failed:', error);
        alert('Could not optimize route. Please try again.');
    }
}

function calculateRoute(origin, destination, waypoints, travelMode) {
    return new Promise((resolve, reject) => {
        directionsService.route({
            origin: origin,
            destination: destination,
            waypoints: waypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode[travelMode]
        }, (result, status) => {
            if (status === 'OK') {
                directionsRenderer.setDirections(result);
                resolve(result);
            } else {
                reject(status);
            }
        });
    });
}

function displayRouteInfo(legs) {
    let totalDistance = 0;
    let totalDuration = 0;

    legs.forEach(leg => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
    });

    const routeInfo = document.createElement('div');
    routeInfo.className = 'route-info';
    routeInfo.innerHTML = `
        <strong>Optimized Route Info:</strong>
        <span class="total-time">Total Time: ${formatDuration(totalDuration)}</span>
        <span class="total-distance">Total Distance: ${formatDistance(totalDistance)}</span>
    `;

    const existingInfo = document.querySelector('.route-info');
    if (existingInfo) {
        existingInfo.remove();
    }
    document.querySelector('.route-controls').appendChild(routeInfo);
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours ? hours + 'h ' : ''}${minutes}min`;
}

function formatDistance(meters) {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
}

// Update the DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
    const drivingButton = document.getElementById('mode-driving');
    const walkingButton = document.getElementById('mode-walking');
    
    drivingButton.addEventListener('click', () => {
        setTravelMode('DRIVING', drivingButton, walkingButton);
    });
    
    walkingButton.addEventListener('click', () => {
        setTravelMode('WALKING', walkingButton, drivingButton);
    });
});

function setTravelMode(mode, activeButton, inactiveButton) {
    currentTravelMode = mode;
    activeButton.classList.add('active');
    inactiveButton.classList.remove('active');
    
    // Automatically optimize route when mode changes
    if (savedPlaces.length >= 2) {
        optimizeRoute();
    }
}

// Update clearRoute function
function clearRoute() {
    if (directionsRenderer) {
        directionsRenderer.setDirections({ routes: [] });
    }
    currentRoute = null;
    const routeInfo = document.querySelector('.route-info');
    if (routeInfo) {
        routeInfo.remove();
    }
}

async function animateReordering(newOrder) {
    const placesList = document.getElementById('saved-places');
    const items = placesList.querySelectorAll('.place-item');
    
    // Add transition class to all items
    items.forEach(item => {
        item.style.transition = 'transform 0.5s ease-in-out';
    });

    // Calculate and apply the new positions
    const oldPositions = Array.from(items).map(item => item.getBoundingClientRect());
    
    // Update the list with new order
    updatePlacesList();
    
    // Animate from old positions to new positions
    const newItems = placesList.querySelectorAll('.place-item');
    const newPositions = Array.from(newItems).map(item => item.getBoundingClientRect());
    
    newItems.forEach((item, index) => {
        const oldPos = oldPositions[index];
        const newPos = newPositions[index];
        const deltaY = oldPos.top - newPos.top;
        
        // Apply the reverse transform to start from the old position
        item.style.transform = `translateY(${deltaY}px)`;
        
        // Force a reflow
        item.offsetHeight;
        
        // Animate to the new position
        item.style.transform = 'translateY(0)';
    });

    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 500));
}

// Separate event listener setup
function setupEventListeners() {
    autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();

        if (!place.geometry) {
            window.alert("No details available for input: '" + place.name + "'");
            return;
        }

        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else {
            map.setCenter(place.geometry.location);
            map.setZoom(17);
        }

        addToPlacesList(place);
    });
}

// Update addMarkerToMap to use numbered markers
function addMarkerToMap(place) {
    if (markers.has(place.place_id)) {
        markers.get(place.place_id).setMap(null);
    }

    const index = savedPlaces.findIndex(p => p.place_id === place.place_id);
    const marker = new google.maps.Marker({
        position: place.location,
        map: map,
        icon: createNumberedMarker('#007AFF'),
        label: {
            text: (index + 1).toString(),
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 'bold'
        },
        animation: google.maps.Animation.DROP,
        zIndex: 100 + index
    });

    marker.addListener('click', () => {
        map.setCenter(place.location);
        map.setZoom(17);
        
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="padding: 8px;">
                    <h3 style="margin-bottom: 4px;">${place.name}</h3>
                    <p style="color: #666;">Stop #${index + 1}</p>
                </div>
            `
        });
        infoWindow.open(map, marker);
    });

    markers.set(place.place_id, marker);
}

function updatePlacesList() {
    const placesList = document.getElementById('saved-places');
    placesList.innerHTML = '';

    savedPlaces.forEach((place, index) => {
        const li = document.createElement('li');
        li.className = 'place-item';
        li.innerHTML = `
            <div class="place-number">${index + 1}</div>
            <div class="place-name">${place.name}</div>
            <div class="place-address">${place.address}</div>
            <span class="remove-place" data-index="${index}">×</span>
        `;

        li.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-place')) {
                map.setCenter(place.location);
                map.setZoom(17);
                
                // Animate marker
                const marker = markers.get(place.place_id);
                if (marker) {
                    marker.setAnimation(google.maps.Animation.BOUNCE);
                    setTimeout(() => marker.setAnimation(null), 750);
                }
            }
        });

        placesList.appendChild(li);
    });

    document.querySelectorAll('.remove-place').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(e.target.dataset.index);
            const place = savedPlaces[index];
            
            // Remove marker from map
            if (markers.has(place.place_id)) {
                markers.get(place.place_id).setMap(null);
                markers.delete(place.place_id);
            }
            
            savedPlaces.splice(index, 1);
            updatePlacesList();
            savePlacesToLocalStorage();
            
            // Clear the route when a place is removed
            clearRoute();
        });
    });
}

function savePlacesToLocalStorage() {
    try {
        localStorage.setItem('savedPlaces', JSON.stringify(savedPlaces));
    } catch (error) {
        console.warn('Could not save to localStorage:', error);
        // Continue without saving to localStorage
    }
}

function loadPlacesFromLocalStorage() {
    try {
        const saved = localStorage.getItem('savedPlaces');
        if (saved) {
            savedPlaces = JSON.parse(saved);
            savedPlaces.forEach(place => {
                addMarkerToMap(place);
            });
            updatePlacesList();
        }
    } catch (error) {
        console.warn('Could not load from localStorage:', error);
        // Continue with empty places list
        savedPlaces = [];
    }
} 