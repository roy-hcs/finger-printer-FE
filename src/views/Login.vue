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
  // Use different baseURL based on environment
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://mock-be.vercel.app/api' 
    : '/api',
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
        
        // Fix: Don't attempt to transform challenge if it's already in the correct format
        // The library will handle base64url strings automatically
        console.log('Registration options received:', JSON.stringify(registrationOptions));
        
        // Start registration without manual conversion
        const registrationResponse = await startRegistration(registrationOptions);
        
        const verificationResponse = await api.post('/auth/verify-registration', {
          userId: this.userId, // Changed to match expected backend parameter
          attestationResponse: registrationResponse // Changed to match expected backend parameter
        });
        
        // 注册成功，登录用户
        const user = verificationResponse.data.user || { id: verificationResponse.data.userId || 1, username: this.username };
        this.$store.dispatch('login', user);
        this.$router.push('/home');
        
      } catch (error) {
        console.error('生物识别注册错误 (详细):', error);
        this.error = error.response?.data?.message || 
                    error.response?.data?.error || 
                    error.message || 
                    '生物识别注册失败';
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
        console.log('Authentication options received:', JSON.stringify(authenticationOptions));
        
        // Start authentication without manual conversion
        // The SimpleWebAuthn library will handle the base64url format
        const authenticationResponse = await startAuthentication(authenticationOptions);
        
        // Update parameter name to match backend API
        const verificationResponse = await api.post('/auth/verify-authentication', {
          username: this.username,
          assertionResponse: authenticationResponse // Changed to match expected backend parameter
        });
        
        // 认证成功，登录用户
        const user = verificationResponse.data.user || { id: verificationResponse.data.userId || 1, username: this.username };
        this.$store.dispatch('login', user);
        this.$router.push('/home');
        
      } catch (error) {
        console.error('生物识别登录错误 (详细):', error);
        this.error = error.response?.data?.message || 
                    error.response?.data?.error || 
                    error.message || 
                    '生物识别登录失败';
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
