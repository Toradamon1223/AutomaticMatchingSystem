import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User } from '../types'
import * as api from '../api/auth'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: async (email: string, password: string) => {
        const response = await api.login(email, password)
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
        })
      },
      register: async (email: string, password: string, name: string) => {
        const response = await api.register(email, password, name)
        set({
          user: response.user,
          token: response.token,
          isAuthenticated: true,
        })
      },
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
      },
      checkAuth: async () => {
        try {
          const user = await api.getCurrentUser()
          set({
            user,
            isAuthenticated: true,
          })
        } catch {
          set({
            user: null,
            token: null,
            isAuthenticated: false,
          })
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)

