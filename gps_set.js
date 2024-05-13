// gps 관련 js 파일, index.html에서 이 스크립트를 가장 먼저 불러오기

// 함수 모음
// 현재 웹사이트에 접속 중인 사용자의 위경도 값을 가져오는 함수
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

// 사용자 위치 정보.
let userLatitude = 0.0;
let userLongitude = 0.0;   
let map;
let userMarker;

// 사용자 위치 정보 초기화 및 지도 설정
function initializeMap() {
    getUserGeoData()
        .then(([latitude, longitude]) => {
            userLatitude = latitude;
            userLongitude = longitude;
            console.log(`Initial Latitude: ${userLatitude}, Longitude: ${userLongitude}`);
            
            // 지도 초기화
            map = L.map('map').setView([userLatitude, userLongitude], 13);    
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            }).addTo(map);

            // 사용자 마커 추가
            userMarker = L.marker([userLatitude, userLongitude]).addTo(map);
            userMarker.bindPopup(`${username}'s location!`).openPopup();

            // 5초마다 위치 업데이트
            setInterval(updateUserLocation, 5000);
        })
        .catch((error) => {
            console.error(error);
        });
}

// WebSocket 연결 초기화
var socket = new WebSocket('ws://localhost:8080');

socket.onopen = function() {
    console.log('WebSocket 연결 성공');
};

socket.onerror = function(error) {
    console.log('WebSocket 에러:', error);
};

socket.onclose = function() {
    console.log('WebSocket 연결 종료');
};

function sendLocation(latitude, longitude) {
    if (socket.readyState === WebSocket.OPEN) {
        const message = JSON.stringify({
            action: 'updateLocation',
            username: 'currentUsername', // 실제 사용자 이름을 적절하게 설정
            latitude: latitude,
            longitude: longitude
        });
        map.setView([latitude, longitude], map.getZoom());
            userMarker.setLatLng([latitude, longitude]);
            userMarker.bindPopup(`${username}'s location!`).openPopup();
        socket.send(message);
        console.log('위치 데이터 전송:', message);
    } else {
        console.log("WebSocket이 열려있지 않습니다.");
    }
}

// 사용자 위치 업데이트 함수
function updateUserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            sendLocation(latitude, longitude);  // 서버로 위치 데이터 전송
        }, error => {
            console.error('위치 정보 에러:', error);
        });
        // 지도 중심 업데이트
        
    } else {
        console.error('이 브라우저에서는 위치 정보를 지원하지 않습니다.');
    }
}





// 초기화 함수 호출
initializeMap();
