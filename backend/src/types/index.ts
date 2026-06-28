import { FastifyRequest } from 'fastify'

export interface JwtPayload {
  id: string
  email: string
  iat?: number
}

export interface AuthenticatedRequest extends FastifyRequest {
  user: JwtPayload
}

export interface PaginationQuery {
  page?: number
  limit?: number
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
