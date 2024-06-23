// main.js

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, function (match) {
        switch (match) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#039;';
            default: return match;
        }
    });
}

let socket;
let map;
let userMarkers = {};
let startMarker, endMarker;
let isAdmin = false;
let username = '';
let roomId;
let userLatitude = 0.0;
let userLongitude = 0.0;
let centerMarker = null;
let users = [];

const chat = document.getElementById('chat');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const userCount = document.getElementById('userCount');
const userList = document.getElementById('userList');
const scrollToBottomBtn = document.getElementById('scrollToBottomBtn');
const scrollToTopBtn = document.getElementById('scrollToTopBtn');

const messageQueues = {};

document.addEventListener('DOMContentLoaded', function () {
    const urlParams = new URLSearchParams(window.location.search);
    roomId = urlParams.get('roomId');

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

    fetch(`/api/messages?roomId=${roomId}`)
        .then(response => response.json())
        .then(messages => {
            messages.forEach(message => {
                addMessageToChat(message.text, message.id, message.username);
            });
            scrollToBottom();
        })
        .catch(error => console.error('Error fetching messages:', error));
    initializeNewMessageNotification();
    setScreenSize();
    window.addEventListener('resize', setScreenSize);
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
let adminStatusRequested = false;
function requestAdminStatus() {
    if (!adminStatusRequested) {
        console.log('Requesting admin status');
        socket.emit('getAdminStatus', roomId);
        handleAdminStatus(adminStatusRequested);
        // 5초 후에 다시 요청할 수 있도록 설정
        setTimeout(() => {
            adminStatusRequested = false;
        }, 1000);
    }
}
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

        kakao.maps.event.addListener(map, 'tilesloaded', function() {
            console.log("Map tiles fully loaded");
            socket.emit('requestMarkerPositions', roomId);
        });

        var mapTypeControl = new kakao.maps.MapTypeControl();
        map.addControl(mapTypeControl, kakao.maps.ControlPosition.TOPRIGHT);

        if (username) {
            addOrUpdateUserMarker(username, latitude, longitude);
        }

        setupSocketListeners(roomId);
        setInterval(() => updateUserLocation(roomId), 5000);
        requestAdminStatus();
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
        //console.log("Received user locations:", data);
        updateUserMarkers(data.userLocations);
        updateCenterMarker(data.userLocations);
        users = data.users;
        updateUserList();
    });
    socket.on('removeMarker', (data) => {
        removeUserMarker(data.username);
    });
    socket.on('message', (data) => {
        addMessageToChat(data.text, data.messageId, data.username);
    });
    socket.on('delete', (data) => {
        document.querySelectorAll(`p[data-id='${data.messageId}']`).forEach(el => el.remove());
    });
    socket.on('kicked', (data) => {
        alert(data.message);
        window.location.href = '/map.html';
    });

    // 초기 관리자 상태 요청
    socket.emit('getAdminStatus', roomId);

    socket.on('markerPositions', function(positions) {
        console.log("Received marker positions:", positions);
        if (positions.start) {
            updateMarkerPosition({type: 'start', lat: positions.start.lat, lng: positions.start.lng});
        }
        if (positions.end) {
            updateMarkerPosition({type: 'end', lat: positions.end.lat, lng: positions.end.lng});
        }
    });
    
}

function handleAdminStatus(status) {
    isAdmin = status;
    console.log("Received admin status:", status);
    if (isAdmin) {
        createAdminMarkers();
    }
}

function createAdminMarkers() {
    console.log("Creating admin markers, isAdmin:", isAdmin);
    const offset = 0.001;
    if (!map) {
        console.log("Map not initialized, waiting...");
        setTimeout(createAdminMarkers, 100);
        return;
    }
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

        kakao.maps.event.addListener(startMarker, 'dragend', function () {
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

        kakao.maps.event.addListener(endMarker, 'dragend', function () {
            emitMarkerPosition('end', endMarker.getPosition());
        });
    }

    // 초기 마커 위치 서버에 전송
    emitMarkerPosition('start', startMarker.getPosition());
    emitMarkerPosition('end', endMarker.getPosition());
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
    setMarkerDraggable();
}

setInterval(() => {
    if (socket.connected && roomId) {
        socket.emit('requestMarkerPositions', roomId);
    }
}, 10000);  // 10초마다 확인

function setMarkerDraggable() {
    if (startMarker) startMarker.setDraggable(isAdmin);
    if (endMarker) endMarker.setDraggable(isAdmin);
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

function addOrUpdateCenterMarker(position) {
    if (centerMarker) {
        centerMarker.setPosition(position);
    } else {
        const content = `
            <div class="custom-center-marker" style="left: ${position.getLng()}px; top: ${position.getLat()}px;">
                <div class="inner-circle"></div>
            </div>
        `;

        centerMarker = new kakao.maps.CustomOverlay({
            position: position,
            content: content,
            zIndex: 3
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

function sendMessage() {
    const messageId = Date.now().toString();
    var messageText = messageInput.value.trim();
    messageText = escapeHTML(messageText);
    if (messageText) {
        const messageData = {
            text: messageText,
            messageId: messageId,
            username: username,
            roomId: roomId
        };
        socket.emit('message', messageData);
        messageInput.value = '';
    }
    scrollToBottom();
}

function addMessageToChat(messageText, messageId, messageUsername) {
    const wasAtBottom = isScrolledToBottom();
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('chat-message-container');
    var icon = document.createElement('i');
    icon.classList.add('fas', 'fa-trash');

    const message = document.createElement('p');
    message.dataset.id = messageId;
    message.classList.add('chat-message', messageUsername === username ? 'self' : 'other');
    message.style.fontSize = '40px';
    if (wasAtBottom) {
        scrollToBottom();
        hideNewMessageNotification();
    } else {
        showNewMessageNotification();
    }
    const formattedMessageText = `${messageUsername}: ${messageText}`;
    message.textContent = formattedMessageText;
    setTextColor(message, messageText);

    if (messageUsername === username) {
        const deleteButton = document.createElement('button');
        deleteButton.onclick = function () {
            socket.emit('delete', message.dataset.id);
        };
        deleteButton.classList.add('delete-button');
        deleteButton.appendChild(icon);
        message.appendChild(deleteButton);
    } else {
        message.classList.add('other');
    }

    messageContainer.appendChild(message);
    chat.appendChild(messageContainer);
    if (userMarkers[messageUsername]) {
        let popupElement, queueKey;
        const isCluster = userMarkers[messageUsername].clusteredBy !== messageUsername || userMarkers[messageUsername].isCluster;

        if (isCluster) {
            let clusteredBy = userMarkers[messageUsername].clusteredBy;
            popupElement = document.getElementById(`${clusteredBy}-popup`).querySelector('.messages');
            queueKey = clusteredBy;
        } else {
            popupElement = document.getElementById(`${messageUsername}-popup`).querySelector('.messages');
            queueKey = messageUsername;
        }

        // 해당 사용자/클러스터의 메시지 큐가 없으면 생성
        if (!messageQueues[queueKey]) {
            messageQueues[queueKey] = [];
        }

        const newMessage = {
            element: document.createElement('div'),
            timestamp: Date.now()
        };
        newMessage.element.style.background = 'beige';
        newMessage.element.style.marginBottom = '5px';

        // 클러스터(단체 채팅방)인 경우에만 "이름: 채팅" 형식으로 표시
        if (isCluster) {
            newMessage.element.textContent = `${messageUsername}: ${messageText}`;
        } else {
            newMessage.element.textContent = messageText;
        }

        // 새 메시지를 큐에 추가
        messageQueues[queueKey].push(newMessage);

        // 큐에 3개 이상의 메시지가 있으면 가장 오래된 메시지 제거
        if (messageQueues[queueKey].length > 3) {
            const oldestMessage = messageQueues[queueKey].shift();
            oldestMessage.element.classList.add('fade-out');
            setTimeout(() => {
                if (oldestMessage.element.parentNode === popupElement) {
                    popupElement.removeChild(oldestMessage.element);
                }
            }, 1000); // 애니메이션 시간 (1초)
        }

        // 새 메시지를 팝업에 추가
        popupElement.appendChild(newMessage.element);

        // 5초 후 메시지 제거 타이머 설정
        setTimeout(() => {
            const index = messageQueues[queueKey].findIndex(msg => msg.timestamp === newMessage.timestamp);
            if (index !== -1) {
                messageQueues[queueKey].splice(index, 1);
                newMessage.element.classList.add('fade-out');
                setTimeout(() => {
                    if (newMessage.element.parentNode === popupElement) {
                        popupElement.removeChild(newMessage.element);
                    }
                }, 1000);
            }
        }, 10000);
    }
}

function enterkey(e) {
    if (e.keyCode === 13) {
        sendMessage();
    }
}

messageInput.addEventListener('keyup', event => enterkey(event));

function setTextColor(element, messageText) {
    const firstChar = messageText.trim().charAt(0);
    if (/[a-zA-Z]/.test(firstChar)) {
        if (firstChar.toLowerCase() == 'a') {
            element.classList.add('red');
        } else {
            element.classList.add('blue');
        }
    }
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        chat.scrollTo({
            top: chat.scrollHeight,
            behavior: 'smooth'
        });
    });
}

function scrollToTop() {
    chat.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
    handleScrollButtons(); // 스크롤 후 버튼 상태 업데이트
}

function toggleChat() {
    let chat = document.getElementsByClassName('chat-container')[0];

    if (chat.classList.contains('show')) {
        chat.classList.remove('show');
        setTimeout(() => {
            chat.style.display = 'none';
        }, 500);
    } else {
        chat.style.display = 'flex';
        setTimeout(() => {
            chat.classList.add('show');
            scrollToBottom();
        }, 10);
    }
}

function updateUserList() {
    if (users && Array.isArray(users)) {
        userCount.textContent = `Users: ${users.length}`;
        userList.innerHTML = '';
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.textContent = user;
            userItem.classList.add('user-list-item');

            // 강퇴 버튼 추가
            if (isAdmin && user !== username) { // 현재 사용자가 방 관리자일 때, 본인이 아닌 경우에만 버튼을 추가
                const kickButton = document.createElement('button');
                kickButton.textContent = 'Kick';
                kickButton.classList.add('kick-button');
                kickButton.onclick = () => kickUser(user);
                userItem.appendChild(kickButton);
            }

            userList.appendChild(userItem);
        });
    } else {
        userCount.textContent = 'Users: 0';
        userList.innerHTML = '';
    }
}

function kickUser(user) {
    socket.emit('kickUser', { roomId: roomId, username: user });
}

function toggleUserList() {
    const userListElement = document.getElementById('userList');
    if (userListElement.style.display === 'none' || userListElement.style.display === '') {
        userListElement.style.display = 'block';
    } else {
        userListElement.style.display = 'none';
    }
}

function setScreenSize() {
    let vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

function handleScrollButtons() {
    const scrollPosition = chat.scrollTop;
    const scrollHeight = chat.scrollHeight;
    const clientHeight = chat.clientHeight;

    if (scrollPosition + clientHeight >= scrollHeight - 10) {
        scrollToBottomBtn.style.display = 'none';
    } else {
        scrollToBottomBtn.style.display = 'block';
    }

    if (scrollPosition > 10) {
        scrollToTopBtn.style.display = 'block';
    } else {
        scrollToTopBtn.style.display = 'none';
    }
}

chat.addEventListener('scroll', handleScrollButtons);


let newMessageNotification = null;

function initializeNewMessageNotification() {
    newMessageNotification = document.getElementById('newMessageNotification');
    newMessageNotification.addEventListener('click', () => {
        scrollToBottom();
        hideNewMessageNotification();
    });
}


function showNewMessageNotification() {
    if (newMessageNotification) {
        newMessageNotification.style.display = 'block';
        // 페이드 인 효과
        setTimeout(() => {
            newMessageNotification.style.opacity = '1';
        }, 10);
    }
}

function hideNewMessageNotification() {
    if (newMessageNotification) {
        // 페이드 아웃 효과
        newMessageNotification.style.opacity = '0';
        setTimeout(() => {
            newMessageNotification.style.display = 'none';
        }, 300);
    }
}

function isScrolledToBottom() {
    return chat.scrollHeight - chat.clientHeight <= chat.scrollTop + 1;
}

// 사용자가 수동으로 스크롤할 때 알림 숨기기
chat.addEventListener('scroll', function () {
    if (isScrolledToBottom()) {
        hideNewMessageNotification();
    }
});

let animatedLines = [];
function calculateCenter(userLocations) {
    let x = 0, y = 0, z = 0;

    userLocations.forEach(user => {
        const lat = user.latitude * Math.PI / 180;
        const lon = user.longitude * Math.PI / 180;
        x += Math.cos(lat) * Math.cos(lon);
        y += Math.cos(lat) * Math.sin(lon);
        z += Math.sin(lat);
    });

    const total = userLocations.length;
    x = x / total;
    y = y / total;
    z = z / total;

    const centralLongitude = Math.atan2(y, x);
    const centralSquareRoot = Math.sqrt(x * x + y * y);
    const centralLatitude = Math.atan2(z, centralSquareRoot);

    return {
        latitude: centralLatitude * 180 / Math.PI,
        longitude: centralLongitude * 180 / Math.PI
    };
}
function updateCenterMarker(userLocations) {
    if (userLocations.length >= 2) {
        const center = calculateCenter(userLocations);
        centerPosition = new kakao.maps.LatLng(center.latitude, center.longitude);
        addOrUpdateCenterMarker(centerPosition);
        drawAnimatedLines(userLocations);
    } else {
        if (centerMarker) {
            centerMarker.setMap(null);
            centerMarker = null;
        }
        centerPosition = null;
        removeAnimatedLines();
    }
}

function addOrUpdateCenterMarker(position) {
    if (centerMarker) {
        centerMarker.setPosition(position);
    } else {
        const content = `
            <div class="custom-center-marker">
                <div class="inner-circle"></div>
            </div>
        `;

        centerMarker = new kakao.maps.CustomOverlay({
            position: position,
            content: content,
            zIndex: 3
        });

        centerMarker.setMap(map);
    }
}

function drawAnimatedLines(userLocations) {
    removeAnimatedLines();

    const centerPosition = centerMarker.getPosition(); // 원의 위치를 가져옴

    userLocations.forEach(user => {
        const userPoint = new kakao.maps.LatLng(user.latitude, user.longitude);
        const line = new kakao.maps.Polyline({
            path: [userPoint, centerPosition], // 선의 끝점을 원의 위치로 설정
            strokeWeight: 3,
            strokeColor: 'rgb(0, 255, 255)',
            strokeOpacity: 0.8,
            strokeStyle: 'dashed'
        });

        line.setMap(map);
        animatedLines.push(line);

        animateLine(line);
    });
}

function removeAnimatedLines() {
    animatedLines.forEach(line => line.setMap(null));
    animatedLines = [];
}

function animateLine(line) {
    let length = 0;
    const path = line.getPath();
    const totalLength = calculateDistance(path[0], path[1]);

    const animation = setInterval(() => {
        length += totalLength / 50;
        if (length >= totalLength) {
            clearInterval(animation);
            return;
        }

        const newPath = [path[0], getPointAtLength(path[0], path[1], length)];
        line.setPath(newPath);
    }, 20);
}

function calculateDistance(point1, point2) {
    const lat1 = point1.getLat(), lon1 = point1.getLng();
    const lat2 = point2.getLat(), lon2 = point2.getLng();
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

function getPointAtLength(start, end, length) {
    const totalLength = calculateDistance(start, end);
    const ratio = length / totalLength;

    const lat = start.getLat() + (end.getLat() - start.getLat()) * ratio;
    const lng = start.getLng() + (end.getLng() - start.getLng()) * ratio;

    return new kakao.maps.LatLng(lat, lng);
}