import { create } from 'zustand'
import { authAPI } from '../api'

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (credentials) => {
    try {
      const response = await authAPI.login(credentials)
      localStorage.setItem('token', response.data.token)
      set({ user: response.data.user, isAuthenticated: true })
      return response.data
    } catch (error) {
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, isAuthenticated: false })
  },

  checkAuth: async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      set({ isLoading: false })
      return
    }

    try {
      const response = await authAPI.verify()
      set({ user: response.data.user, isAuthenticated: true, isLoading: false })
    } catch (error) {
      localStorage.removeItem('token')
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  updateUser: (userData) => {
    set({ user: userData })
  },
}))
