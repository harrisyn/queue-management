import { FileStorageProvider, UploadedFile } from './types';

const UPLOAD_URL = 'https://upload.uploadcare.com/base/';
const API_BASE_URL = 'https://api.uploadcare.com';

export class UploadcareProvider implements FileStorageProvider {
  name = 'uploadcare' as const;
  private publicKey: string;
  private secretKey: string;

  constructor(publicKey: string, secretKey: string) {
    this.publicKey = publicKey;
    this.secretKey = secretKey;
  }

  async uploadFile(buffer: Buffer, filename: string, mimeType: string): Promise<UploadedFile> {
    const form = new FormData();
    form.append('UPLOADCARE_PUB_KEY', this.publicKey);
    form.append('UPLOADCARE_STORE', '1');
    form.append('file', new Blob([buffer], { type: mimeType }), filename);

    const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    if (!res.ok) {
      throw new Error(`Uploadcare upload failed: ${res.status} ${await res.text()}`);
    }
    const body = await res.json() as { file: string };
    return { fileId: body.file, url: `https://ucarecdn.com/${body.file}/` };
  }

  async deleteFile(fileId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/files/${fileId}/storage/`, {
      method: 'DELETE',
      headers: {
        Authorization: `Uploadcare.Simple ${this.publicKey}:${this.secretKey}`,
        Accept: 'application/vnd.uploadcare-v0.7+json',
      },
    });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Uploadcare delete failed: ${res.status} ${await res.text()}`);
    }
  }
}
