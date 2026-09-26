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
    form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);

    const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
    if (!res.ok) {
      throw new Error(`Uploadcare upload failed: ${res.status} ${await res.text()}`);
    }
    const body = await res.json() as { file: string };
    return { fileId: body.file, url: `https://ucarecdn.com/${body.file}/` };
  }

  directUploadConfig() {
    return this.publicKey ? { provider: this.name, publicKey: this.publicKey } : null;
  }

  async confirmDirectUpload(fileId: string) {
    const headers = {
      Authorization: `Uploadcare.Simple ${this.publicKey}:${this.secretKey}`,
      Accept: 'application/vnd.uploadcare-v0.7+json',
    };
    // Storing is done here, with the secret key, so the project never has
    // to allow browsers to store files themselves.
    const stored = await fetch(`${API_BASE_URL}/files/${fileId}/storage/`, { method: 'PUT', headers });
    if (!stored.ok) throw new Error(`Uploadcare store failed: ${stored.status} ${await stored.text()}`);
    const info = (await stored.json().catch(() => ({}))) as { mime_type?: string; size?: number };
    return { url: `https://ucarecdn.com/${fileId}/`, mimeType: info.mime_type ?? null, size: info.size ?? null };
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
