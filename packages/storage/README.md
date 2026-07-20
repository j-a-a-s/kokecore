# @kokecore/storage

Internal storage boundary and security helpers. Provider implementations are
not approved for production use during Alpha.

## Features

- S3, Azure, GCS, MinIO providers
- Path traversal protection
- MIME type validation
- File size limits
- Presigned URL expiration clamping
- CDN integration
- Virus scan hooks

## Internal consumption

Install only from a CI-validated internal tarball. Public registry installation
is prohibited.

## Usage

```typescript
import { buildStorageKey, StorageProvider } from '@kokecore/storage';

const config = {
  provider: StorageProvider.S3,
  awsRegion: 'us-east-1',
  awsS3Bucket: 'my-bucket',
};

const key = buildStorageKey(
  {
    organizationId,
    resource: 'documents',
    resourceId,
    filename,
    contentType: 'application/pdf',
    contentLength: 1024,
  },
  config
);
```
