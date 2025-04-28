<template>
  <div class="home container">
    <h1>欢迎, {{ username }}</h1>
    <p>这是你的主页</p>
    <div class="user-info">
      <h3>用户信息</h3>
      <p>用户ID: {{ user.id }}</p>
      <p>用户名: {{ user.username }}</p>
    </div>
    <button class="btn logout-btn" @click="logout">登出</button>
  </div>
</template>

<script>
export default {
  name: 'Home',
  computed: {
    user() {
      return this.$store.getters.getUser || {};
    },
    username() {
      return this.user.username || '用户';
    }
  },
  methods: {
    logout() {
      this.$store.dispatch('logout');
      this.$router.push('/');
    }
  }
}
</script>

<style scoped>
.home {
  padding-top: 40px;
}

.user-info {
  margin: 30px auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  max-width: 300px;
  text-align: left;
}

.logout-btn {
  background-color: #dc3545;
}

.logout-btn:hover {
  background-color: #c82333;
}
</style>
