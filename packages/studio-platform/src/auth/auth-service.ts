/**
 * Auth Service — Platform-level authentication and authorization.
 *
 * All workspace auth goes through this service. Workspaces MUST NOT
 * implement their own auth logic.
 *
 * @package @studio/platform/auth
 * @see MANIFESTO.md §2 (Platform Owns Auth)
 * @see PLATFORM-SDK.md §3.2
 */

import type { ApiResponse } from '../api/types';

/**
 * Authenticated user information extracted from JWT token.
 */
export interface AuthUser {
  /** Unique user ID */
  id: string;

  /** User display name */
  name: string;

  /** User email */
  email?: string;

  /** Membership tier */
  membershipTier: 'free' | 'basic' | 'vip' | 'enterprise';

  /** Token version (for single-device login enforcement) */
  tokenVersion: number;

  /** Last activity timestamp */
  lastActiveAt?: string;
}

/**
 * Auth middleware factory type.
 * Returns a middleware function that verifies JWT and enriches the request context.
 */
export interface AuthMiddleware {
  (request: { headers: Record<string, string | undefined> }): Promise<AuthUser>;
}

/**
 * Auth service configuration options.
 */
export interface AuthConfig {
  /** JWT secret or public key for token verification */
  secret: string;

  /** Token issuer (iss claim) */
  issuer?: string;

  /** Token audience (aud claim) */
  audience?: string;

  /** Whether to verify single-device login */
  enforceSingleDevice?: boolean;
}

/**
 * Platform Auth Service.
 *
 * Responsibilities:
 * - Verify JWT tokens and extract user identity
 * - Provide auth middleware factory for route handlers
 * - Enforce single-device login (optional)
 * - Track user last activity
 */
export class AuthService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Verify a JWT token and return the authenticated user.
   *
   * @param token - Raw JWT token string (with or without 'Bearer ' prefix)
   * @returns Authenticated user information
   * @throws ApiError on invalid/expired token
   */
  async verify(token: string): Promise<AuthUser> {
    const cleanToken = token.replace(/^Bearer\s+/i, '');

    if (!cleanToken) {
      throw this.createAuthError('未提供认证凭据');
    }

    // In C1, this is a shim that delegates to the actual JWT verification
    // Real implementation in C2 will use the platform's verifyToken infrastructure
    const user = await this.verifyToken(cleanToken);

    if (!user) {
      throw this.createAuthError('Token 无效或已过期');
    }

    return user;
  }

  /**
   * Create an auth middleware function for route handlers.
   * Extracts user from Authorization header or falls back to cookie.
   */
  createMiddleware(): AuthMiddleware {
    return async (request: { headers: Record<string, string | undefined> }): Promise<AuthUser> => {
      const authHeader = request.headers['authorization'];
      if (!authHeader) {
        throw this.createAuthError('未提供认证凭据');
      }
      return this.verify(authHeader);
    };
  }

  /**
   * Extract the current user from a request context.
   * Convenience wrapper for route handlers that already have a user context.
   */
  getCurrentUser(user?: AuthUser): AuthUser {
    if (!user) {
      throw this.createAuthError('未找到用户信息');
    }
    return user;
  }

  /**
   * Check if the user has a specific permission.
   * Stub implementation — real permission check in C2.
   */
  async hasPermission(_user: AuthUser, _action: string): Promise<boolean> {
    // C1 shim: returns true for all actions
    // Real implementation in C2 will check role-based permissions
    return true;
  }

  // ============ Private Helpers ============

  private async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      // C1 shim: delegates to platform's JWT verification
      // In the Fastify context, this uses @fastify/jwt
      // In the browser context, this calls PlatformSDK.auth.verify(token)
      //
      // The real implementation in C2 will:
      // 1. Decode and verify JWT signature
      // 2. Check tokenVersion against database for single-device enforcement
      // 3. Update lastActiveAt
      // 4. Return AuthUser

      // For now, we decode the token payload (verification happens at platform level)
      const payload = this.decodeToken(token);
      if (!payload || !payload.id) {
        return null;
      }

      return {
        id: payload.id as string,
        name: (payload.name as string) || 'Unknown',
        email: payload.email as string | undefined,
        membershipTier: (payload.membershipTier as AuthUser['membershipTier']) || 'free',
        tokenVersion: (payload.tokenVersion as number) || 0,
        lastActiveAt: payload.lastActiveAt as string | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Decode JWT token payload without signature verification.
   * Actual verification should be done by the platform's JWT infrastructure.
   */
  private decodeToken(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = parts[1];
      const decoded = Buffer.from(payload, 'base64url').toString('utf-8');
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  private createAuthError(message: string): never {
    // This will be thrown and caught by the route handler
    throw {
      code: 'AUTH_ERROR',
      message,
      details: undefined,
    };
  }
}
