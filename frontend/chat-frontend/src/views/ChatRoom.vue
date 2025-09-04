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
      isChatBlocked: false
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
      // 간단하게 기본 위치만 설정
      this.userLatitude = 35.1152
      this.userLongitude = 128.9684
      console.log('User location set to default')
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
          // 사용자 입장 메시지 처리
          this.addMessage(data.message, Date.now().toString(), 'System')
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

    // 간소화된 사용자 관리
    updateUserMarkers(userLocations) {
      // 간단하게 사용자 수만 업데이트
      if (userLocations && Array.isArray(userLocations)) {
        this.users = userLocations.map(user => user.username || user)
      }
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
