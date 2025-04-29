<template>
  <div class="login-container container">
    <h1>{{ mode === 'login' ? '登录' : '注册' }}</h1>
    
    <div class="form-group">
      <label for="username">用户名</label>
      <input type="text" id="username" v-model="username" placeholder="请输入用户名">
    </div>
    
    <div class="form-group">
      <label for="password">密码</label>
      <input type="password" id="password" v-model="password" placeholder="请输入密码">
    </div>
    
    <div class="form-actions">
      <button class="btn" @click="handleSubmit">{{ mode === 'login' ? '登录' : '注册' }}</button>
      <button class="btn biometric" v-if="mode === 'login' && biometricsAvailable" @click="handleBiometricLogin">
        使用生物识别登录
      </button>
    </div>
    
    <p class="mode-switch">
      {{ mode === 'login' ? '没有账号？' : '已有账号？' }}
      <a href="#" @click.prevent="toggleMode">{{ mode === 'login' ? '注册' : '登录' }}</a>
    </p>

    <div v-if="mode === 'register' && registrationStep === 1">
      <button class="btn" @click="registerBiometrics">注册生物识别</button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
  </div>
</template>

<script>
import {
  startRegistration,
  startAuthentication
} from '@simplewebauthn/browser';
import axios from 'axios';

// 创建API服务
const api = axios.create({
  baseURL: 'https://mock-be-roy-hcs-roy-hcs-projects.vercel.app/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

export default {
  name: 'Login',
  data() {
    return {
      mode: 'login', // login or register
      username: '',
      password: '',
      userId: '',
      error: null,
      biometricsAvailable: false,
      registrationStep: 0,
      loading: false
    };
  },
  mounted() {
    this.checkBiometricsAvailability();
  },
  methods: {
    toggleMode() {
      this.mode = this.mode === 'login' ? 'register' : 'login';
      this.error = null;
      this.registrationStep = 0;
    },
    async checkBiometricsAvailability() {
      try {
        // 检查浏览器是否支持WebAuthn
        this.biometricsAvailable = window.PublicKeyCredential && 
                                  typeof window.PublicKeyCredential !== 'undefined' &&
                                  typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
        console.log('WebAuthn支持:', this.biometricsAvailable);
        if (this.biometricsAvailable) {
          this.biometricsAvailable = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        }
      } catch (error) {
        console.error('Error checking biometrics availability:', error);
        this.biometricsAvailable = false;
      }
    },
    async handleSubmit() {
      if (!this.username || !this.password) {
        this.error = '请输入用户名和密码';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        if (this.mode === 'login') {
          // 调用真实登录API
          const response = await api.post('/auth/login', {
            username: this.username,
            password: this.password
          });
          
          // 获取用户信息并存储到Vuex
          const user = response.data.user || { id: response.data.userId || 1, username: this.username };
          this.userId = user.id;
          this.$store.dispatch('login', user);
          
          // 重定向到主页
          this.$router.push('/home');
        } else {
          // 调用真实注册API
          const response = await api.post('/auth/register', {
            username: this.username,
            password: this.password
          });
          console.log('注册成功:', response.data);
          this.userId = response.data.userId;
          
          // 如果注册成功，显示注册生物识别步骤
          this.registrationStep = 1;
        }
      } catch (error) {
        this.error = error.response?.data?.message || 
                    error.response?.data?.error || 
                    error.message || 
                    '操作失败，请重试';
        console.error('API错误:', error);
      } finally {
        this.loading = false;
      }
    },
    async registerBiometrics() {
      if (!this.biometricsAvailable) {
        this.error = '您的设备不支持生物识别';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const optionsResponse = await api.post('/auth/generate-registration-options', {
          username: this.username,
          userId: this.userId
        });
        
        const registrationOptions = optionsResponse.data;
        
        // 确保challenge是适当的格式（Uint8Array）
        if (typeof registrationOptions.challenge === 'string') {
          registrationOptions.challenge = Uint8Array.from(
            atob(registrationOptions.challenge.replace(/-/g, '+').replace(/_/g, '/')), 
            c => c.charCodeAt(0)
          );
        }
        
        // 确保user.id是适当的格式（Uint8Array）
        if (registrationOptions.user && typeof registrationOptions.user.id === 'string') {
          registrationOptions.user.id = Uint8Array.from(
            atob(registrationOptions.user.id.replace(/-/g, '+').replace(/_/g, '/')), 
            c => c.charCodeAt(0)
          );
        }

        const registrationResponse = await startRegistration(registrationOptions);
        
        const verificationResponse = await api.post('/auth/verify-registration', {
          username: this.username,
          registrationResponse
        });
        
        // 注册成功，登录用户
        const user = verificationResponse.data.user || { id: verificationResponse.data.userId || 1, username: this.username };
        this.$store.dispatch('login', user);
        this.$router.push('/home');
        
      } catch (error) {
        this.error = error.response?.data?.message || 
                    error.response?.data?.error || 
                    error.message || 
                    '生物识别注册失败';
        console.error('生物识别注册错误:', error);
      } finally {
        this.loading = false;
      }
    },
    async handleBiometricLogin() {
      if (!this.username) {
        this.error = '请先输入用户名';
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        // 从后端获取WebAuthn认证选项 - 更新为正确的endpoint
        const optionsResponse = await api.post('/auth/generate-authentication-options', {
          username: this.username
        });
        
        const authenticationOptions = optionsResponse.data;
        
        // 确保challenge是适当的格式（Uint8Array）
        if (typeof authenticationOptions.challenge === 'string') {
          authenticationOptions.challenge = Uint8Array.from(
            atob(authenticationOptions.challenge.replace(/-/g, '+').replace(/_/g, '/')), 
            c => c.charCodeAt(0)
          );
        }
        
        // 确保allowCredentials中的id是适当的格式（Uint8Array）
        if (authenticationOptions.allowCredentials && Array.isArray(authenticationOptions.allowCredentials)) {
          authenticationOptions.allowCredentials = authenticationOptions.allowCredentials.map(credential => {
            if (typeof credential.id === 'string') {
              return {
                ...credential,
                id: Uint8Array.from(
                  atob(credential.id.replace(/-/g, '+').replace(/_/g, '/')), 
                  c => c.charCodeAt(0)
                )
              };
            }
            return credential;
          });
        }

        const authenticationResponse = await startAuthentication(authenticationOptions);
        
        // 将响应发送到后端验证 - 更新为正确的endpoint
        const verificationResponse = await api.post('/auth/verify-authentication', {
          username: this.username,
          authenticationResponse
        });
        
        // 认证成功，登录用户
        const user = verificationResponse.data.user || { id: verificationResponse.data.userId || 1, username: this.username };
        this.$store.dispatch('login', user);
        this.$router.push('/home');
        
      } catch (error) {
        this.error = error.response?.data?.message || 
                    error.response?.data?.error || 
                    error.message || 
                    '生物识别登录失败';
        console.error('生物识别登录错误:', error);
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>

<style scoped>
.login-container {
  padding: 40px 20px;
}

.form-actions {
  margin-bottom: 20px;
}

.mode-switch {
  margin-top: 20px;
}

.btn {
  margin-right: 10px;
  margin-bottom: 10px;
}

.btn.biometric {
  background-color: #007bff;
}

.btn.biometric:hover {
  background-color: #0069d9;
}

.error-message {
  color: red;
  margin-top: 15px;
}
</style>
