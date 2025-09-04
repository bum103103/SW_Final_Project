<template>
  <div class="register-container">
    <div class="register-form">
      <h2>회원가입</h2>
      <form @submit.prevent="handleRegister">
        <div class="form-group">
          <label for="username">아이디</label>
          <input
            type="text"
            id="username"
            v-model="userData.username"
            required
            placeholder="아이디를 입력하세요"
          />
        </div>

        <div class="form-group">
          <label for="password">비밀번호</label>
          <input
            type="password"
            id="password"
            v-model="userData.password"
            required
            placeholder="비밀번호를 입력하세요"
          />
        </div>

        <div class="form-group">
          <label for="confirmPassword">비밀번호 확인</label>
          <input
            type="password"
            id="confirmPassword"
            v-model="userData.confirmPassword"
            required
            placeholder="비밀번호를 다시 입력하세요"
          />
        </div>

        <button type="submit" :disabled="loading" class="register-btn">
          {{ loading ? '회원가입 중...' : '회원가입' }}
        </button>
      </form>

      <div class="login-link">
        <p>이미 계정이 있으신가요? <router-link to="/login">로그인</router-link></p>
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="success" class="success-message">
        {{ success }}
      </div>
    </div>
  </div>
</template>

<script>
import api from '@/services/api'

export default {
  name: 'RegisterView',
  data() {
    return {
      userData: {
        username: '',
        password: '',
        confirmPassword: ''
      },
      loading: false,
      error: null,
      success: null
    }
  },
  methods: {
    async handleRegister() {
      this.loading = true
      this.error = null
      this.success = null

      // Validate password match
      if (this.userData.password !== this.userData.confirmPassword) {
        this.error = '비밀번호가 일치하지 않습니다.'
        this.loading = false
        return
      }

      // Validate password length
      if (this.userData.password.length < 8) {
        this.error = '비밀번호는 최소 8자리 이상이어야 합니다.'
        this.loading = false
        return
      }

      try {
        const response = await api.register({
          username: this.userData.username,
          password: this.userData.password,
          password_confirm: this.userData.confirmPassword
        })

        if (response.data.tokens) {
          // Auto login after registration
          localStorage.setItem('token', response.data.tokens.access)
          localStorage.setItem('refreshToken', response.data.tokens.refresh)
          localStorage.setItem('user', JSON.stringify(response.data.user))

          this.success = '회원가입이 완료되었습니다! 메인 페이지로 이동합니다.'
          setTimeout(() => {
            this.$router.push('/map')
          }, 2000)
        }
      } catch (error) {
        console.error('Register error:', error)
        const data = error.response?.data
        if (data) {
          if (typeof data === 'string') {
            this.error = data
          } else if (data.detail) {
            this.error = data.detail
          } else if (data.password) {
            this.error = Array.isArray(data.password) ? data.password.join(' ') : String(data.password)
          } else if (data.username) {
            this.error = Array.isArray(data.username) ? data.username.join(' ') : String(data.username)
          } else if (data.non_field_errors) {
            this.error = Array.isArray(data.non_field_errors) ? data.non_field_errors.join(' ') : String(data.non_field_errors)
          } else {
            this.error = JSON.stringify(data)
          }
        } else {
          this.error = '회원가입에 실패했습니다.'
        }
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.register-form {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

.register-form h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
  font-weight: 600;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  color: #555;
  font-weight: 500;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e5e9;
  border-radius: 5px;
  font-size: 1rem;
  transition: border-color 0.3s ease;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
}

.register-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 5px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.register-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.register-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.login-link {
  text-align: center;
  margin-top: 1rem;
}

.login-link a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

.login-link a:hover {
  text-decoration: underline;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #fee;
  color: #c33;
  border-radius: 5px;
  text-align: center;
  border: 1px solid #fcc;
}

.success-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: #efe;
  color: #363;
  border-radius: 5px;
  text-align: center;
  border: 1px solid #cfc;
}
</style>
