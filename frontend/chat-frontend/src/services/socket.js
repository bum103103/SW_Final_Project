// WebSocket service for Django Channels

class SocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
    this.currentRoom = null
    this.onMessageCallback = null
    this.onUserJoinedCallback = null
    this.onUserLeftCallback = null
    this.onLocationUpdateCallback = null
    this.onMarkerUpdateCallback = null
    this.onNewMarkerCallback = null
    this.onRemoveMarkerCallback = null
  }

  connect(roomId) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return this.socket
    }

    this.currentRoom = roomId
    const token = localStorage.getItem('token')
    const socketUrl = process.env.VUE_APP_SOCKET_URL || 'ws://localhost:8000'

    // Django Channels WebSocket URL with token
    this.socket = new WebSocket(`${socketUrl}/ws/chat/${this.currentRoom}/?token=${token}`)

    this.socket.onopen = () => {
      console.log('Connected to Django Channels')
      this.isConnected = true
    }

    this.socket.onclose = () => {
      console.log('Disconnected from Django Channels')
      this.isConnected = false
    }

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        this.handleMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    return this.socket
  }

  handleMessage(data) {
    const eventType = data.type

    switch (eventType) {
      case 'chat_message':
        if (this.onMessageCallback) {
          this.onMessageCallback(data)
        }
        break
      case 'user_joined':
        if (this.onUserJoinedCallback) {
          this.onUserJoinedCallback(data)
        }
        break
      case 'user_left':
        if (this.onUserLeftCallback) {
          this.onUserLeftCallback(data)
        }
        break
      case 'location_update':
        if (this.onLocationUpdateCallback) {
          this.onLocationUpdateCallback(data)
        }
        break
      case 'marker_update':
        if (this.onMarkerUpdateCallback) {
          this.onMarkerUpdateCallback(data)
        }
        break
      case 'new_marker':
        if (this.onNewMarkerCallback) {
          this.onNewMarkerCallback(data)
        }
        break
      case 'remove_marker':
        if (this.onRemoveMarkerCallback) {
          this.onRemoveMarkerCallback(data)
        }
        break
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.close()
      this.socket = null
      this.isConnected = false
      this.currentRoom = null
    }
  }

  sendMessage(message, username) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const messageData = {
        type: 'chat_message',
        message: message,
        user: username
      }
      this.socket.send(JSON.stringify(messageData))
    }
  }

  updateLocation(latitude, longitude) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const locationData = {
        type: 'location_update',
        latitude: latitude,
        longitude: longitude
      }
      this.socket.send(JSON.stringify(locationData))
    }
  }

  updateMarker(markerData) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const updateData = {
        type: 'marker_update',
        ...markerData
      }
      this.socket.send(JSON.stringify(updateData))
    }
  }

  // Event listeners
  onMessage(callback) {
    this.onMessageCallback = callback
  }

  onUserJoined(callback) {
    this.onUserJoinedCallback = callback
  }

  onUserLeft(callback) {
    this.onUserLeftCallback = callback
  }

  onLocationUpdate(callback) {
    this.onLocationUpdateCallback = callback
  }

  onMarkerUpdate(callback) {
    this.onMarkerUpdateCallback = callback
  }

  onNewMarker(callback) {
    this.onNewMarkerCallback = callback
  }

  onRemoveMarker(callback) {
    this.onRemoveMarkerCallback = callback
  }

  // Remove all listeners
  removeAllListeners() {
    this.onMessageCallback = null
    this.onUserJoinedCallback = null
    this.onUserLeftCallback = null
    this.onLocationUpdateCallback = null
    this.onMarkerUpdateCallback = null
    this.onNewMarkerCallback = null
    this.onRemoveMarkerCallback = null
  }
}

export default new SocketService()
