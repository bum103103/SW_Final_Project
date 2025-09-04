<template>
  <div class="chat-container">
    <!-- Chat Header -->
    <div class="chat-header">
      <div class="room-info">
        <h3>채팅방</h3>
        <span class="user-count">접속자: {{ userCount }}</span>
      </div>
      <button @click="$emit('close')" class="close-btn">×</button>
    </div>

    <!-- Messages Area -->
    <div class="messages-area" ref="messagesArea">
      <div
        v-for="message in messages"
        :key="message.id"
        class="message"
        :class="{ 'own-message': message.username === currentUser.username }"
      >
        <div class="message-header">
          <span class="username">{{ message.username }}</span>
          <span class="timestamp">{{ formatTime(message.timestamp) }}</span>
        </div>
        <div class="message-content">{{ message.text }}</div>
      </div>
    </div>

    <!-- User List Toggle -->
    <div class="user-list-toggle">
      <button @click="toggleUserList" class="toggle-btn">
        접속자 목록 {{ showUserList ? '▼' : '▶' }}
      </button>
    </div>

    <!-- User List -->
    <div v-if="showUserList" class="user-list">
      <h4>접속자 목록</h4>
      <div class="user-item" v-for="user in users" :key="user">
        {{ user }}
        <button
          v-if="isAdmin && user !== currentUser.username"
          @click="kickUser(user)"
          class="kick-btn"
        >
          추방
        </button>
      </div>
    </div>

    <!-- Message Input -->
    <div class="message-input-area">
      <form @submit.prevent="sendMessage" class="message-form">
        <input
          type="text"
          v-model="newMessage"
          placeholder="메시지를 입력하세요..."
          :disabled="!isConnected"
          class="message-input"
        />
        <button type="submit" :disabled="!newMessage.trim() || !isConnected" class="send-btn">
          전송
        </button>
      </form>
    </div>

    <!-- Connection Status -->
    <div v-if="!isConnected" class="connection-status">
      서버에 연결되지 않았습니다...
    </div>
  </div>
</template>

<script>
import socketService from '@/services/socket'

export default {
  name: 'ChatComponent',
  props: {
    roomId: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      messages: [],
      newMessage: '',
      users: [],
      userCount: 0,
      showUserList: false,
      isConnected: false,
      currentUser: {},
      isAdmin: false
    }
  },
  mounted() {
    this.currentUser = JSON.parse(localStorage.getItem('user') || '{}')
    
    // roomId 유효성 검사
    if (!this.roomId || this.roomId === 'null') {
      console.error('Invalid room ID:', this.roomId)
      this.error = '유효하지 않은 채팅방 ID입니다.'
      return
    }
    
    this.connectToRoom()
  },
  beforeUnmount() {
    socketService.disconnect()
  },
  methods: {
    connectToRoom() {
      socketService.connect(this.roomId)

      // 메시지 이벤트 리스너
      socketService.onMessage((data) => {
        this.messages.push({
          id: data.message_id,
          username: data.user,
          text: data.message,
          timestamp: data.timestamp
        })
        this.scrollToBottom()
      })

      // 사용자 입장 이벤트 리스너
      socketService.onUserJoined((data) => {
        this.userCount++
        if (!this.users.includes(data.user)) {
          this.users.push(data.user)
        }
      })

      // 사용자 퇴장 이벤트 리스너
      socketService.onUserLeft((data) => {
        this.userCount--
        this.users = this.users.filter(user => user !== data.user)
      })

      this.isConnected = true
    },

    disconnectFromRoom() {
      socketService.removeAllListeners()
      socketService.leaveRoom()
    },

    async loadMessages() {
      try {
        // API를 통해 기존 메시지 로드
        const response = await fetch(`http://localhost:8000/api/chat/messages/?room_id=${this.roomId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        const data = await response.json()
        this.messages = data.map(msg => ({
          id: msg.id,
          username: msg.username,
          text: msg.text,
          timestamp: msg.timestamp
        }))
        this.$nextTick(() => {
          this.scrollToBottom()
        })
      } catch (error) {
        console.error('Failed to load messages:', error)
      }
    },

    async loadRoomInfo() {
      try {
        const response = await fetch(`http://localhost:8000/api/chat/rooms/${this.roomId}/info/`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        const data = await response.json()
        this.users = data.users || []
        this.userCount = data.user_count || 0
      } catch (error) {
        console.error('Failed to load room info:', error)
      }
    },

    sendMessage() {
      if (!this.newMessage.trim() || !this.isConnected) return

      // WebSocket으로 메시지 전송
      socketService.sendMessage(this.newMessage.trim(), this.currentUser.username)

      // 입력 필드 초기화
      this.newMessage = ''
    },

    toggleUserList() {
      this.showUserList = !this.showUserList
    },

    kickUser(username) {
      // 관리자만 사용자 추방 가능
      if (this.isAdmin && username !== this.currentUser.username) {
        // 추방 로직 구현
        console.log(`Kicking user: ${username}`)
      }
    },

    scrollToBottom() {
      this.$nextTick(() => {
        if (this.$refs.messagesArea) {
          this.$refs.messagesArea.scrollTop = this.$refs.messagesArea.scrollHeight
        }
      })
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
}
</script>

<style scoped>
.chat-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
}

.chat-header {
  background: #007bff;
  color: white;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-info h3 {
  margin: 0;
  font-size: 1.2rem;
}

.user-count {
  font-size: 0.9rem;
  opacity: 0.8;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.message {
  max-width: 80%;
  padding: 0.75rem;
  border-radius: 10px;
  background: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.own-message {
  align-self: flex-end;
  background: #007bff;
  color: white;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.25rem;
  font-size: 0.8rem;
}

.username {
  font-weight: bold;
}

.timestamp {
  opacity: 0.7;
}

.message-content {
  word-wrap: break-word;
}

.user-list-toggle {
  border-top: 1px solid #dee2e6;
  background: white;
}

.toggle-btn {
  width: 100%;
  padding: 0.75rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-weight: 500;
}

.user-list {
  border-top: 1px solid #dee2e6;
  padding: 1rem;
  background: white;
  max-height: 200px;
  overflow-y: auto;
}

.user-list h4 {
  margin: 0 0 1rem 0;
  font-size: 1rem;
}

.user-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #f8f9fa;
}

.kick-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 0.25rem 0.5rem;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8rem;
}

.message-input-area {
  border-top: 1px solid #dee2e6;
  padding: 1rem;
  background: white;
}

.message-form {
  display: flex;
  gap: 0.5rem;
}

.message-input {
  flex: 1;
  padding: 0.75rem;
  border: 1px solid #dee2e6;
  border-radius: 5px;
  font-size: 1rem;
}

.message-input:focus {
  outline: none;
  border-color: #007bff;
}

.send-btn {
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: 500;
}

.send-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.connection-status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.9);
  padding: 1rem;
  border-radius: 5px;
  color: #dc3545;
  font-weight: 500;
}
</style>
