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
  AzureStorageService,
  GCSStorageService,
  MinIOStorageService,
  type CreateUploadUrlInput,
  type StorageConfig,
  type StorageService,
} from './index';
import * as publicApi from './public';

function createInput(overrides: Partial<CreateUploadUrlInput> = {}): CreateUploadUrlInput {
  return {
    organizationId: randomUUID(),
    resource: 'invoices',
    resourceId: randomUUID(),
    filename: 'document.pdf',
    contentType: 'application/pdf',
    contentLength: 1024,
    ...overrides,
  };
}

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

  it('rejects invalid resources and file sizes', () => {
    const config: StorageConfig = { provider: StorageProvider.S3, maxFileSizeBytes: 100 };
    expect(() => buildStorageKey(createInput({ resource: '../private' }), config)).toThrow(
      'Invalid storage resource'
    );
    expect(() => buildStorageKey(createInput({ contentLength: 0 }), config)).toThrow(
      'Invalid file size'
    );
    expect(() => buildStorageKey(createInput({ contentLength: 101 }), config)).toThrow(
      'Invalid file size'
    );
  });

  it('uses custom MIME allowlists', () => {
    const config: StorageConfig = {
      provider: StorageProvider.S3,
      allowedMimeTypes: ['application/custom'],
    };
    expect(buildStorageKey(createInput({ contentType: 'application/custom' }), config)).toContain(
      '/invoices/'
    );
  });

  it('sanitizes dangerous filenames', () => {
    expect(sanitizeFilename('../../../etc/passwd')).not.toContain('..');
    expect(sanitizeFilename('hello world!.pdf')).toContain('hello-world');
    expect(() => sanitizeFilename('')).toThrow('Invalid filename');
    expect(() => sanitizeFilename('..')).toThrow('Invalid filename');
    expect(sanitizeFilename('á'.repeat(140) + '.pdf').length).toBeLessThanOrEqual(120);
  });

  it('clamps expiration to safe range', () => {
    expect(clampExpiration(30)).toBe(60);
    expect(clampExpiration(600)).toBe(600);
    expect(clampExpiration(1000)).toBe(900);
    expect(clampExpiration(undefined)).toBe(300);
    expect(() => clampExpiration(60.5)).toThrow('must be an integer');
  });

  it('validates MIME types from a set', () => {
    const allowed = new Set(['application/pdf', 'image/png']);
    expect(validateMimeType('image/png', allowed)).toBe(true);
    expect(validateMimeType('text/plain', allowed)).toBe(false);
  });

  it('detects MIME type from filename', () => {
    expect(detectMimeType('report.pdf')).toBe('application/pdf');
    expect(detectMimeType('photo.PNG')).toBe('image/png');
    expect(detectMimeType('photo.jpeg')).toBe('image/jpeg');
    expect(detectMimeType('photo.gif')).toBe('image/gif');
    expect(detectMimeType('photo.webp')).toBe('image/webp');
    expect(detectMimeType('notes.txt')).toBe('text/plain');
    expect(detectMimeType('table.csv')).toBe('text/csv');
    expect(detectMimeType('data.json')).toBe('application/json');
    expect(detectMimeType('unknown.xyz')).toBe('application/octet-stream');
  });

  it('asserts safe storage keys', () => {
    expect(() => assertSafeStorageKey('organizations/test/file.pdf')).not.toThrow();
    expect(() => assertSafeStorageKey('organizations/../etc/passwd')).toThrow('path traversal');
    expect(() => assertSafeStorageKey('organizations/test/..')).toThrow('path traversal');
    expect(() => assertSafeStorageKey('outside/file.pdf')).toThrow('must start with organizations');
    expect(() => assertSafeStorageKey('organizations/test\\private\\file.pdf')).toThrow(
      'path traversal'
    );
    expect(() => assertSafeStorageKey('organizations/test/\0file.pdf')).toThrow('null byte');
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
    expect(() => StorageFactory.create({ provider: 'UNKNOWN' as StorageProvider })).toThrow(
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
    const storage: StorageService = {
      createUploadUrl: jest.fn(),
      createDownloadUrl: jest.fn(),
      deleteObject: jest.fn(),
      objectExists: jest.fn(),
      getObjectMetadata: jest.fn(),
    };
    const service = new EnhancedStorageService(storage, { provider: StorageProvider.S3 });
    const result = await service.scanForVirus('key');
    expect(result.clean).toBe(true);
    expect(result.scannedAt).toBeInstanceOf(Date);
  });

  it.each([
    [
      StorageProvider.S3,
      S3StorageService,
      {
        provider: StorageProvider.S3,
        awsRegion: 'us-east-1',
        awsS3Bucket: 'bucket',
      },
      's3.us-east-1.amazonaws.com',
    ],
    [
      StorageProvider.AZURE,
      AzureStorageService,
      { provider: StorageProvider.AZURE, azureContainerName: 'container' },
      'container.blob.core.windows.net',
    ],
    [
      StorageProvider.GCS,
      GCSStorageService,
      { provider: StorageProvider.GCS, gcsBucketName: 'bucket' },
      'storage.googleapis.com/bucket',
    ],
    [
      StorageProvider.MINIO,
      MinIOStorageService,
      {
        provider: StorageProvider.MINIO,
        awsS3Endpoint: 'http://localhost:9000',
        awsS3Bucket: 'bucket',
      },
      'localhost:9000/bucket',
    ],
  ] as const)(
    'exercises the %s provider contract',
    async (_provider, ServiceClass, config, expectedHost) => {
      const service = StorageFactory.create(config);
      expect(service).toBeInstanceOf(ServiceClass);
      const upload = await service.createUploadUrl(createInput({ expiresInSeconds: 120 }));
      expect(upload.uploadUrl).toContain(expectedHost);
      expect(upload.expiresInSeconds).toBe(120);
      expect(await service.createDownloadUrl({ key: upload.key, expiresInSeconds: 120 })).toContain(
        expectedHost
      );
      await expect(service.deleteObject(upload.key)).resolves.toBeUndefined();
      await expect(service.objectExists(upload.key)).resolves.toBe(false);
      await expect(service.getObjectMetadata(upload.key)).resolves.toMatchObject({
        key: upload.key,
        size: 0,
        contentType: 'application/octet-stream',
      });
    }
  );

  it('uses provider fallbacks and enhanced upload/download hooks', async () => {
    const config: StorageConfig = { provider: StorageProvider.MINIO };
    const storage = new MinIOStorageService(config);
    const upload = await storage.createUploadUrl(createInput());
    expect(upload.uploadUrl).toMatch(/^\/\/organizations\//);
    expect(await storage.createDownloadUrl({ key: upload.key })).toMatch(/^\/\/organizations\//);

    const enhanced = new EnhancedStorageService(storage, config);
    await expect(
      enhanced.createSecureUploadUrl(createInput(), {
        requireVirusScan: true,
        optimizeImage: { width: 100, height: 100 },
      })
    ).resolves.toMatchObject({ expiresInSeconds: 300 });
    expect(await enhanced.createCdnDownloadUrl({ key: upload.key })).not.toContain('cdn.');
    expect(await enhanced.optimizeImage(upload.key, { quality: 80, format: 'webp' })).toBe(
      upload.key
    );
  });
});

describe('Public API', () => {
  it('resolves every runtime export from the package entry point', () => {
    for (const key of Object.keys(publicApi) as Array<keyof typeof publicApi>) {
      expect(publicApi[key]).toBeDefined();
    }
    expect(publicApi.StorageProvider).toBe(StorageProvider);
  });
});
