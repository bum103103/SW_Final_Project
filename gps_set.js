function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function (match) {
        switch (match) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#039;';
            default:
                return match;
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
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

let socket;
let userLatitude = 0.0;
let userLongitude = 0.0;
let map;
let userMarkers = {};
let startMarker, endMarker;
let isAdmin = false;

async function initializeMap(roomId) {
    try {
        await connectSocket();
        socket.emit('joinRoom', roomId);
        console.log(`Joined room ${roomId}`);

        const [latitude, longitude] = await getUserGeoData();
        console.log(`Initial Latitude: ${latitude}, Longitude: ${longitude}`);

        var container = document.getElementById('map');
        var options = {
            center: new kakao.maps.LatLng(latitude, longitude),
            level: 2
        };

        map = new kakao.maps.Map(container, options);

        var mapTypeControl = new kakao.maps.MapTypeControl();
        map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);

        if (username) {
            addOrUpdateUserMarker(username, latitude, longitude);
        }

        setupSocketListeners(roomId);
        setInterval(() => updateUserLocation(roomId), 5000);

        // 서버에 초기 위치 전송
        sendLocation(roomId, latitude, longitude);
    } catch (error) {
        console.error('Map initialization error:', error);
        alert('Failed to initialize map. Please try again.');
    }
}

function connectSocket() {
    return new Promise((resolve, reject) => {
        socket = io();
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
    });
}

function setupSocketListeners(roomId) {
    socket.on('adminStatus', handleAdminStatus);
    socket.on('markerUpdate', updateMarkerPosition);
    socket.on('updateUserLocations', (data) => {
        console.log("Received user locations:", data);
        updateUserMarkers(data.userLocations);
        if (data.center) {
            addOrUpdateCenterMarker(data.center.latitude, data.center.longitude);
        }
    });
    socket.on('removeMarker', (data) => {
        removeUserMarker(data.username);
    });
    
    // 초기 관리자 상태 요청
    socket.emit('getAdminStatus', roomId);
}

function handleAdminStatus(status) {
    isAdmin = status;
    console.log("Admin status:", isAdmin);
    if (isAdmin) {
        createAdminMarkers();
    }
}
function emitMarkerPosition(type, position) {
    socket.emit('markerMove', {
        type: type,
        lat: position.getLat(),
        lng: position.getLng(),
        roomId: roomId
    });
}


function updateMarkerPosition(data) {
    console.log("Updating marker position:", data);
    const position = new kakao.maps.LatLng(data.lat, data.lng);
    if (data.type === 'start') {
        if (!startMarker) {
            startMarker = new kakao.maps.Marker({
                position: position,
                image: new kakao.maps.MarkerImage(
                    'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/red_b.png',
                    new kakao.maps.Size(50, 45),
                    { offset: new kakao.maps.Point(15, 43) }
                )
            });
        }
        startMarker.setPosition(position);
        startMarker.setMap(map);
    } else if (data.type === 'end') {
        if (!endMarker) {
            endMarker = new kakao.maps.Marker({
                position: position,
                image: new kakao.maps.MarkerImage(
                    'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/blue_b.png',
                    new kakao.maps.Size(50, 45),
                    { offset: new kakao.maps.Point(15, 43) }
                )
            });
        }
        endMarker.setPosition(position);
        endMarker.setMap(map);
    }

    // 방장이 아닌 경우에만 마커를 드래그 불가능하게 설정
    if (!isAdmin) {
        if (startMarker) startMarker.setDraggable(false);
        if (endMarker) endMarker.setDraggable(false);
    } else {
        if (startMarker) startMarker.setDraggable(true);
        if (endMarker) endMarker.setDraggable(true);
    }
}

function createAdminMarkers() {
    console.log("Creating admin markers");
    const offset = 0.001;
    const center = map.getCenter();
    
    if (!startMarker) {
        startMarker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(center.getLat() - offset, center.getLng() - offset),
            draggable: true,
            image: new kakao.maps.MarkerImage(
                'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/red_b.png',
                new kakao.maps.Size(50, 45),
                { offset: new kakao.maps.Point(15, 43) }
            )
        });
        startMarker.setMap(map);
        
        kakao.maps.event.addListener(startMarker, 'dragend', function() {
            emitMarkerPosition('start', startMarker.getPosition());
        });
    }

    if (!endMarker) {
        endMarker = new kakao.maps.Marker({
            position: new kakao.maps.LatLng(center.getLat() + offset, center.getLng() + offset),
            draggable: true,
            image: new kakao.maps.MarkerImage(
                'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/blue_b.png',
                new kakao.maps.Size(50, 45),
                { offset: new kakao.maps.Point(15, 43) }
            )
        });
        endMarker.setMap(map);
        
        kakao.maps.event.addListener(endMarker, 'dragend', function() {
            emitMarkerPosition('end', endMarker.getPosition());
        });
    }

    // 초기 마커 위치 서버에 전송
    emitMarkerPosition('start', startMarker.getPosition());
    emitMarkerPosition('end', endMarker.getPosition());
}

function addMarkerDragListeners() {
    kakao.maps.event.addListener(startMarker, 'dragend', function () {
        emitMarkerPosition('start', startMarker.getPosition());
    });

    kakao.maps.event.addListener(endMarker, 'dragend', function () {
        emitMarkerPosition('end', endMarker.getPosition());
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
        userMarkers[username].clusterOverlay.setPosition(new kakao.maps.LatLng(latitude, longitude));
        if (userMarkers[username].clusteredBy !== username || userMarkers[username].isCluster) {
            if (!userMarkers[username].isCluster) {
                userMarkers[username].marker.setMap(map);
            }
            userMarkers[username].overlay.setMap(map);
            userMarkers[username].clusterOverlay.setMap(null);
            userMarkers[username].clusteredBy = username;
            userMarkers[username].isCluster = false;
        }
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

        var clusterContent = `
        <div id="${username}-popup" class="custom-popup">
            <div class="leaflet-popup-content-wrapper-cluster">
                <div class="leaflet-popup-content">
                    <strong>단체 채팅방</strong><br>
                    <div class="messages"></div>
                </div>
            </div>
            <div class="leaflet-popup-tip-container">
                <div class="leaflet-popup-tip"></div>
            </div>
        </div>`;
        var clusterOverlay = new kakao.maps.CustomOverlay({
            position: markerPosition,
            content: clusterContent,
            yAnchor: 0.6, // 팝업을 마커에 더 가깝게 위치시킴
            xAnchor: 0.5 // Center the overlay horizontally on the marker
        });

        userMarkers[username] = {
            marker: marker,
            overlay: overlay,
            cluster: [],
            clusterOverlay: clusterOverlay,
            clusteredBy: username,
            isCluster: false
        };
    }
}

// 두 개의 위도, 경도 간의 거리를 구하기
function haversineDistance(lat1, lon1, lat2, lon2) {
    const EARTH_RADIUS = 6371000; // 지구 반경 (미터)

    // 라디안 단위로 변환
    const toRadians = (degrees) => degrees * (Math.PI / 180);

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const rLat1 = toRadians(lat1);
    const rLat2 = toRadians(lat2);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(rLat1) * Math.cos(rLat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS * c; // 거리 반환 (미터 단위)
}

function updateUserMarkers(userLocations) {
    // 마커 최신화
    userLocations.forEach(userLocation => {
        addOrUpdateUserMarker(userLocation.username, userLocation.latitude, userLocation.longitude);
    });

    // 클러스터될 거리를 정하기
    let dist = 30;

    // 각 마커에서 서로 거리가 클러스터될 거리에 포함되는지 확인하기
    userLocations.forEach(userLocation => {
        if (userMarkers[userLocation.username].clusteredBy !== userLocation.username) {
            return;
        }
        let username = userLocation.username;
        let latlng = userMarkers[userLocation.username].marker.getPosition();

        // 클러스터 리스트 초기화
        userMarkers[username].cluster = [];

        userLocations.forEach(userLocation_sub => {
            if (userLocation_sub.username !== username &&
                userMarkers[userLocation_sub.username].clusteredBy === userLocation_sub.username &&
                !userMarkers[userLocation_sub.username].isCluster) {
                let lat = userLocation_sub.latitude;
                let lng = userLocation_sub.longitude;
                let dist_between = haversineDistance(latlng.getLat(), latlng.getLng(), lat, lng);
                // 포함되면 해당 마커 json을 리스트에 넣기
                if (dist >= dist_between) {
                    userMarkers[username].cluster.push(userMarkers[userLocation_sub.username]);
                }
            }
        });
        if (userMarkers[username].cluster.length > 0) {
            userMarkers[username].overlay.setMap(null);
            userMarkers[username].clusterOverlay.setMap(map);
            userMarkers[username].isCluster = true;
            userMarkers[username].cluster.forEach(marker => {
                marker.marker.setMap(null);
                marker.overlay.setMap(null);
                marker.clusteredBy = userLocation.username;
            });

            console.log('clustered');
        }
    });
}


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
        userMarkers[username].clusterOverlay.setMap(null); // 전체 채팅창 제거
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

async function updateUserLocation(roomId) {
    try {
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;
        if (username && socket.connected) {
            sendLocation(roomId, latitude, longitude);
        }
    } catch (error) {
        console.error('Location update error:', error);
    }
}
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation is not supported by this browser.'));
        }
        navigator.geolocation.getCurrentPosition(resolve, reject);
    });
}

setInterval(() => {
    if (!socket.connected) {
        console.log('Socket disconnected. Attempting to reconnect...');
        socket.connect();
    }
}, 5000);
