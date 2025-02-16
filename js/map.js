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

        // Get user's current location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const pos = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    };
                    map.setCenter(pos);
                    addMarker(pos);
                },
                () => {
                    handleLocationError(true);
                }
            );
        }

        // Initialize Google Places Autocomplete
        const input = document.getElementById('address-input');
        autocomplete = new google.maps.places.Autocomplete(input);
        
        // Bind the map's bounds to the autocomplete object
        autocomplete.bindTo('bounds', map);

        // Listen for place selection
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();

            if (!place.geometry) {
                window.alert("No details available for input: '" + place.name + "'");
                return;
            }

            // If the place has a geometry, then present it on a map
            if (place.geometry.viewport) {
                map.fitBounds(place.geometry.viewport);
            } else {
                map.setCenter(place.geometry.location);
                map.setZoom(17);
            }

            addMarker(place.geometry.location);
            
            // Add place to the list
            addToPlacesList(place);
        });

        // Add this to the end of initMap function
        loadPlacesFromLocalStorage();
    } catch (error) {
        console.error('Error initializing map:', error);
        document.getElementById('map').innerHTML = 'Error loading map. Please check the console for details.';
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
    }
}

function addMarkerToMap(place) {
    if (markers.has(place.place_id)) {
        markers.get(place.place_id).setMap(null);
    }

    const marker = new google.maps.Marker({
        position: place.location,
        map: map,
        animation: google.maps.Animation.DROP,
        title: place.name
    });

    // Add click listener to marker
    marker.addListener('click', () => {
        map.setCenter(place.location);
        map.setZoom(17);
        
        // Add info window
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div style="padding: 8px;">
                    <h3 style="margin-bottom: 4px;">${place.name}</h3>
                    <p style="color: #666;">${place.address}</p>
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
        });
    });
}

function savePlacesToLocalStorage() {
    localStorage.setItem('savedPlaces', JSON.stringify(savedPlaces));
}

function loadPlacesFromLocalStorage() {
    const saved = localStorage.getItem('savedPlaces');
    if (saved) {
        savedPlaces = JSON.parse(saved);
        savedPlaces.forEach(place => {
            addMarkerToMap(place);
        });
        updatePlacesList();
    }
} 