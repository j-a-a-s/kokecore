import {
  AuthConfig,
  authConfigSchema,
  PasswordService,
  SessionService,
  JwtService,
  MFAService,
  OAuthService,
  AuthRateLimitService,
  AuthAuditService,
  DeviceFingerprintService,
  AuthService,
  OAuthProvider,
} from './index';
import * as publicApi from './public';

function createConfig(): AuthConfig {
  return {
    jwtAccessSecret: 'this-is-a-long-secret-for-access-tokens-32-chars-min',
    jwtRefreshSecret: 'this-is-a-long-secret-for-refresh-tokens-32-chars-min',
    jwtAccessExpiresSeconds: 900,
    jwtRefreshExpiresSeconds: 2592000,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    maxSessionsPerUser: 3,
    sessionTimeoutMinutes: 60,
    mfaEnabled: true,
  };
}

describe('PasswordService', () => {
  const service = new PasswordService(createConfig());

  it('hashes and verifies passwords', async () => {
    const hash = await service.hashPassword('StrongP@ssw0rd');
    expect(hash).not.toBe('StrongP@ssw0rd');
    expect(await service.verifyPassword('StrongP@ssw0rd', hash)).toBe(true);
    expect(await service.verifyPassword('wrong', hash)).toBe(false);
  });

  it('validates password strength', () => {
    expect(service.validatePassword('StrongP@ssw0rd').valid).toBe(true);
    expect(service.validatePassword('weak').valid).toBe(false);
    expect(service.validatePassword('weak').errors.length).toBeGreaterThan(0);
  });

  it('reports each configured strength rule', () => {
    const result = service.validatePassword('short');
    expect(result.errors).toEqual([
      'Password must be at least 8 characters',
      'Password must contain at least one uppercase letter',
      'Password must contain at least one number',
      'Password must contain at least one special character',
    ]);
    expect(service.validatePassword('ALLUPPERCASE1!').errors).toContain(
      'Password must contain at least one lowercase letter'
    );
  });

  it('supports optional strength rules and invalid hashes', async () => {
    const permissive = new PasswordService({
      ...createConfig(),
      passwordRequireUppercase: false,
      passwordRequireLowercase: false,
      passwordRequireNumbers: false,
      passwordRequireSpecialChars: false,
    });
    expect(permissive.validatePassword('abcdefgh').valid).toBe(true);
    expect(await permissive.verifyPassword('password', 'not-an-argon-hash')).toBe(false);
    expect(await permissive.isCommonPassword('password')).toBe(false);
  });
});

describe('SessionService', () => {
  const service = new SessionService(createConfig());

  it('creates and retrieves sessions', async () => {
    const session = await service.createSession('user-1');
    expect(session.id).toMatch(/^session_[0-9a-f-]{36}$/);
    expect(session.userId).toBe('user-1');
    expect(session.sessionVersion).toBe(1);
    const retrieved = await service.getSession(session.id);
    expect(retrieved?.id).toBe(session.id);
  });

  it('increments session version on invalidation', async () => {
    const session = await service.createSession('user-1');
    await service.invalidateSpecificSession(session.id);
    const retrieved = await service.getSession(session.id);
    expect(retrieved?.sessionVersion).toBe(2);
  });

  it('invalidates all user sessions', async () => {
    const s1 = await service.createSession('user-2');
    const s2 = await service.createSession('user-2');
    await service.invalidateSession('user-2');
    expect((await service.getSession(s1.id))?.sessionVersion).toBe(2);
    expect((await service.getSession(s2.id))?.sessionVersion).toBe(2);
  });

  it('removes expired sessions', async () => {
    const expiredService = new SessionService({ ...createConfig(), sessionTimeoutMinutes: -1 });
    const session = await expiredService.createSession('user-1');
    const retrieved = await expiredService.getSession(session.id);
    expect(retrieved).toBeNull();
  });

  it('handles missing sessions and ignores unknown invalidations', async () => {
    const isolated = new SessionService(createConfig());
    expect(await isolated.getSession('missing')).toBeNull();
    await expect(isolated.invalidateSpecificSession('missing')).resolves.toBeUndefined();
    await expect(isolated.removeOldestSession('missing-user')).resolves.toBeUndefined();
  });

  it('lists active sessions and detects the configured maximum', async () => {
    const isolated = new SessionService({ ...createConfig(), maxSessionsPerUser: 2 });
    expect(await isolated.hasTooManySessions('user')).toBe(false);
    await isolated.createSession('user', 'fingerprint', 'agent', '127.0.0.1');
    await isolated.createSession('user');
    await isolated.createSession('other');
    expect(await isolated.getUserSessions('user')).toHaveLength(2);
    expect(await isolated.hasTooManySessions('user')).toBe(true);
  });

  it('removes the oldest session and cleans expired entries', async () => {
    const isolated = new SessionService(createConfig());
    const oldest = await isolated.createSession('user');
    oldest.createdAt = new Date('2020-01-01T00:00:00.000Z');
    const newest = await isolated.createSession('user');
    newest.createdAt = new Date('2021-01-01T00:00:00.000Z');
    await isolated.removeOldestSession('user');
    expect(await isolated.getSession(oldest.id)).toBeNull();
    expect(await isolated.getSession(newest.id)).not.toBeNull();

    const expired = new SessionService({ ...createConfig(), sessionTimeoutMinutes: -1 });
    const expiredSession = await expired.createSession('user');
    await expired.cleanupExpiredSessions();
    expect(await expired.getSession(expiredSession.id)).toBeNull();
  });
});

describe('JwtService', () => {
  const service = new JwtService(createConfig());

  it('returns placeholders for tokens', async () => {
    const token = await service.generateAccessToken({
      sub: 'u1',
      email: 'u1@example.com',
      sessionVersion: 1,
    });
    expect(token).toBe('access_token_placeholder');
    const pair = await service.generateTokenPair('u1', 'u1@example.com', 1, 'session-1');
    expect(pair.accessToken).toBe('access_token_placeholder');
    expect(pair.refreshToken).toBe('refresh_token_placeholder');
    expect(pair.expiresIn).toBe(900);
  });

  it('covers refresh and verification adapters', async () => {
    expect(
      await service.generateRefreshToken({ sub: 'u1', sessionId: 's1', sessionVersion: 1 })
    ).toBe('refresh_token_placeholder');
    expect(await service.verifyAccessToken('token')).toEqual({});
    expect(await service.verifyRefreshToken('token')).toEqual({});
  });
});

describe('MFAService', () => {
  const service = new MFAService(createConfig());

  it('generates backup codes', async () => {
    const codes = await service.generateBackupCodes(5);
    expect(codes).toHaveLength(5);
    expect(new Set(codes).size).toBe(5);
    for (const code of codes) expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it('verifies and removes backup codes', async () => {
    const codes = ['ABC12345', 'DEF67890'];
    expect(await service.verifyBackupCode(codes, 'ABC12345')).toBe(true);
    expect(service.removeBackupCode(codes, 'ABC12345')).toEqual(['DEF67890']);
    expect(await service.verifyBackupCode(codes, 'missing')).toBe(false);
  });

  it('exposes placeholder MFA adapters and default backup count', async () => {
    expect(await service.generateSecret()).toBe('mfa_secret_placeholder');
    expect(await service.generateBackupCodes()).toHaveLength(10);
    expect(await service.verifyCode('secret', '123456')).toBe(false);
  });
});

describe('OAuthService', () => {
  const service = new OAuthService(createConfig());

  it('generates authorization URL', () => {
    expect(service.getAuthorizationUrl(OAuthProvider.GOOGLE, 'state-1')).toContain('state-1');
  });

  it('validates OAuth state', () => {
    expect(service.validateState('state-1', 'state-1')).toBe(true);
    expect(service.validateState('state-1', 'state-2')).toBe(false);
  });

  it('registers providers and returns typed placeholder responses', async () => {
    service.registerProvider(OAuthProvider.GITHUB, { clientId: 'example-client' });
    expect(await service.exchangeCodeForTokens(OAuthProvider.GITHUB, 'code')).toEqual({
      accessToken: 'access_token_placeholder',
    });
    expect(await service.getProfile(OAuthProvider.MICROSOFT, 'token')).toEqual({
      provider: OAuthProvider.MICROSOFT,
      providerId: 'provider_id_placeholder',
      email: 'user@example.com',
      name: 'User Name',
    });
  });
});

describe('AuthRateLimitService', () => {
  it('blocks after max attempts', async () => {
    const service = new AuthRateLimitService(2, 60000);
    const identifier = 'ip:127.0.0.1';
    expect((await service.checkRateLimit(identifier)).allowed).toBe(true);
    expect((await service.checkRateLimit(identifier)).allowed).toBe(true);
    const result = await service.checkRateLimit(identifier);
    expect(result.allowed).toBe(false);
    expect(result.retryAfter).toBeGreaterThan(0);
  });

  it('resets rate limit', async () => {
    const service = new AuthRateLimitService(2, 60000);
    const identifier = 'ip:127.0.0.1';
    await service.checkRateLimit(identifier);
    await service.checkRateLimit(identifier);
    service.resetRateLimit(identifier);
    expect((await service.checkRateLimit(identifier)).allowed).toBe(true);
  });

  it('cleans expired records and supports constructor defaults', async () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const service = new AuthRateLimitService(2, 10);
    await service.checkRateLimit('user');
    now.mockReturnValue(2_000);
    service.cleanup();
    expect((await service.checkRateLimit('user')).allowed).toBe(true);
    expect((await new AuthRateLimitService().checkRateLimit('default')).allowed).toBe(true);
    now.mockRestore();
  });
});

describe('AuthAuditService', () => {
  const service = new AuthAuditService();

  it('logs and filters events', () => {
    service.logEvent({
      timestamp: new Date().toISOString(),
      eventType: 'LOGIN',
      userId: 'user-1',
      success: true,
    });
    service.logEvent({
      timestamp: new Date().toISOString(),
      eventType: 'LOGOUT',
      userId: 'user-2',
      success: true,
    });
    expect(service.getUserEvents('user-1')).toHaveLength(1);
    expect(service.getRecentEvents(10)).toHaveLength(2);
  });

  it('uses the default recent-event limit and returns empty user history', () => {
    const isolated = new AuthAuditService();
    expect(isolated.getRecentEvents()).toEqual([]);
    expect(isolated.getUserEvents('missing')).toEqual([]);
  });
});

describe('DeviceFingerprintService', () => {
  const service = new DeviceFingerprintService();

  it('generates consistent fingerprints', () => {
    const fp1 = service.generateFingerprint('Mozilla/5.0', '127.0.0.1');
    const fp2 = service.generateFingerprint('Mozilla/5.0', '127.0.0.1');
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(64);
  });

  it('detects different fingerprints', () => {
    const fp1 = service.generateFingerprint('A', '1');
    const fp2 = service.generateFingerprint('B', '2');
    expect(service.compareFingerprints(fp1, fp2)).toBe(false);
    expect(service.compareFingerprints(fp1, fp1)).toBe(true);
  });
});

describe('AuthService', () => {
  const service = new AuthService(createConfig());

  it('returns sub-services', () => {
    expect(service.getPasswordService()).toBeInstanceOf(PasswordService);
    expect(service.getJwtService()).toBeInstanceOf(JwtService);
    expect(service.getSessionService()).toBeInstanceOf(SessionService);
    expect(service.getMfaService()).toBeInstanceOf(MFAService);
    expect(service.getOAuthService()).toBeInstanceOf(OAuthService);
    expect(service.getAuditService()).toBeInstanceOf(AuthAuditService);
  });

  it('fails authentication with placeholder hash', async () => {
    const result = await service.authenticate('user@example.com', 'password');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid credentials');
  });

  it('invalidates sessions on logout', async () => {
    const session = await service.getSessionService().createSession('user-1');
    await service.logout(session.id);
    const updated = await service.getSessionService().getSession(session.id);
    expect(updated?.sessionVersion).toBe(2);
  });

  it('authenticates when the password adapter succeeds', async () => {
    const isolated = new AuthService(createConfig());
    const password = jest
      .spyOn(isolated.getPasswordService(), 'verifyPassword')
      .mockResolvedValue(true);
    const result = await isolated.authenticate('user@example.com', 'Valid-Passw0rd!');
    expect(result.success).toBe(true);
    expect(result.tokenPair?.accessToken).toBe('access_token_placeholder');
    expect(isolated.getAuditService().getRecentEvents()).toHaveLength(1);
    password.mockRestore();
  });

  it('blocks authentication after the configured default limit', async () => {
    const isolated = new AuthService(createConfig());
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await isolated.authenticate('limited@example.com', 'bad')).error).toBe(
        'Invalid credentials'
      );
    }
    expect((await isolated.authenticate('limited@example.com', 'bad')).error).toBe(
      'Too many attempts'
    );
  });

  it('refreshes a valid session and rejects missing or invalidated sessions', async () => {
    const isolated = new AuthService(createConfig());
    const session = await isolated.getSessionService().createSession('user-1');
    const verify = jest.spyOn(isolated.getJwtService(), 'verifyRefreshToken');
    verify.mockResolvedValue({
      sub: 'user-1',
      sessionId: session.id,
      sessionVersion: 1,
    });
    expect((await isolated.refreshToken('valid')).success).toBe(true);

    verify.mockResolvedValue({ sub: 'user-1', sessionId: 'missing', sessionVersion: 1 });
    expect(await isolated.refreshToken('missing')).toEqual({
      success: false,
      error: 'Invalid session',
    });

    await isolated.getSessionService().invalidateSpecificSession(session.id);
    verify.mockResolvedValue({
      sub: 'user-1',
      sessionId: session.id,
      sessionVersion: 1,
    });
    expect(await isolated.refreshToken('invalidated')).toEqual({
      success: false,
      error: 'Session invalidated',
    });
    verify.mockRestore();
  });

  it('normalizes refresh verification failures and logs out all sessions', async () => {
    const isolated = new AuthService(createConfig());
    const session = await isolated.getSessionService().createSession('user-1');
    const verify = jest
      .spyOn(isolated.getJwtService(), 'verifyRefreshToken')
      .mockRejectedValue(new Error('bad token'));
    expect(await isolated.refreshToken('bad')).toEqual({ success: false, error: 'Invalid token' });
    verify.mockRestore();

    await isolated.logoutAll('user-1');
    expect((await isolated.getSessionService().getSession(session.id))?.sessionVersion).toBe(2);
  });
});

describe('Auth configuration schema', () => {
  it('accepts the runtime contract and rejects weak values', () => {
    expect(authConfigSchema.safeParse(createConfig()).success).toBe(true);
    expect(
      authConfigSchema.safeParse({ ...createConfig(), jwtAccessSecret: 'short' }).success
    ).toBe(false);
    expect(authConfigSchema.safeParse({ ...createConfig(), maxSessionsPerUser: 0 }).success).toBe(
      false
    );
  });
});

describe('Public API', () => {
  it('resolves every runtime export from the package entry point', () => {
    for (const key of Object.keys(publicApi) as Array<keyof typeof publicApi>) {
      expect(publicApi[key]).toBeDefined();
    }
    expect(publicApi.PasswordService).toBe(PasswordService);
  });
});
