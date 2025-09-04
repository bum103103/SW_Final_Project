<template>
  <div id="main-container">
    <!-- 지도 영역 -->
    <div id="map" class="map-container" ref="mapContainer"></div>

    <!-- 메시지 입력 컨테이너 -->
    <div class="message-input-container">
      <input
        type="text"
        id="messageInput"
        v-model="newMessage"
        @keyup.enter="sendMessage"
        placeholder="메시지를 입력하세요..."
      />
      <button id="sendButton" @click="sendMessage" class="send-btn">
        📤
      </button>
      <button id="toggleChatBtn" @click="toggleChat()" class="chat-toggle-btn">
        💬
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
      userMessages: {}, // 사용자별 최근 메시지 저장
      userLatitude: 0.0,
      userLongitude: 0.0,
      locationUpdateInterval: null
    }
  },
  mounted() {
    // 사용자 정보 가져오기 (여러 방식으로 시도)
    this.username = this.getUsername()
    console.log('ChatRoom mounted with username:', this.username)
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
    // 사용자 메시지 초기화
    this.userMessages = {}
  },
  methods: { // methods를 하나로 합칩니다.
    getUsername() {
      try {
        // localStorage에서 user 정보 확인
        const userStr = localStorage.getItem('user')
        if (userStr) {
          const user = JSON.parse(userStr)
          if (user && user.username) {
            return user.username
          }
        }

        // JWT 토큰에서 사용자 정보 추출 시도
        const token = localStorage.getItem('token')
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]))
          if (payload && payload.username) {
            return payload.username
          }
        }

        // 기본값 설정
        return '사용자'
      } catch (error) {
        console.error('Error getting username:', error)
        return '사용자'
      }
    },

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

        // 지도 이벤트 리스너 추가 (오버레이 위치 업데이트)
        window.kakao.maps.event.addListener(this.map, 'dragend', () => {
          this.updateAllOverlayPositions()
        })

        window.kakao.maps.event.addListener(this.map, 'zoom_changed', () => {
          this.updateAllOverlayPositions()
        })

        // 사용자 위치 가져오기
        this.getUserLocation()
      }
    },

    updateAllOverlayPositions() {
      // 모든 사용자 마커의 오버레이 위치 업데이트
      Object.values(this.userMarkers).forEach(markerData => {
        if (markerData.overlay) {
          // 지도가 움직일 때 오버레이가 마커를 따라가도록 강제 업데이트
          const position = markerData.marker.getPosition()
          markerData.overlay.setPosition(position)
        }
      })
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
        // 위치 정보 얻기 실패 시 기본 위치 사용 (부산시청 근처)
        this.userLatitude = 35.1795543
        this.userLongitude = 129.0756416
        this.startLocationSharing() // 기본 위치라도 공유 시작
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
        // 연결되자마자 위치 정보 전송
        if(this.userLatitude !== 0.0) {
            this.sendLocationUpdate();
        }
      }

      this.socket.onmessage = (event) => {
        const data = JSON.parse(event.data)
        console.log('Received message:', data)

        if (data.type === 'chat_message') {
          this.addMessage(data.message, data.message_id || data.messageId, data.user)
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
          this.updateUserMarker(data.user, data.latitude, data.longitude)
        } else if (data.type === 'user_left') {
          this.removeUserMarker(data.user)
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

      // 사용자별 최근 메시지 저장 (최대 3개)
      if (!this.userMessages[username]) {
        this.userMessages[username] = []
      }
      this.userMessages[username].push({
        text: text,
        timestamp: new Date()
      })

      // 최근 3개 메시지만 유지
      if (this.userMessages[username].length > 3) {
        this.userMessages[username] = this.userMessages[username].slice(-3)
      }

      // 채팅 메시지 리스트에 추가
      this.messages.push({
        id: messageId,
        text: text,
        username: username,
        isMine: isMine,
        timestamp: new Date()
      })

      // 해당 사용자의 오버레이 업데이트
      this.updateUserOverlay(username)

      this.$nextTick(() => {
        if (wasAtBottom) {
          this.scrollToBottom()
          this.showNewMessageNotification = false
        } else {
          this.showNewMessageNotification = true
        }
      })
    },

    updateUserOverlay(username) {
      // 사용자 마커의 오버레이 업데이트
      if (this.userMarkers[username] && this.userMessages[username]) {
        const recentMessages = this.userMessages[username]
        const latestMessage = recentMessages[recentMessages.length - 1]

        if (latestMessage) {
          const overlay = this.userMarkers[username].overlay
          if(overlay){
              const shortMessage = latestMessage.text.length > 20
                ? latestMessage.text.substring(0, 20) + '...'
                : latestMessage.text

              const newContent = `
                <div class="user-popup">
                  <div class="leaflet-popup-content-wrapper">
                    <div class="leaflet-popup-content">
                      <strong>${username}</strong><br>
                      <small>"${shortMessage}"</small><br>
                      <small style="color: #666;">실시간 위치 공유 중</small>
                    </div>
                  </div>
                  <div class="leaflet-popup-tip-container">
                    <div class="leaflet-popup-tip"></div>
                  </div>
                </div>
              `
              overlay.setContent(newContent)
          }
        }
      }
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

        const recentMessage = this.userMessages[username] && this.userMessages[username].length > 0
          ? this.userMessages[username][this.userMessages[username].length - 1].text
          : null

        const shortMessage = recentMessage && recentMessage.length > 20
          ? recentMessage.substring(0, 20) + '...'
          : recentMessage || '메시지 없음'

        const content = `
          <div class="user-popup">
            <div class="leaflet-popup-content-wrapper">
              <div class="leaflet-popup-content">
                <strong>${username}</strong><br>
                <small>"${shortMessage}"</small><br>
                <small style="color: #666;">실시간 위치 공유 중</small>
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
          yAnchor: 1.6,
          xAnchor: 0.5
        })
        overlay.setMap(this.map)

        // 마커 클릭 이벤트 추가
        window.kakao.maps.event.addListener(marker, 'click', () => {
          this.$nextTick(() => {
            const inputElement = document.getElementById('messageInput')
            if (inputElement) {
              inputElement.focus()
              inputElement.placeholder = `${username}님에게 메시지...`
            }
          })
        })

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
  },
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

/* 메시지 입력 컨테이너 */
.message-input-container {
  position: fixed;
  bottom: 20px;
  left: 20px;
  display: flex;
  gap: 8px;
  align-items: center;
  z-index: 1000;
}

.message-input-container input {
  width: 300px;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 25px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.message-input-container input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.send-btn, .chat-toggle-btn {
  padding: 12px 20px;
  border: none;
  border-radius: 25px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.send-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  min-width: 70px;
}

.send-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.send-btn:active {
  transform: translateY(0);
}

.chat-toggle-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  transition: all 0.3s ease;
}

.chat-toggle-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(16, 185, 129, 0.4);
}

.chat-toggle-btn:active {
  transform: scale(0.95);
}

.chat-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 380px;
  height: 500px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 2000;
  opacity: 0;
  transform: translateY(20px) scale(0.95);
  transform-origin: bottom right;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  backdrop-filter: blur(10px);
}

.chat-container.show {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: white;
  border-radius: 16px 16px 0 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
  padding: 16px;
  overflow-y: auto;
  background: #f8fafc;
  border-radius: 0 0 16px 16px;
  scroll-behavior: smooth;
}

.chat-content::-webkit-scrollbar {
  width: 6px;
}

.chat-content::-webkit-scrollbar-track {
  background: transparent;
}

.chat-content::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

.chat-content::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

.chat-message-container {
  display: flex;
  margin-bottom: 12px;
  align-items: flex-start;
  position: relative;
}

.chat-message-container.self {
  justify-content: flex-end;
  flex-direction: row-reverse;
}

.chat-message {
  padding: 12px 16px;
  border-radius: 20px;
  max-width: 280px;
  word-wrap: break-word;
  font-size: 14px;
  line-height: 1.4;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: all 0.2s ease;
}

.chat-message.self {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  margin-left: auto;
  position: relative;
}

.chat-message.self::after {
  content: '';
  position: absolute;
  bottom: 12px;
  right: -8px;
  width: 0;
  height: 0;
  border-left: 8px solid #764ba2;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
}

.chat-message.other {
  background: #ffffff;
  color: #374151;
  border: 1px solid #e5e7eb;
  position: relative;
}

.chat-message.other::after {
  content: '';
  position: absolute;
  bottom: 12px;
  left: -8px;
  width: 0;
  height: 0;
  border-right: 8px solid #ffffff;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 8px solid transparent;
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
  z-index: 10; 
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
  bottom: -20px;
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
  .chat-container {
    width: 90vw;
    height: 70vh;
    bottom: 10px;
    right: 10px;
    max-width: 350px;
  }

  .chat-content {
    padding: 12px;
  }

  .chat-message {
    font-size: 15px;
    max-width: 85%;
    padding: 10px 14px;
  }

  .message-input-container {
    bottom: 10px;
    left: 10px;
    gap: 6px;
  }

  .message-input-container input {
    width: 200px;
    font-size: 16px; /* iOS에서 줌 방지 */
  }

  .send-btn, .chat-toggle-btn {
    padding: 10px 16px;
    font-size: 13px;
  }

  .chat-toggle-btn {
    width: 45px;
    height: 45px;
    font-size: 18px;
  }

  .header {
    padding: 12px 16px;
  }

  .user-count {
    font-size: 14px;
  }

  .room-info {
    font-size: 12px;
  }
}
</style>
