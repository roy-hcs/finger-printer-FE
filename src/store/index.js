import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    user: null,
    authReady: false
  },
  getters: {
    isAuthenticated: state => !!state.user,
    getUser: state => state.user
  },
  mutations: {
    SET_USER(state, user) {
      state.user = user
    },
    SET_AUTH_READY(state, isReady) {
      state.authReady = isReady
    }
  },
  actions: {
    login({ commit }, user) {
      commit('SET_USER', user)
      localStorage.setItem('user', JSON.stringify(user))
    },
    logout({ commit }) {
      commit('SET_USER', null)
      localStorage.removeItem('user')
    },
    initAuth({ commit }) {
      const user = localStorage.getItem('user')
      if (user) {
        commit('SET_USER', JSON.parse(user))
      }
      commit('SET_AUTH_READY', true)
    }
  }
})
