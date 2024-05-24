var username = null;
document.addEventListener('DOMContentLoaded', function() {
    fetch('/get-username')
    .then(response => response.json())
    .then(data => {
        if (data.username) {
            console.log("Logged in as:", data.username);
            username = data.username;
            initializeChat();
            initializeMap(); // username이 정의된 후 initializeMap 호출
        }
    })
    .catch(error => console.error('Error fetching username:', error));
});

function getUserGeoData() {
    return new Promise((resolve, reject) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    resolve([latitude, longitude]);
                },
                (error) => {
                    document.getElementById('status').textContent = `Error fetching location: ${error.message}`;
                    reject(`Error fetching location: ${error.message}`);
                }
            );
        } else {
            document.getElementById('status').textContent = 'Geolocation is not supported by this browser.';
            reject('Geolocation is not supported by this browser.');
        }
    });
}

let userLatitude = 0.0;
let userLongitude = 0.0;
let map;
let userMarkers = {};

function initializeMap() {
    getUserGeoData()
        .then(([latitude, longitude]) => {
            userLatitude = latitude;
            userLongitude = longitude;
            console.log(`Initial Latitude: ${userLatitude}, Longitude: ${userLongitude}`);
            
            var container = document.getElementById('map'); 
            var options = { 
                center: new kakao.maps.LatLng(userLatitude, userLongitude), 
                level: 3 
            };

            map = new kakao.maps.Map(container, options);

            if (username) {
                addOrUpdateUserMarker(username, userLatitude, userLongitude);
            }

            setInterval(updateUserLocation, 5000);
        })
        .catch((error) => {
            console.error(error);
        });
}
function addOrUpdateUserMarker(username, latitude, longitude) {
    if (userMarkers[username]) {
        // Update existing marker's position
        userMarkers[username].marker.setPosition(new kakao.maps.LatLng(latitude, longitude));
    } else {
        // Create a new marker
        var markerPosition = new kakao.maps.LatLng(latitude, longitude); 
        var marker = new kakao.maps.Marker({
            position: markerPosition
        });
        marker.setMap(map);

        var content = `
        <div id="${username}-popup" class="custom-popup">
            <div class="leaflet-popup-content-wrapper">
                <div class="leaflet-popup-content">
                    <strong>${username}'s location</strong><br>
                    <div class="messages"></div>
                </div>
            </div>
            <div class="leaflet-popup-tip-container">
                <div class="leaflet-popup-tip"></div>
            </div>
        </div>`;
        
        var overlay = new kakao.maps.CustomOverlay({
            position: markerPosition,
            content: content,
            yAnchor: 0.6, // 팝업을 마커에 더 가깝게 위치시킴
            xAnchor: 0.5 // Center the overlay horizontally on the marker
        });
        overlay.setMap(map);

        userMarkers[username] = {
            marker: marker,
            overlay: overlay
        };
    }
}



function updateUserMarkers(userLocations) {
    userLocations.forEach(userLocation => {
        addOrUpdateUserMarker(userLocation.username, userLocation.latitude, userLocation.longitude);
    });
}

var socket = new WebSocket(`wss://${window.location.host}`);

socket.onopen = function() {
    console.log('WebSocket 연결 성공');
};

socket.onerror = function(error) {
    console.log('WebSocket 에러:', error);
};

socket.onclose = function() {
    console.log('WebSocket 연결 종료');
};

socket.onmessage = function(event) {
    const message = JSON.parse(event.data);
    if (message.action === 'updateUserLocations') {
        updateUserMarkers(message.userLocations);
        if (message.center) {
            addOrUpdateCenterMarker(message.center.latitude, message.center.longitude);
        }
    } else if (message.action === 'removeMarker') {
        removeUserMarker(message.username);
    }
};


let centerMarker = null;
function addOrUpdateCenterMarker(latitude, longitude) {
    if (centerMarker) {
        centerMarker.setPosition(new kakao.maps.LatLng(latitude, longitude));
    } else {
        var markerPosition = new kakao.maps.LatLng(latitude, longitude); 
        centerMarker = new kakao.maps.Marker({
            position: markerPosition
        });
        centerMarker.setMap(map);
    }
}

function removeUserMarker(username) {
    if (userMarkers[username]) {
        userMarkers[username].marker.setMap(null); // 마커 제거
        userMarkers[username].overlay.setMap(null); // 오버레이 제거
        delete userMarkers[username];
    }
}


function sendLocation(latitude, longitude) {
    if (socket.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            action: 'updateLocation',
            username: username,
            latitude: latitude,
            longitude: longitude
        });
        socket.send(message);
        console.log('위치 데이터 전송:', message);
    } else {
        console.log("WebSocket이 열려있지 않습니다.");
    }
}

function updateUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            if (username) {
                sendLocation(latitude, longitude);
            }
        }, error => {
            console.error('위치 정보 에러:', error);
        });
    } else {
        console.error('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
    }
}
