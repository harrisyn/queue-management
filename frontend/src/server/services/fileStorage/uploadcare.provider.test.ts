import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UploadcareProvider } from './uploadcare.provider';

describe('UploadcareProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('uploadFile', () => {
    it('posts a multipart form to the upload endpoint and derives the CDN url from the returned file id', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ file: 'abc-123' }),
      });
      global.fetch = mockFetch as any;

      const provider = new UploadcareProvider('pub_key', 'secret_key');
      const result = await provider.uploadFile(Buffer.from('fake image data'), 'logo.png', 'image/png');

      expect(result).toEqual({ fileId: 'abc-123', url: 'https://ucarecdn.com/abc-123/' });
      expect(mockFetch).toHaveBeenCalledWith('https://upload.uploadcare.com/base/', expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }));

      const [, options] = mockFetch.mock.calls[0];
      const form = options.body as FormData;
      expect(form.get('UPLOADCARE_PUB_KEY')).toBe('pub_key');
      expect(form.get('UPLOADCARE_STORE')).toBe('1');
      expect(form.get('file')).toBeInstanceOf(Blob);
    });

    it('throws with the response status and body when the upload fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad request',
      }) as any;

      const provider = new UploadcareProvider('pub_key', 'secret_key');

      await expect(provider.uploadFile(Buffer.from('x'), 'logo.png', 'image/png')).rejects.toThrow(/400/);
    });
  });

  describe('deleteFile', () => {
    it('calls the delete endpoint with the correct auth header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch as any;

      const provider = new UploadcareProvider('pub_key', 'secret_key');
      await provider.deleteFile('abc-123');

      expect(mockFetch).toHaveBeenCalledWith('https://api.uploadcare.com/files/abc-123/storage/', {
        method: 'DELETE',
        headers: {
          Authorization: 'Uploadcare.Simple pub_key:secret_key',
          Accept: 'application/vnd.uploadcare-v0.7+json',
        },
      });
    });

    it('does not throw when the file is already gone (404)', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => 'Not found' }) as any;

      const provider = new UploadcareProvider('pub_key', 'secret_key');

      await expect(provider.deleteFile('abc-123')).resolves.toBeUndefined();
    });

    it('throws on other failures', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'Server error' }) as any;

      const provider = new UploadcareProvider('pub_key', 'secret_key');

      await expect(provider.deleteFile('abc-123')).rejects.toThrow(/500/);
    });
  });
});
