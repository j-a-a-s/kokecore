# @kokecore/storage

Multi-cloud storage abstraction with S3, Azure, GCS, and MinIO support.

## Features

- S3, Azure, GCS, MinIO providers
- Path traversal protection
- MIME type validation
- File size limits
- Presigned URL expiration clamping
- CDN integration
- Virus scan hooks

## Installation

```bash
pnpm add @kokecore/storage
```

## Usage

```typescript
import { StorageFactory, StorageProvider, EnhancedStorageService } from '@kokecore/storage';

const storage = StorageFactory.create({
  provider: StorageProvider.S3,
  awsRegion: 'us-east-1',
  awsS3Bucket: 'my-bucket',
});

const enhanced = new EnhancedStorageService(storage, config);
const result = await enhanced.createSecureUploadUrl({
  organizationId,
  resource: 'documents',
  resourceId,
  filename,
  contentType: 'application/pdf',
  contentLength: 1024,
});
```
