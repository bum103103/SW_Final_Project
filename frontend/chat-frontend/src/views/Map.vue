<template>
  <div class="map-container">
    <!-- Header -->
    <header class="map-header">
      <div class="user-info">
        <span>안녕하세요, {{ user.username }}님!</span>
        <button @click="logout" class="logout-btn">로그아웃</button>
      </div>
    </header>

    <!-- Map -->
    <div id="map" class="map"></div>

    <!-- Controls -->
    <div class="map-controls">
      <div class="control-buttons">
        <button @click="toggleChat" class="chat-toggle-btn">
          채팅 {{ chatVisible ? '숨기기' : '보기' }}
        </button>
        <button @click="createMarker" class="create-marker-btn">
          마커 생성
        </button>
      </div>

      <!-- Marker Type Filter -->
      <div class="marker-filter">
        <select v-model="selectedMarkerType" @change="filterMarkers">
          <option value="">모든 마커</option>
          <option value="restaurant">음식점</option>
          <option value="study">스터디룸</option>
          <option value="person">사람</option>
          <option value="taxi">택시</option>
          <option value="school">학교</option>
          <option value="library">도서관</option>
          <option value="meet">미팅</option>
        </select>
      </div>
    </div>

    <!-- Chat Panel (when visible) -->
    <div v-if="chatVisible" class="chat-panel">
      <Chat :room-id="currentRoomId" @close="toggleChat" />
    </div>

    <!-- Marker Creation Modal -->
    <div v-if="showMarkerModal" class="modal-overlay" @click="closeMarkerModal">
      <div class="modal-content" @click.stop>
        <h3>마커 생성</h3>
        <form @submit.prevent="submitMarker">
          <div class="form-group">
            <label>제목</label>
            <input v-model="markerForm.title" required />
          </div>
          <div class="form-group">
            <label>내용</label>
            <textarea v-model="markerForm.context" required></textarea>
          </div>
          <div class="form-group">
            <label>최대 인원</label>
            <input type="number" v-model="markerForm.max_number" min="1" required />
          </div>
          <div class="form-group">
            <label>타입</label>
            <select v-model="markerForm.type" required>
              <option value="restaurant">음식점</option>
              <option value="study">스터디룸</option>
              <option value="person">사람</option>
              <option value="taxi">택시</option>
              <option value="school">학교</option>
              <option value="library">도서관</option>
              <option value="meet">미팅</option>
            </select>
          </div>
          <div class="modal-buttons">
            <button type="button" @click="closeMarkerModal">취소</button>
            <button type="submit">생성</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import Chat from '@/components/Chat.vue'
import api from '@/services/api'

export default {
  name: 'MapView',
  components: {
    Chat
  },
  data() {
    return {
      map: null,
      markers: [],
      user: {},
      chatVisible: false,
      currentRoomId: null,
      selectedMarkerType: '',
      showMarkerModal: false,
      expandedOverlayId: null,
      markerForm: {
        title: '',
        context: '',
        max_number: 1,
        type: 'meet'
      }
    }
  },
  mounted() {
    this.user = JSON.parse(localStorage.getItem('user') || '{}')
    this.initMap()
    this.loadMarkers()
  },
  beforeUnmount() {
    // Chat 컴포넌트에서 socket을 관리하므로 여기서는 연결 해제하지 않음
  },
  methods: {
    initMap() {
      // Kakao 지도 초기화
      if (window.kakao && window.kakao.maps) {
        const container = document.getElementById('map')
        const options = {
          center: new window.kakao.maps.LatLng(37.566826, 126.9786567),
          level: 3
        }
        this.map = new window.kakao.maps.Map(container, options)
      }
    },

    async loadMarkers() {
      try {
        const response = await api.getMarkers('')
        this.markers = response.data
        this.displayMarkers()
      } catch (error) {
        console.error('Failed to load markers:', error)
      }
    },

    displayMarkers() {
      // 기존 마커 제거
      this.markers.forEach(marker => {
        if (marker.mapMarker) {
          marker.mapMarker.setMap(null)
        }
        if (marker.overlay) {
          marker.overlay.setMap(null)
        }
      })

      // 새로운 마커 표시
      this.markers.forEach(marker => {
        if (!this.selectedMarkerType || marker.type === this.selectedMarkerType) {
          const position = new window.kakao.maps.LatLng(marker.latitude, marker.longitude)

          // 타입별 마커 아이콘 적용
          const imageSize = new window.kakao.maps.Size(36, 36)
          const markerImage = new window.kakao.maps.MarkerImage(this.getMarkerImage(marker.type), imageSize)

          const mapMarker = new window.kakao.maps.Marker({
            position: position,
            image: markerImage,
            map: this.map
          })

          // 커스텀 오버레이 생성 (원본 스타일 참고)
          const content = document.createElement('div')
          content.className = 'customoverlay'
          content.id = `overlay_${marker.id}` // ID 추가
          const safeText = (marker.context || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          const isOwner = marker.created_by_username === this.user.username
          const userCount = marker.user_count || 0
          const maxNumber = marker.max_number || 0
          const isFull = userCount >= maxNumber
          const countColor = isFull ? 'red' : 'black'
          const buttonText = isFull ? '참여 불가' : '참여하기'
          const countText = `${userCount}/${maxNumber}`

          content.innerHTML = `
            <span class="count" style="color: ${countColor};">${countText}</span>
            <a href="javascript:void(0);" class="overlay-link">
              <span class="title">${marker.title}</span>
              <div class="details">
                <p>모임: ${marker.title}</p>
                <p>세부내용: ${safeText}</p>
                <p></p>
                <button class="btn-share" onclick="event.stopPropagation(); this.closest('.customoverlay').querySelector('.overlay-link').dispatchEvent(new Event('joinClick'));">${buttonText}</button>
                ${isOwner ? `<button class="btn-delete" onclick="event.stopPropagation(); this.closest('.customoverlay').querySelector('.overlay-link').dispatchEvent(new Event('deleteClick'));">삭제</button>` : ''}
              </div>
            </a>
          `

          const overlay = new window.kakao.maps.CustomOverlay({
            content,
            position: position,
            yAnchor: 1.1
          })

          // 오버레이를 지도에 수동으로 추가
          overlay.setMap(this.map)
          console.log('Overlay created and added to map for marker:', marker.id)

          // DOM에 추가될 때까지 기다렸다가 이벤트 리스너 연결
          const attachEventListeners = () => {
            const overlayElement = document.getElementById(`overlay_${marker.id}`)
            if (overlayElement) {
              console.log('Found overlay element:', overlayElement)
              const overlayLink = overlayElement.querySelector('.overlay-link')

              if (overlayLink) {
                // 마우스 오버/아웃 이벤트 (PC) - overlayLink에만 적용
                overlayLink.addEventListener('mouseenter', (e) => {
                  e.stopPropagation()
                  console.log('Mouse enter overlay link for marker:', marker.id)
                  this.expandOverlay(marker)
                })

                overlayLink.addEventListener('mouseleave', (e) => {
                  e.stopPropagation()
                  console.log('Mouse leave overlay link for marker:', marker.id)
                  // 약간의 지연을 주어 다른 요소로의 이동을 감지
                  setTimeout(() => {
                    this.collapseOverlay(marker.id)
                  }, 50)
                })

                // 참여 버튼 이벤트
                const joinBtn = overlayElement.querySelector('.btn-share')
                if (joinBtn) {
                  joinBtn.addEventListener('click', (e) => {
                    e.stopPropagation()
                    console.log('Join button clicked for marker:', marker.id)
                    this.joinRoom(marker.id)
                  })
                }

                // 삭제 버튼 이벤트 (작성자만)
                if (isOwner) {
                  const deleteBtn = overlayElement.querySelector('.btn-delete')
                  if (deleteBtn) {
                    deleteBtn.addEventListener('click', async (e) => {
                      e.stopPropagation()
                      if (marker.deleting) return
                      marker.deleting = true
                      deleteBtn.disabled = true
                      console.log('Delete button clicked for marker:', marker.id)

                      try {
                        if (marker.overlay) marker.overlay.setMap(null)
                        if (marker.mapMarker) marker.mapMarker.setMap(null)
                        this.markers = this.markers.filter(m => m.id !== marker.id)
                        await api.deleteMarker(marker.id)
                      } catch (err) {
                        if (!(err?.response?.status === 404)) {
                          console.error('Failed to delete marker', err)
                        }
                      } finally {
                        this.loadMarkers()
                      }
                    })
                  }
                }
              } else {
                console.log('Overlay link not found')
              }
            } else {
              console.log('Overlay element not found for marker:', marker.id)
            }
          }

          // DOM에 추가될 때까지 여러 번 시도
          let attempts = 0
          const maxAttempts = 10
          const tryAttach = () => {
            attempts++
            const overlayElement = document.getElementById(`overlay_${marker.id}`)
            if (overlayElement && overlayElement.offsetParent !== null) {
              // 요소가 실제로 표시되고 있을 때만 이벤트 리스너 연결
              attachEventListeners()
            } else if (attempts < maxAttempts) {
              setTimeout(tryAttach, 200)
            } else {
              console.log('Failed to attach event listeners after', maxAttempts, 'attempts')
            }
          }

          setTimeout(tryAttach, 100)

          // 마커 클릭 이벤트 추가
          window.kakao.maps.event.addListener(mapMarker, 'click', () => {
            if (this.isMobileDevice()) {
              // 모바일에서는 클릭으로 토글
              if (marker.overlayVisible) {
                this.collapseOverlay(marker.id)
                marker.overlayVisible = false
              } else {
                this.expandOverlay(marker)
                marker.overlayVisible = true
              }
            } else {
              // PC에서는 마우스 오버로 처리하므로 클릭 시 채팅방 입장
              this.joinRoom(marker.id)
            }
          })

          marker.mapMarker = mapMarker
          marker.overlay = overlay
        }
      })
    },

    filterMarkers() {
      this.displayMarkers()
    },

    expandOverlay(marker) {
      const overlayElement = document.getElementById(`overlay_${marker.id}`)
      if (!overlayElement) return

      // 이전에 확장된 오버레이가 있으면 닫기
      if (this.expandedOverlayId && this.expandedOverlayId !== marker.id) {
        this.collapseOverlay(this.expandedOverlayId)
      }

      overlayElement.classList.add('expanded')
      overlayElement.querySelector('.title').style.display = 'none'
      this.expandedOverlayId = marker.id
      console.log('Expanded overlay for marker:', marker.id)
    },

    collapseOverlay(markerId) {
      const overlayElement = document.getElementById(`overlay_${markerId}`)
      if (overlayElement) {
        overlayElement.classList.remove('expanded')
        overlayElement.querySelector('.title').style.display = 'block'
        this.expandedOverlayId = null
        console.log('Collapsed overlay for marker:', markerId)
      }
    },

    isMobileDevice() {
      return /Mobi|Android/i.test(navigator.userAgent)
    },

    joinRoom(roomId) {
      if (!roomId) {
        console.error('Invalid room ID:', roomId)
        return
      }
      this.currentRoomId = roomId
      this.chatVisible = true
    },

    toggleChat() {
      this.chatVisible = !this.chatVisible
      if (!this.chatVisible) {
        // 채팅을 닫을 때만 currentRoomId를 null로 설정
        // this.currentRoomId = null  // 이 줄을 주석 처리
      }
    },

    createMarker() {
      this.showMarkerModal = true
    },

    closeMarkerModal() {
      this.showMarkerModal = false
      this.markerForm = {
        title: '',
        context: '',
        max_number: 1,
        type: 'meet'
      }
    },

    async submitMarker() {
      try {
        const center = this.map.getCenter()
        const markerData = {
          title: this.markerForm.title,
          context: this.markerForm.context,
          max_number: this.markerForm.max_number,
          type: this.markerForm.type,
          latitude: center.getLat(),
          longitude: center.getLng(),
          image: this.getMarkerImage(this.markerForm.type)
        }

        await api.createMarker(markerData)
        this.closeMarkerModal()
        this.loadMarkers()
      } catch (error) {
        console.error('Failed to create marker:', error)
      }
    },

    getMarkerImage(type) {
      // 마커 타입에 따른 이미지 반환
      const imageMap = {
        'restaurant': '/images/restaurant_marker.png',
        'study': '/images/study_marker.png',
        'person': '/images/person_marker.png',
        'taxi': '/images/taxi_marker.png',
        'school': '/images/school_marker.png',
        'library': '/images/library_marker.png',
        'meet': '/images/meet_marker.png',
        'etc': '/images/etc_marker.png'
      }
      return imageMap[type] || '/images/etc_marker.png'
    },

    logout() {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      this.$router.push('/login')
    }
  }
}
</script>

<style>
.map-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.map-header {
  background: white;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logout-btn {
  padding: 0.5rem 1rem;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.map {
  flex: 1;
  position: relative;
}

.map-controls {
  position: absolute;
  top: 80px;
  left: 10px;
  z-index: 1000;
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.control-buttons {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.chat-toggle-btn, .create-marker-btn {
  padding: 0.5rem 1rem;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.marker-filter select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 5px;
}

.chat-panel {
  position: absolute;
  right: 0;
  top: 0;
  width: 400px;
  height: 100vh;
  background: white;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
  z-index: 1001;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 2000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  width: 90%;
  max-width: 500px;
}

.modal-content h3 {
  margin-bottom: 1rem;
  text-align: center;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 5px;
}

.form-group textarea {
  height: 100px;
  resize: vertical;
}

.modal-buttons {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.modal-buttons button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.modal-buttons button:first-child {
  background: #6c757d;
  color: white;
}

.modal-buttons button:last-child {
  background: #007bff;
  color: white;
}

/* 마커 오버레이 스타일 - 글로벌 적용 */
.marker-overlay {
  position: relative;
  z-index: 1000;
}

.customoverlay {
  position: absolute;
  bottom: 73px;
  left: 50%;
  transform: translateX(-50%);
  border-radius: 12px;
  background: white;
  box-shadow: 0 3px 14px rgba(0,0,0,0.2);
  width: 200px;
  height: 50px;
  transform-origin: top center;
  white-space: nowrap;
  word-break: keep-all;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 1px;
  box-sizing: border-box;
  line-height: 1.4;
  transition: all 0.3s ease;
}

.customoverlay::after {
  content: '';
  position: absolute;
  margin-left: -10px;
  left: 50%;
  bottom: -12px;
  width: 20px;
  height: 20px;
  background: white;
  transform: rotate(45deg);
  box-shadow: 0 3px 14px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
}

.customoverlay .count {
  position: absolute;
  top: 5px;
  right: 10px;
  font-size: 12px;
  color: #666;
  background: #f1f1f1;
  padding: 2px 4px;
  border-radius: 12px;
  z-index: 10;
}

.customoverlay.expanded {
  width: 320px;
  height: auto;
  bottom: 100px; /* 위쪽으로 확장되도록 위치 조정 */
  text-align: left;
  white-space: normal;
  transform-origin: top center; /* 위쪽을 기준으로 확장 */
}

.customoverlay .title {
  display: block;
  text-align: center;
  background: #fff;
  padding: 13px 19px;
  font-size: 14px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  word-break: break-all;
  width: 100%;
  box-sizing: border-box;
  line-height: 1.4;
  word-wrap: break-word;
}

.customoverlay .details {
  display: none;
  padding: 13px 19px;
  text-align: left;
  line-height: 1.4;
  word-wrap: break-word;
  white-space: normal;
}

.customoverlay.expanded .details {
  display: block;
}

.customoverlay.expanded .details p {
  margin: 5px 0;
  word-wrap: break-word;
  white-space: normal;
}

.customoverlay.expanded .btn-share {
  position: static;
  display: block;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.customoverlay a {
  display: block;
  text-decoration: none;
  color: #000;
  border-radius: 12px;
  font-size: 14px;
  font-weight: bold;
  overflow: hidden;
  background: #fff;
  padding: 1px;
  white-space: normal;
  word-break: break-all;
  text-align: center;
  width: 100%;
  box-sizing: border-box;
}

.btn-share {
  display: inline-block;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  font-weight: 500;
  color: #000000;
  background-color: #dbdbdb;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
  margin: 5px 0;
}

.btn-share:hover {
  background-color: #928f8f;
}

.btn-delete {
  display: inline-block;
  padding: 0.5rem 1rem;
  font-size: 1rem;
  font-weight: 500;
  color: #ffffff;
  background-color: #dc3545;
  border: none;
  border-radius: 20px;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
  margin-left: 0.5rem;
  margin: 5px 0;
}

.btn-delete:hover {
  background-color: #c82333;
}

.btn-delete:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}
</style>
