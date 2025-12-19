import apiClient from './client'
import { User } from '../types'

export interface LoginResponse {
  user: User
  token: string
}

export const login = async (email: string, password: string): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/auth/login', { email, password })
  return response.data
}

export const register = async (
  email: string,
  password: string,
  name: string
): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>('/auth/register', {
    email,
    password,
    name,
  })
  return response.data
}

export const getCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<User>('/auth/me')
  return response.data
}

