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
        });
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
    const scriptElement = document.querySelector('script[src*="maps.googleapis.com"]');
    const apiKeyInfo = scriptElement ? 
        'API Key in use: ' + scriptElement.src.split('key=')[1].split('&')[0].slice(0, 5) + '...' :
        'No Google Maps script found';
    
    console.error('Google Maps Authentication Failed:', {
        apiKeyInfo: apiKeyInfo,
        pageUrl: window.location.href,
        referrer: document.referrer
    });
    
    document.getElementById('map').innerHTML = 
        '<div style="padding: 20px; color: red;">' +
        'Error: Google Maps failed to load. ' +
        'Please check browser console for details.</div>';
};

// Add this at the start of your file
window.addEventListener('error', function(e) {
    if (e.message.includes('google is not defined')) {
        console.error('Google Maps failed to load:', e);
        document.getElementById('map').innerHTML = 
            '<div style="padding: 20px; color: red;">' +
            'Error: Google Maps script failed to load. ' +
            'Please check browser console for details.</div>';
    }
}, true); 