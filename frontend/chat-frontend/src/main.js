import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './assets/styles.css'

// FontAwesome 설정
import { library } from '@fortawesome/fontawesome-svg-core'
import { faPaperPlane, faMessage } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// 아이콘 라이브러리에 추가
library.add(faPaperPlane, faMessage)

const app = createApp(App)
app.use(router)

// FontAwesome 컴포넌트 전역 등록
app.component('FontAwesomeIcon', FontAwesomeIcon)

app.mount('#app')
