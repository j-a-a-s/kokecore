import { randomUUID } from 'crypto';
import {
  StorageProvider,
  buildStorageKey,
  assertSafeStorageKey,
  clampExpiration,
  sanitizeFilename,
  validateMimeType,
  detectMimeType,
  StorageFactory,
  EnhancedStorageService,
  S3StorageService,
} from './index';

describe('Storage security helpers', () => {
  it('builds safe storage keys', () => {
    const config = {
      provider: StorageProvider.S3,
      awsRegion: 'us-east-1',
      awsS3Bucket: 'test-bucket',
    };
    const input = {
      organizationId: randomUUID(),
      resource: 'invoices',
      resourceId: randomUUID(),
      filename: '  my-document.pdf  ',
      contentType: 'application/pdf',
      contentLength: 1024,
    };
    const key = buildStorageKey(input, config);
    expect(key).toMatch(
      /^organizations\/[0-9a-f-]+\/invoices\/[0-9a-f-]+\/[0-9a-f-]+-my-document\.pdf$/
    );
  });

  it('rejects invalid UUIDs', () => {
    const config = {
      provider: StorageProvider.S3,
      awsRegion: 'us-east-1',
      awsS3Bucket: 'test-bucket',
    };
    const input = {
      organizationId: 'not-a-uuid',
      resource: 'invoices',
      resourceId: randomUUID(),
      filename: 'file.pdf',
      contentType: 'application/pdf',
      contentLength: 1024,
    };
    expect(() => buildStorageKey(input, config)).toThrow('Invalid storage scope');
  });

  it('rejects disallowed MIME types', () => {
    const config = {
      provider: StorageProvider.S3,
      awsRegion: 'us-east-1',
      awsS3Bucket: 'test-bucket',
    };
    const input = {
      organizationId: randomUUID(),
      resource: 'invoices',
      resourceId: randomUUID(),
      filename: 'file.exe',
      contentType: 'application/x-msdownload',
      contentLength: 1024,
    };
    expect(() => buildStorageKey(input, config)).toThrow('Invalid file type');
  });

  it('sanitizes dangerous filenames', () => {
    expect(sanitizeFilename('../../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilename('hello world!.pdf')).toContain('hello-world');
    expect(() => sanitizeFilename('')).toThrow('Invalid filename');
  });

  it('clamps expiration to safe range', () => {
    expect(clampExpiration(30)).toBe(60);
    expect(clampExpiration(600)).toBe(600);
    expect(clampExpiration(1000)).toBe(900);
    expect(clampExpiration(undefined)).toBe(300);
  });

  it('validates MIME types from a set', () => {
    const allowed = new Set(['application/pdf', 'image/png']);
    expect(validateMimeType('image/png', allowed)).toBe(true);
    expect(validateMimeType('text/plain', allowed)).toBe(false);
  });

  it('detects MIME type from filename', () => {
    expect(detectMimeType('report.pdf')).toBe('application/pdf');
    expect(detectMimeType('photo.PNG')).toBe('image/png');
    expect(detectMimeType('unknown.xyz')).toBe('application/octet-stream');
  });

  it('asserts safe storage keys', () => {
    expect(() => assertSafeStorageKey('organizations/test/file.pdf')).not.toThrow();
    expect(() => assertSafeStorageKey('organizations/../etc/passwd')).toThrow('path traversal');
    expect(() => assertSafeStorageKey('organizations/test/..')).toThrow('path traversal');
  });
});

describe('Storage factory and services', () => {
  it('creates an S3 storage service', () => {
    const config = {
      provider: StorageProvider.S3,
      awsRegion: 'us-east-1',
      awsS3Bucket: 'test-bucket',
    };
    const service = StorageFactory.create(config);
    expect(service).toBeInstanceOf(S3StorageService);
  });

  it('throws for unsupported providers', () => {
    expect(() => StorageFactory.create({ provider: 'UNKNOWN' as any })).toThrow(
      'Unsupported storage provider'
    );
  });

  it('generates a presigned upload URL', async () => {
    const config = {
      provider: StorageProvider.S3,
      awsRegion: 'us-east-1',
      awsS3Bucket: 'test-bucket',
    };
    const service = StorageFactory.create(config);
    const input = {
      organizationId: randomUUID(),
      resource: 'invoices',
      resourceId: randomUUID(),
      filename: 'doc.pdf',
      contentType: 'application/pdf',
      contentLength: 1024,
    };
    const result = await service.createUploadUrl(input);
    expect(result.key).toMatch(/^organizations/);
    expect(result.uploadUrl).toContain('test-bucket');
    expect(result.expiresInSeconds).toBe(300);
  });

  it('generates a CDN download URL when CloudFront is enabled', async () => {
    const config = {
      provider: StorageProvider.S3,
      awsRegion: 'us-east-1',
      awsS3Bucket: 'test-bucket',
      awsCloudFrontDomain: 'cdn.example.com',
      cdnEnabled: true,
    };
    const storage = new S3StorageService(config);
    const enhanced = new EnhancedStorageService(storage, config);
    const key = 'organizations/test/resource/file.pdf';
    const url = await enhanced.createCdnDownloadUrl({ key });
    expect(url).toContain('cdn.example.com');
  });

  it('reports a clean virus scan result', async () => {
    const service = new EnhancedStorageService(null as any, { provider: StorageProvider.S3 });
    const result = await service.scanForVirus('key');
    expect(result.clean).toBe(true);
    expect(result.scannedAt).toBeInstanceOf(Date);
  });
});
