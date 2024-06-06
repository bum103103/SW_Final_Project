

document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('roomId');  // URL에서 roomId 추출

    fetch('/get-username')
    .then(response => response.json())
    .then(data => {
        if (data.username) {
            console.log("Logged in as:", data.username);
            username = data.username;
            initializeMap(roomId);
        }
    })
    .catch(error => console.error('Error fetching username:', error));
});

function toggleChat() {
    let chat = document.getElementsByClassName('chat-container')[0];
    
    if (chat.style.display === 'none') {
        chat.style.display = 'flex';
        hideControls();
    }
    else {
        chat.style.display = 'none';
        showControls();
    }
}

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

function initializeMap(roomId) {
    socket.emit('joinRoom', roomId);
    console.log(`Joined room ${roomId}`);

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

            var mapTypeControl = new kakao.maps.MapTypeControl();

            map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);
        
            if (username) {
                addOrUpdateUserMarker(username, userLatitude, userLongitude);
            }

            setInterval(() => updateUserLocation(roomId), 5000);
        })
        .catch((error) => {
            console.error(error);
        });
}

function hideControls() {
    let mapContainer = document.getElementById('map');
    // 지도의 오른쪽 위 컨트롤을 찾아서 숨깁니다.
    let header = mapContainer.children[2];
    let topRightControls = header.firstChild;
    if (topRightControls) {
        topRightControls.style.display = 'none'; // 모든 오른쪽 상단 컨트롤 숨기기
    }
}

function showControls() {
    let mapContainer = document.getElementById('map');
    // 지도의 오른쪽 위 컨트롤을 찾아서 숨깁니다.
    let header = mapContainer.children[2];
    let topRightControls = header.firstChild;
    if (topRightControls) {
        topRightControls.style.display = 'block'; // 모든 오른쪽 상단 컨트롤 숨기기
    }
}

function addOrUpdateUserMarker(username, latitude, longitude) {
    if (userMarkers[username]) {
        // Update existing marker and popup position
        userMarkers[username].marker.setPosition(new kakao.maps.LatLng(latitude, longitude));
        userMarkers[username].overlay.setPosition(new kakao.maps.LatLng(latitude, longitude));
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
                    <strong>${username}</strong><br>
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

socket.on('connect', function() {
    console.log('Socket.IO 연결 성공');
});

socket.on('disconnect', function() {
    console.log('Socket.IO 연결 종료');
});

socket.on('updateUserLocations', (data) => {
    updateUserMarkers(data.userLocations);
    if (data.center) {
        addOrUpdateCenterMarker(data.center.latitude, data.center.longitude);
    }
});

socket.on('removeMarker', (data) => {
    removeUserMarker(data.username);
});

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

function sendLocation(roomId, latitude, longitude) {
    if (socket.connected) {
        const message = {
            action: 'updateLocation',
            username: username,
            latitude: latitude,
            longitude: longitude,
            roomId: roomId
        };
        socket.emit('updateLocation', message);
    } else {
        console.log("Socket.IO가 연결되어 있지 않습니다.");
    }
}

function updateUserLocation(roomId) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            if (username) {
                sendLocation(roomId, latitude, longitude);
            }
        }, error => {
            console.error('위치 정보 에러:', error);
        });
    } else {
        console.error('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
    }
}
