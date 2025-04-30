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
        // Log device info for debugging
        const userAgent = navigator.userAgent;
        const isAndroid = /android/i.test(userAgent);
        console.log('设备信息:', {
          userAgent,
          isAndroid,
          platform: navigator.platform,
          vendor: navigator.vendor
        });

        const optionsResponse = await api.post('/auth/generate-registration-options', {
          username: this.username,
          userId: this.userId
        });
        
        const registrationOptions = optionsResponse.data;
        console.log('Registration options received:', JSON.stringify(registrationOptions));
        
        // For Android, ensure authenticatorSelection is properly set
        if (isAndroid) {
          // Ensure these options are set for better Android compatibility
          registrationOptions.authenticatorSelection = {
            ...registrationOptions.authenticatorSelection,
            authenticatorAttachment: 'platform',
            requireResidentKey: false,
            userVerification: 'preferred'
          };
          console.log('Modified options for Android:', registrationOptions.authenticatorSelection);
        }
        
        // Start registration with timeout handling
        let registrationResponse;
        try {
          const registrationPromise = startRegistration(registrationOptions);
          
          // Add a timeout to detect stuck processes
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('WebAuthn registration timed out after 30 seconds')), 30000);
          });
          
          registrationResponse = await Promise.race([registrationPromise, timeoutPromise]);
          console.log('Registration response received:', registrationResponse);
        } catch (regError) {
          console.error('Registration specific error:', regError);
          // Check for common Android errors
          if (regError.name === 'NotReadableError') {
            throw new Error('设备凭证管理器出现问题。请确保您的设备已设置锁屏密码或生物识别，并重试。');
          }
          throw regError;
        }
        
        const verificationResponse = await api.post('/auth/verify-registration', {
          userId: this.userId,
          attestationResponse: registrationResponse,
          origin: window.location.origin
        });
        
        // 注册成功，登录用户
        const user = verificationResponse.data.user || { id: verificationResponse.data.userId || 1, username: this.username };
        this.$store.dispatch('login', user);
        this.$router.push('/home');
        
      } catch (error) {
        console.error('生物识别注册错误 (详细):', error);
        
        // More descriptive error messages for common WebAuthn errors
        let errorMessage = '生物识别注册失败';
        
        if (error.name === 'AbortError') {
          errorMessage = '您取消了生物识别注册过程';
        } else if (error.name === 'NotAllowedError') {
          errorMessage = '操作被浏览器阻止或用户取消';
        } else if (error.name === 'SecurityError') {
          errorMessage = '安全错误：确保您在安全环境(HTTPS)下使用此功能';
        } else if (error.name === 'NotSupportedError') {
          errorMessage = '您的设备不支持所请求的生物识别功能';
        }
        
        this.error = error.response?.data?.message || 
                    error.response?.data?.error || 
                    error.message || 
                    errorMessage;
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
        
        const verificationResponse = await api.post('/auth/verify-authentication', {
          username: this.username,
          assertionResponse: authenticationResponse,
          origin: window.location.origin
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
