/**
 * @kokecore/auth
 *
 * Enterprise-grade authentication with:
 * - JWT with access/refresh tokens
 * - Session versioning for invalidation
 * - Argon2id password hashing
 * - MFA support
 * - OAuth2 providers
 * - Rate limiting
 * - Device fingerprinting
 * - Audit logging
 */

import * as argon2 from 'argon2';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { z } from 'zod';

/**
 * User status
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  DELETED = 'DELETED',
}

/**
 * JWT payload structure
 */
export interface JwtAccessPayload {
  sub: string; // User ID
  email: string;
  sessionVersion: number;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
  sessionVersion: number;
  iat?: number;
  exp?: number;
}

/**
 * Token pair
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Session information
 */
export interface Session {
  id: string;
  userId: string;
  sessionVersion: number;
  deviceFingerprint?: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt: Date;
}

/**
 * MFA configuration
 */
export interface MFAConfig {
  enabled: boolean;
  secret?: string;
  backupCodes?: string[];
}

/**
 * OAuth provider types
 */
export enum OAuthProvider {
  GOOGLE = 'google',
  GITHUB = 'github',
  MICROSOFT = 'microsoft',
}

/**
 * OAuth profile
 */
export interface OAuthProfile {
  provider: OAuthProvider;
  providerId: string;
  email: string;
  name?: string;
  avatar?: string;
}

/**
 * Auth configuration
 */
export interface AuthConfig {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresSeconds: number;
  jwtRefreshExpiresSeconds: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  maxSessionsPerUser: number;
  sessionTimeoutMinutes: number;
  mfaEnabled: boolean;
}

/**
 * Password hashing with Argon2id
 */
export class PasswordService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Hash password using Argon2id
   */
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.config.passwordMinLength) {
      errors.push(`Password must be at least ${this.config.passwordMinLength} characters`);
    }

    if (this.config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.config.passwordRequireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.config.passwordRequireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.config.passwordRequireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if password is in common passwords list
   */
  async isCommonPassword(password: string): Promise<boolean> {
    // This would integrate with a common passwords database
    // For now, return false
    return false;
  }
}

/**
 * JWT token service
 */
export class JwtService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
    if (config.jwtAccessSecret === config.jwtRefreshSecret) {
      throw new Error('JWT access and refresh secrets must be different');
    }
  }

  /**
   * Generate access token
   */
  async generateAccessToken(payload: JwtAccessPayload): Promise<string> {
    return this.sign(
      payload,
      this.config.jwtAccessSecret,
      this.config.jwtAccessExpiresSeconds,
      'access'
    );
  }

  /**
   * Generate refresh token
   */
  async generateRefreshToken(payload: JwtRefreshPayload): Promise<string> {
    return this.sign(
      payload,
      this.config.jwtRefreshSecret,
      this.config.jwtRefreshExpiresSeconds,
      'refresh'
    );
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token: string): Promise<JwtAccessPayload> {
    return this.verify<JwtAccessPayload>(token, this.config.jwtAccessSecret, 'access');
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<JwtRefreshPayload> {
    return this.verify<JwtRefreshPayload>(token, this.config.jwtRefreshSecret, 'refresh');
  }

  /**
   * Generate token pair
   */
  async generateTokenPair(
    userId: string,
    email: string,
    sessionVersion: number,
    sessionId: string
  ): Promise<TokenPair> {
    const accessPayload: JwtAccessPayload = {
      sub: userId,
      email,
      sessionVersion,
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      sessionId,
      sessionVersion,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.generateAccessToken(accessPayload),
      this.generateRefreshToken(refreshPayload),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.config.jwtAccessExpiresSeconds,
    };
  }

  private sign(
    payload: JwtAccessPayload | JwtRefreshPayload,
    secret: string,
    expiresInSeconds: number,
    tokenUse: 'access' | 'refresh'
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const header = encodeJwtSegment({ alg: 'HS256', typ: 'JWT' });
    const body = encodeJwtSegment({ ...payload, iat: now, exp: now + expiresInSeconds, tokenUse });
    const signature = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  private verify<T extends JwtAccessPayload | JwtRefreshPayload>(
    token: string,
    secret: string,
    expectedTokenUse: 'access' | 'refresh'
  ): T {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      throw new Error('Invalid JWT');
    }

    const [header, body, signature] = parts;
    const parsedHeader = decodeJwtSegment(header) as { alg?: unknown; typ?: unknown };
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') {
      throw new Error('Invalid JWT header');
    }

    const expectedSignature = createHmac('sha256', secret).update(`${header}.${body}`).digest();
    const suppliedSignature = Buffer.from(signature, 'base64url');
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      throw new Error('Invalid JWT signature');
    }

    const payload = decodeJwtSegment(body) as Record<string, unknown>;
    const expiresAt = payload.exp;
    if (
      typeof payload.sub !== 'string' ||
      !Number.isInteger(payload.sessionVersion) ||
      typeof expiresAt !== 'number' ||
      !Number.isInteger(expiresAt) ||
      !Number.isInteger(payload.iat) ||
      payload.tokenUse !== expectedTokenUse ||
      expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      throw new Error('Invalid or expired JWT');
    }

    if (expectedTokenUse === 'access' && typeof payload.email !== 'string') {
      throw new Error('Invalid or expired JWT');
    }
    if (expectedTokenUse === 'refresh' && typeof payload.sessionId !== 'string') {
      throw new Error('Invalid or expired JWT');
    }

    return payload as unknown as T;
  }
}

function encodeJwtSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeJwtSegment(value: string): unknown {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid JWT');
  }
}

/**
 * Session management service
 */
export class SessionService {
  private config: AuthConfig;
  private sessions: Map<string, Session> = new Map();

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Create new session
   */
  async createSession(
    userId: string,
    deviceFingerprint?: string,
    userAgent?: string,
    ipAddress?: string
  ): Promise<Session> {
    const session: Session = {
      id: this.generateSessionId(),
      userId,
      sessionVersion: 1,
      deviceFingerprint,
      userAgent,
      ipAddress,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.sessionTimeoutMinutes * 60 * 1000),
      lastUsedAt: new Date(),
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last used time
    session.lastUsedAt = new Date();
    this.sessions.set(sessionId, session);

    return session;
  }

  /**
   * Invalidate session (increment version)
   */
  async invalidateSession(userId: string): Promise<void> {
    const userSessions = Array.from(this.sessions.values()).filter((s) => s.userId === userId);

    userSessions.forEach((session) => {
      session.sessionVersion++;
      this.sessions.set(session.id, session);
    });
  }

  /**
   * Invalidate specific session
   */
  async invalidateSpecificSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.sessionVersion++;
      this.sessions.set(sessionId, session);
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      (s) => s.userId === userId && s.expiresAt > new Date()
    );
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Check if user has too many sessions
   */
  async hasTooManySessions(userId: string): Promise<boolean> {
    const sessions = await this.getUserSessions(userId);
    return sessions.length >= this.config.maxSessionsPerUser;
  }

  /**
   * Remove oldest session
   */
  async removeOldestSession(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    if (sessions.length === 0) return;

    const oldest = sessions.reduce((oldest, current) =>
      oldest.createdAt < current.createdAt ? oldest : current
    );

    this.sessions.delete(oldest.id);
  }

  private generateSessionId(): string {
    return `session_${randomUUID()}`;
  }
}

/**
 * Device fingerprinting service
 */
export class DeviceFingerprintService {
  /**
   * Generate device fingerprint from request
   */
  generateFingerprint(userAgent: string, ipAddress: string): string {
    return createHash('sha256').update(`${userAgent}|${ipAddress}`).digest('hex');
  }

  /**
   * Compare fingerprints
   */
  compareFingerprints(fp1: string, fp2: string): boolean {
    return fp1 === fp2;
  }
}

/**
 * MFA service
 */
export class MFAService {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Generate MFA secret
   */
  async generateSecret(): Promise<string> {
    return encodeBase32(randomBytes(20));
  }

  /**
   * Generate backup codes
   */
  async generateBackupCodes(count: number = 10): Promise<string[]> {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateBackupCode());
    }
    return codes;
  }

  /**
   * Verify MFA code
   */
  async verifyCode(secret: string, code: string): Promise<boolean> {
    if (!/^\d{6}$/.test(code)) {
      return false;
    }

    try {
      const currentStep = Math.floor(Date.now() / 30_000);
      return [currentStep - 1, currentStep, currentStep + 1].some((step) =>
        secureEqual(code, generateTotp(secret, step))
      );
    } catch {
      return false;
    }
  }

  /**
   * Verify backup code
   */
  async verifyBackupCode(backupCodes: string[], code: string): Promise<boolean> {
    return backupCodes.some((backupCode) => secureEqual(backupCode, code));
  }

  /**
   * Remove used backup code
   */
  removeBackupCode(backupCodes: string[], code: string): string[] {
    return backupCodes.filter((c) => c !== code);
  }

  private generateBackupCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let index = 0; index < 10; index += 1) {
      code += alphabet.charAt(randomInt(alphabet.length));
    }
    return code;
  }
}

function encodeBase32(value: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of value) {
    bits += byte.toString(2).padStart(8, '0');
  }

  let encoded = '';
  for (let index = 0; index < bits.length; index += 5) {
    encoded += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return encoded;
}

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of value.replace(/=|\s/g, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index === -1) {
      throw new Error('Invalid MFA secret');
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotp(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, '0');
}

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * OAuth service
 */
export class OAuthService {
  private config: AuthConfig;
  private providers: Map<OAuthProvider, any> = new Map();

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Register OAuth provider
   */
  registerProvider(provider: OAuthProvider, config: any): void {
    this.providers.set(provider, config);
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(provider: OAuthProvider, state: string): string {
    // In production, this would generate OAuth authorization URL
    return `https://oauth.example.com/authorize?state=${state}`;
  }

  /**
   * Exchange code for tokens
   */
  async exchangeCodeForTokens(
    provider: OAuthProvider,
    code: string
  ): Promise<{ accessToken: string; refreshToken?: string }> {
    // In production, this would exchange OAuth code
    return {
      accessToken: 'access_token_placeholder',
    };
  }

  /**
   * Get user profile from OAuth provider
   */
  async getProfile(provider: OAuthProvider, accessToken: string): Promise<OAuthProfile> {
    // In production, this would fetch user profile from OAuth provider
    return {
      provider,
      providerId: 'provider_id_placeholder',
      email: 'user@example.com',
      name: 'User Name',
    };
  }

  /**
   * Validate OAuth state
   */
  validateState(state: string, expectedState: string): boolean {
    return state === expectedState;
  }
}

/**
 * Rate limiting service for auth
 */
export class AuthRateLimitService {
  private attempts: Map<string, { count: number; resetAt: number }> = new Map();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  /**
   * Check if rate limit exceeded
   */
  async checkRateLimit(identifier: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record || record.resetAt < now) {
      // Reset or create new record
      this.attempts.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return { allowed: true };
    }

    if (record.count >= this.maxAttempts) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Increment count
    record.count++;
    this.attempts.set(identifier, record);
    return { allowed: true };
  }

  /**
   * Reset rate limit for identifier
   */
  resetRateLimit(identifier: string): void {
    this.attempts.delete(identifier);
  }

  /**
   * Clean up expired records
   */
  cleanup(): void {
    const now = Date.now();
    for (const [identifier, record] of this.attempts.entries()) {
      if (record.resetAt < now) {
        this.attempts.delete(identifier);
      }
    }
  }
}

/**
 * Audit logging for auth events
 */
export interface AuthAuditEvent {
  timestamp: string;
  eventType:
    'LOGIN' | 'LOGOUT' | 'PASSWORD_CHANGE' | 'MFA_ENABLED' | 'MFA_DISABLED' | 'SESSION_INVALIDATED';
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export class AuthAuditService {
  private events: AuthAuditEvent[] = [];

  /**
   * Log auth event
   */
  logEvent(event: AuthAuditEvent): void {
    this.events.push(event);
  }

  /**
   * Get events for user
   */
  getUserEvents(userId: string): AuthAuditEvent[] {
    return this.events.filter((e) => e.userId === userId);
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 100): AuthAuditEvent[] {
    return this.events.slice(-limit);
  }
}

/**
 * Main auth service combining all features
 */
export class AuthService {
  private passwordService: PasswordService;
  private jwtService: JwtService;
  private sessionService: SessionService;
  private deviceFingerprintService: DeviceFingerprintService;
  private mfaService: MFAService;
  private oauthService: OAuthService;
  private rateLimitService: AuthRateLimitService;
  private auditService: AuthAuditService;

  constructor(config: AuthConfig) {
    this.passwordService = new PasswordService(config);
    this.jwtService = new JwtService(config);
    this.sessionService = new SessionService(config);
    this.deviceFingerprintService = new DeviceFingerprintService();
    this.mfaService = new MFAService(config);
    this.oauthService = new OAuthService(config);
    this.rateLimitService = new AuthRateLimitService();
    this.auditService = new AuthAuditService();
  }

  /**
   * Authenticate user with email and password
   */
  async authenticate(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; tokenPair?: TokenPair; error?: string }> {
    // Check rate limit
    const rateLimitResult = await this.rateLimitService.checkRateLimit(email);
    if (!rateLimitResult.allowed) {
      return { success: false, error: 'Too many attempts' };
    }

    // In production, this would verify user credentials from database
    const validPassword = await this.passwordService.verifyPassword(password, 'hash_placeholder');

    if (!validPassword) {
      this.auditService.logEvent({
        timestamp: new Date().toISOString(),
        eventType: 'LOGIN',
        ipAddress,
        userAgent,
        success: false,
      });
      return { success: false, error: 'Invalid credentials' };
    }

    // Create session
    const deviceFingerprint = this.deviceFingerprintService.generateFingerprint(
      userAgent || '',
      ipAddress || ''
    );
    const session = await this.sessionService.createSession(
      'user_id_placeholder',
      deviceFingerprint,
      userAgent,
      ipAddress
    );

    // Generate tokens
    const tokenPair = await this.jwtService.generateTokenPair(
      'user_id_placeholder',
      email,
      session.sessionVersion,
      session.id
    );

    this.auditService.logEvent({
      timestamp: new Date().toISOString(),
      eventType: 'LOGIN',
      userId: 'user_id_placeholder',
      sessionId: session.id,
      ipAddress,
      userAgent,
      success: true,
    });

    return { success: true, tokenPair };
  }

  /**
   * Refresh access token
   */
  async refreshToken(
    refreshToken: string
  ): Promise<{ success: boolean; tokenPair?: TokenPair; error?: string }> {
    try {
      const payload = await this.jwtService.verifyRefreshToken(refreshToken);
      const session = await this.sessionService.getSession(payload.sessionId);

      if (!session) {
        return { success: false, error: 'Invalid session' };
      }

      if (session.sessionVersion !== payload.sessionVersion) {
        return { success: false, error: 'Session invalidated' };
      }

      // Generate new token pair
      const tokenPair = await this.jwtService.generateTokenPair(
        payload.sub,
        'email_placeholder',
        session.sessionVersion,
        session.id
      );

      return { success: true, tokenPair };
    } catch {
      return { success: false, error: 'Invalid token' };
    }
  }

  /**
   * Logout user
   */
  async logout(sessionId: string): Promise<void> {
    await this.sessionService.invalidateSpecificSession(sessionId);
  }

  /**
   * Logout all sessions for user
   */
  async logoutAll(userId: string): Promise<void> {
    await this.sessionService.invalidateSession(userId);
  }

  /**
   * Get sub-services
   */
  getPasswordService(): PasswordService {
    return this.passwordService;
  }

  getJwtService(): JwtService {
    return this.jwtService;
  }

  getSessionService(): SessionService {
    return this.sessionService;
  }

  getMfaService(): MFAService {
    return this.mfaService;
  }

  getOAuthService(): OAuthService {
    return this.oauthService;
  }

  getAuditService(): AuthAuditService {
    return this.auditService;
  }
}

/**
 * Zod schemas for validation
 */
export const authConfigSchema = z.object({
  jwtAccessSecret: z.string().min(32),
  jwtRefreshSecret: z.string().min(32),
  jwtAccessExpiresSeconds: z.number().int().positive(),
  jwtRefreshExpiresSeconds: z.number().int().positive(),
  passwordMinLength: z.number().int().positive(),
  passwordRequireUppercase: z.boolean(),
  passwordRequireLowercase: z.boolean(),
  passwordRequireNumbers: z.boolean(),
  passwordRequireSpecialChars: z.boolean(),
  maxSessionsPerUser: z.number().int().positive(),
  sessionTimeoutMinutes: z.number().int().positive(),
  mfaEnabled: z.boolean(),
});
