<template>
  <div id="main-container">
    <!-- 지도 영역 -->
    <div id="map" class="map-container" ref="mapContainer"></div>

    <!-- 채팅 토글 버튼 -->
    <div class="input-container">
      <button id="toggleChatBtn" @click="toggleChat()" class="chat-toggle-btn">
        💬
      </button>
      <input
        type="text"
        id="messageInput"
        v-model="newMessage"
        @keyup.enter="sendMessage"
        placeholder="메시지를 입력하세요..."
      />
      <button id="sendButton" @click="sendMessage" class="send-btn">
        전송
      </button>
    </div>

    <!-- 채팅 컨테이너 -->
    <div class="chat-container" :class="{ show: chatVisible }">
      <div class="header">
        <div class="user-count">채팅방: {{ roomId }}</div>
        <div class="room-info">
          <span>참여자: {{ users.length }}</span>
        </div>
      </div>

      <div id="chat" class="chat-content" ref="chatContainer">
        <div
          v-for="message in messages"
          :key="message.id"
          :class="['chat-message-container', message.isMine ? 'self' : 'other']"
        >
          <div class="chat-message" :class="{ self: message.isMine, other: !message.isMine }">
            <strong>{{ message.username }}</strong>: {{ message.text }}
          </div>
          <button
            v-if="message.isMine"
            @click="deleteMessage(message.id)"
            class="delete-button"
          >
            🗑️
          </button>
        </div>
      </div>

    </div>

    <!-- 맵으로 돌아가기 버튼 -->
    <button @click="$router.push('/map')" class="back-to-map-btn">
      🗺️ 지도로 돌아가기
    </button>
  </div>
</template>

<script>
// HTML 이스케이프 함수
function escapeHTML(str) {
  if (!str) return ''
  return str.replace(/[&<>"']/g, function(match) {
    switch (match) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#039;'
      default: return match
    }
  })
}

export default {
  name: 'ChatRoom',
  props: ['roomId'],
  data() {
    return {
      socket: null,
      map: null,
      username: '',
      newMessage: '',
      messages: [],
      users: [],
      chatVisible: false,
      showNewMessageNotification: false,
      isAtBottom: true,
      messageCount: 0,
      lastMessageTime: 0,
      isChatBlocked: false,
      userMarkers: {}, // 사용자 위치 마커들
      userLatitude: 0.0,
      userLongitude: 0.0,
      locationUpdateInterval: null
    }
  },
  mounted() {
    this.username = localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')).username : ''
    this.loadKakaoMaps()
  },
  beforeUnmount() {
    if (this.socket) {
      this.socket.close()
    }
    if (this.locationUpdateInterval) {
      clearInterval(this.locationUpdateInterval)
    }
    // 모든 사용자 마커 제거
    this.clearAllUserMarkers()
  },
  methods: {
    loadKakaoMaps() {
      console.log('loadKakaoMaps called')
      if (window.kakao && window.kakao.maps) {
        this.initializeMap()
        this.connectSocket()
        this.setupScrollListener()
      } else {
        if (!document.querySelector('script[src*="dapi.kakao.com"]')) {
          const script = document.createElement('script')
          script.src = '//dapi.kakao.com/v2/maps/sdk.js?appkey=22c293b2277db520a282856b10771470'
          script.onload = () => {
            this.initializeMap()
            this.connectSocket()
            this.setupScrollListener()
          }
          document.head.appendChild(script)
        }
      }
    },

    async initializeMap() {
      // Kakao Maps 초기화
      if (window.kakao && window.kakao.maps) {
        const container = this.$refs.mapContainer
        const options = {
          center: new window.kakao.maps.LatLng(35.1152, 128.9684),
          level: 2
        }
        this.map = new window.kakao.maps.Map(container, options)

        // 사용자 위치 가져오기
        this.getUserLocation()
      }
    },

    async getUserLocation() {
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          })
        })

        this.userLatitude = position.coords.latitude
        this.userLongitude = position.coords.longitude

        // 실시간 위치 공유 시작
        this.startLocationSharing()

        console.log('User location obtained:', this.userLatitude, this.userLongitude)
      } catch (error) {
        console.error('Error getting location:', error)
        // 위치 정보 얻기 실패 시 기본 위치 사용
        this.userLatitude = 35.1152
        this.userLongitude = 128.9684
      }
    },

    startLocationSharing() {
      // 10초마다 위치 업데이트
      this.locationUpdateInterval = setInterval(() => {
        this.updateUserLocation()
      }, 10000)

      // 초기 위치 전송
      this.sendLocationUpdate()
    },

    updateUserLocation() {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLat = position.coords.latitude
          const newLng = position.coords.longitude

          // 위치가 크게 변경되었을 때만 업데이트
          const distance = this.calculateDistance(
            this.userLatitude, this.userLongitude,
            newLat, newLng
          )

          if (distance > 10) { // 10미터 이상 이동 시
            this.userLatitude = newLat
            this.userLongitude = newLng
            this.sendLocationUpdate()
          }
        },
        (error) => console.error('Location update error:', error),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
      )
    },

    sendLocationUpdate() {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        const locationData = {
          type: 'location_update',
          room_id: this.roomId,
          username: this.username,
          latitude: this.userLatitude,
          longitude: this.userLongitude
        }
        this.socket.send(JSON.stringify(locationData))
      }
    },

    calculateDistance(lat1, lng1, lat2, lng2) {
      // 간단한 거리 계산 (미터 단위)
      const R = 6371e3 // 지구 반지름 (미터)
      const φ1 = lat1 * Math.PI / 180
      const φ2 = lat2 * Math.PI / 180
      const Δφ = (lat2 - lat1) * Math.PI / 180
      const Δλ = (lng2 - lng1) * Math.PI / 180

      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

      return R * c
    },

    connectSocket() {
      // Django Channels WebSocket 연결
      const token = localStorage.getItem('token')
      const wsUrl = `ws://localhost:8000/ws/chat/${this.roomId}/?token=${token}`

      this.socket = new WebSocket(wsUrl)

      this.socket.onopen = () => {
        console.log('WebSocket connected')
      }

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log('Received message:', data)

        if (data.type === 'chat_message') {
          this.addMessage(data.message, data.message_id || data.messageId, data.username)
        } else if (data.type === 'message_deleted') {
          this.messages = this.messages.filter(msg => msg.id !== (data.message_id || data.messageId))
        } else if (data.type === 'user_joined') {
          this.addMessage(data.message, Date.now().toString(), 'System')
        } else if (data.type === 'updateUserLocations') {
          // 실시간 사용자 위치 업데이트
          this.updateUserMarkers(data.userLocations)
          this.users = data.users || []
        } else if (data.type === 'location_update') {
          // 개별 사용자 위치 업데이트
          this.updateUserMarker(data.username, data.latitude, data.longitude)
        } else if (data.type === 'user_left') {
          this.removeUserMarker(data.username)
        }
      }

      this.socket.onclose = () => {
        console.log('WebSocket disconnected')
      }

      this.socket.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    },

    sendMessage() {
      if (this.isChatBlocked || !this.newMessage.trim()) return

      const currentTime = Date.now()
      if (currentTime - this.lastMessageTime > 5000) {
        this.messageCount = 0
      }

      this.messageCount++
      this.lastMessageTime = currentTime

      if (this.messageCount > 5) {
        this.blockChat()
        return
      }

      const messageId = Date.now().toString()
      const messageData = {
        type: 'chat_message',
        message: escapeHTML(this.newMessage.trim()),
        message_id: messageId,
        username: this.username,
        room_id: this.roomId
      }

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(messageData))
        this.newMessage = ''
      } else {
        console.error('WebSocket is not connected')
      }
    },

    addMessage(text, messageId, username) {
      const wasAtBottom = this.isAtBottom
      const isMine = username === this.username

      this.messages.push({
        id: messageId,
        text: text,
        username: username,
        isMine: isMine,
        timestamp: new Date()
      })

      this.$nextTick(() => {
        if (wasAtBottom) {
          this.scrollToBottom()
          this.showNewMessageNotification = false
        } else {
          this.showNewMessageNotification = true
        }
      })
    },

    deleteMessage(messageId) {
      const deleteData = {
        type: 'delete_message',
        message_id: messageId,
        room_id: this.roomId
      }

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify(deleteData))
      }
    },

    toggleChat() {
      this.chatVisible = !this.chatVisible
      if (this.chatVisible) {
        this.$nextTick(() => {
          this.scrollToBottom()
        })
      }
    },

    // 사용자 마커 관리
    updateUserMarkers(userLocations) {
      if (!userLocations || !Array.isArray(userLocations)) return

      // 기존 마커들 업데이트 또는 새로 생성
      userLocations.forEach(user => {
        if (user.username !== this.username) {
          this.addOrUpdateUserMarker(user.username, user.latitude, user.longitude)
        }
      })

      // 사라진 사용자 마커 제거
      const currentUsernames = userLocations.map(user => user.username)
      Object.keys(this.userMarkers).forEach(username => {
        if (!currentUsernames.includes(username)) {
          this.removeUserMarker(username)
        }
      })

      this.users = userLocations.map(user => user.username || user)
    },

    addOrUpdateUserMarker(username, latitude, longitude) {
      if (!this.map) return

      const position = new window.kakao.maps.LatLng(latitude, longitude)

      if (this.userMarkers[username]) {
        // 기존 마커 업데이트
        const markerData = this.userMarkers[username]
        markerData.marker.setPosition(position)
        if (markerData.overlay) {
          markerData.overlay.setPosition(position)
        }
        console.log(`Updated marker for ${username}`)
      } else {
        // 새 마커 생성
        const marker = new window.kakao.maps.Marker({
          position: position,
          map: this.map,
          image: new window.kakao.maps.MarkerImage(
            '/images/person_marker.png', // 사용자용 마커 이미지
            new window.kakao.maps.Size(30, 30),
            { offset: new window.kakao.maps.Point(15, 30) }
          )
        })

        // 사용자 정보 오버레이 생성 (원본 스타일)
        const content = `
          <div class="user-popup">
            <div class="leaflet-popup-content-wrapper">
              <div class="leaflet-popup-content">
                <strong>${username}</strong><br>
                <small>실시간 위치 공유 중</small>
              </div>
            </div>
            <div class="leaflet-popup-tip-container">
              <div class="leaflet-popup-tip"></div>
            </div>
          </div>
        `

        const overlay = new window.kakao.maps.CustomOverlay({
          position: position,
          content: content,
          yAnchor: 0.6,
          xAnchor: 0.5
        })
        overlay.setMap(this.map)

        this.userMarkers[username] = { marker, overlay }
        console.log(`Created new marker for ${username}`)
      }
    },

    updateUserMarker(username, latitude, longitude) {
      this.addOrUpdateUserMarker(username, latitude, longitude)
    },

    removeUserMarker(username) {
      if (this.userMarkers[username]) {
        const markerData = this.userMarkers[username]
        if (markerData.marker) {
          markerData.marker.setMap(null)
        }
        if (markerData.overlay) {
          markerData.overlay.setMap(null)
        }
        delete this.userMarkers[username]
        console.log(`Removed marker for ${username}`)
      }
    },

    clearAllUserMarkers() {
      Object.values(this.userMarkers).forEach(markerData => {
        if (markerData.marker) markerData.marker.setMap(null)
        if (markerData.overlay) markerData.overlay.setMap(null)
      })
      this.userMarkers = {}
    },

    scrollToBottom() {
      if (this.$refs.chatContainer) {
        this.$refs.chatContainer.scrollTop = this.$refs.chatContainer.scrollHeight
      }
      this.showNewMessageNotification = false
    },

    scrollToTop() {
      if (this.$refs.chatContainer) {
        this.$refs.chatContainer.scrollTop = 0
      }
    },

    setupScrollListener() {
      if (this.$refs.chatContainer) {
        this.$refs.chatContainer.addEventListener('scroll', () => {
          const container = this.$refs.chatContainer
          this.isAtBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 10
          this.isAtTop = container.scrollTop === 0
        })
      }
    },

    blockChat() {
      this.isChatBlocked = true
      alert('과도한 메시지로 인해 채팅이 일시적으로 차단되었습니다.')
      setTimeout(() => {
        this.isChatBlocked = false
        this.messageCount = 0
      }, 30000)
    }
  }
}
</script>

<style scoped>
/* 기존 Map.vue의 스타일들을 참고해서 적용 */
.map-container {
  height: 100vh;
  width: 100%;
}

.input-container {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  background: rgba(255, 255, 255, 0.9);
  padding: 10px 20px;
  border-radius: 25px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
}

#messageInput {
  flex: 1;
  padding: 10px 15px;
  border: 1px solid #ddd;
  border-radius: 20px;
  outline: none;
  font-size: 14px;
}

#messageInput:focus {
  border-color: #007bff;
}

.send-btn, .chat-toggle-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.send-btn {
  background: #007bff;
  color: white;
}

.send-btn:hover {
  background: #0056b3;
}

.chat-toggle-btn {
  background: #28a745;
  color: white;
}

.chat-toggle-btn:hover {
  background: #218838;
}

.chat-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: rgba(0, 0, 0, 0.8);
  z-index: 2000;
  opacity: 0;
  transform: scale(0.5);
  transform-origin: bottom left;
  transition: all 0.3s ease;
}

.chat-container.show {
  opacity: 1;
  transform: scale(1);
}

.header {
  background-color: #343a40;
  padding: 15px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  border-radius: 10px 10px 0 0;
}

.user-count {
  font-weight: bold;
  font-size: 16px;
}

.room-info {
  font-size: 14px;
  opacity: 0.9;
}

.chat-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background: rgba(255, 255, 255, 0.9);
}

.chat-message-container {
  display: flex;
  margin-bottom: 10px;
  align-items: flex-start;
}

.chat-message-container.self {
  justify-content: flex-end;
}

.chat-message {
  padding: 10px 15px;
  border-radius: 18px;
  max-width: 70%;
  word-wrap: break-word;
  font-size: 14px;
  line-height: 1.4;
}

.chat-message.self {
  background-color: #007bff;
  color: white;
  margin-left: auto;
}

.chat-message.other {
  background-color: #f1f1f1;
  color: #333;
}

.delete-button {
  margin-left: 8px;
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 12px;
  align-self: center;
}


.back-to-map-btn {
  position: fixed;
  top: 20px;
  left: 20px;
  background: #28a745;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 25px;
  cursor: pointer;
  font-size: 14px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.2);
  z-index: 1000;
}

.back-to-map-btn:hover {
  background: #218838;
}

/* 사용자 위치 마커 오버레이 스타일 (Kakao Maps 동적 요소용 :deep() 적용) */
:deep(.user-popup) {
  position: absolute;
  bottom: 40px;
  border-radius: 12px;
  background: white;
  box-shadow: 0 3px 14px rgba(0,0,0,0.2);
  width: 150px;
  font-size: 12px;
}

:deep(.user-popup .leaflet-popup-content-wrapper) {
  padding: 1px;
  text-align: center;
  border-radius: 12px;
  background: white;
  box-shadow: 0 3px 14px rgba(0,0,0,0.2);
  width: 150px;
  height: auto;
  min-height: 40px;
}

:deep(.user-popup .leaflet-popup-content) {
  margin: 8px;
  line-height: 1.4;
  word-wrap: break-word;
  white-space: normal;
}

:deep(.user-popup .leaflet-popup-tip-container) {
  width: 20px;
  height: 20px;
  position: absolute;
  pointer-events: none;
  left: 50%;
  margin-left: -10px;
  overflow: hidden;
  bottom: -12px;
}

:deep(.user-popup .leaflet-popup-tip) {
  width: 14px;
  height: 14px;
  background: white;
  transform: rotate(45deg);
  margin: -7px auto 0;
  box-shadow: 0 3px 14px rgba(0,0,0,0.2);
}

/* 모바일 반응형 */
@media (max-width: 768px) {
  .input-container {
    bottom: 10px;
    padding: 8px 15px;
  }

  #messageInput {
    font-size: 16px; /* iOS에서 줌 방지 */
  }

  .chat-content {
    padding: 15px;
  }

  .chat-message {
    font-size: 16px;
    max-width: 80%;
  }
}
</style>
