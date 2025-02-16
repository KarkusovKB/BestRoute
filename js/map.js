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

async function initMap() {
    try {
        // Initialize the map
        map = new google.maps.Map(document.getElementById('map'), {
            zoom: 12,
            center: { lat: 0, lng: 0 }
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
    // Check if place already exists
    if (!savedPlaces.some(p => p.place_id === place.place_id)) {
        savedPlaces.push({
            place_id: place.place_id,
            name: place.name,
            address: place.formatted_address,
            location: place.geometry.location
        });
        updatePlacesList();
        savePlacesToLocalStorage();
    }
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

        // Add click handler to center map on this place
        li.addEventListener('click', (e) => {
            if (!e.target.classList.contains('remove-place')) {
                map.setCenter(place.location);
                map.setZoom(17);
                addMarker(place.location);
            }
        });

        placesList.appendChild(li);
    });

    // Add remove button handlers
    document.querySelectorAll('.remove-place').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(e.target.dataset.index);
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
        updatePlacesList();
    }
} 