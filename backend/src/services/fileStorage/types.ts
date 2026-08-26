export type FileStorageProviderName = 'uploadcare';

export interface UploadedFile {
  fileId: string;
  url: string;
}

export interface FileStorageProvider {
  name: FileStorageProviderName;
  uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<UploadedFile>;
  deleteFile(fileId: string): Promise<void>;
}

export class FileStorageProviderNotActiveError extends Error {
  constructor(provider: string) {
    super(`File storage provider "${provider}" is not configured or not active`);
    this.name = 'FileStorageProviderNotActiveError';
  }
}
