import axios from 'axios'

// Django backend URL
const API_BASE_URL = process.env.VUE_APP_API_URL || 'http://localhost:8000/api'

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default {
  // Authentication
  login(credentials) {
    return api.post('/auth/login/', credentials)
  },

  register(userData) {
    return api.post('/auth/register/', userData)
  },

  // Markers
  getMarkers(type) {
    return api.get(`/chat/markers/?type=${type}`)
  },

  createMarker(markerData) {
    return api.post('/chat/markers/', markerData)
  },

  updateMarker(markerId, markerData) {
    return api.put(`/chat/markers/${markerId}/`, markerData)
  },

  deleteMarker(markerId) {
    return api.delete(`/chat/markers/${markerId}/`)
  },

  // Messages
  getMessages(roomId) {
    return api.get(`/chat/messages/?room_id=${roomId}`)
  },

  sendMessage(messageData) {
    return api.post('/chat/messages/', messageData)
  },

  // User management
  getUserProfile() {
    return api.get('/auth/profile/')
  },

  updateUserProfile(userData) {
    return api.put('/auth/profile/', userData)
  }
}
