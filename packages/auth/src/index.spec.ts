import {
  AuthConfig,
  UserStatus,
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
});

describe('SessionService', () => {
  const service = new SessionService(createConfig());

  it('creates and retrieves sessions', async () => {
    const session = await service.createSession('user-1');
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
    expect(pair.expiresIn).toBe(900);
  });
});

describe('MFAService', () => {
  const service = new MFAService(createConfig());

  it('generates backup codes', async () => {
    const codes = await service.generateBackupCodes(5);
    expect(codes).toHaveLength(5);
    expect(codes[0]).toHaveLength(8);
  });

  it('verifies and removes backup codes', async () => {
    const codes = ['ABC12345', 'DEF67890'];
    expect(await service.verifyBackupCode(codes, 'ABC12345')).toBe(true);
    expect(service.removeBackupCode(codes, 'ABC12345')).toEqual(['DEF67890']);
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
  });
});

describe('AuthService', () => {
  const service = new AuthService(createConfig());

  it('returns sub-services', () => {
    expect(service.getPasswordService()).toBeInstanceOf(PasswordService);
    expect(service.getSessionService()).toBeInstanceOf(SessionService);
    expect(service.getMfaService()).toBeInstanceOf(MFAService);
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
});
