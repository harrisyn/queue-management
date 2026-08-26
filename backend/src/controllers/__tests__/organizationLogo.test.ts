import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    organization: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../services/fileStorage', () => ({
  getActiveFileStorageProvider: vi.fn(),
}));

import prisma from '../../lib/prisma';
import { getActiveFileStorageProvider } from '../../services/fileStorage';
import { uploadOrganizationLogo } from '../organization.controller';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  return {
    fieldname: 'logo',
    originalname: 'logo.png',
    mimetype: 'image/png',
    buffer: Buffer.from('fake image data'),
    size: 1024,
    ...overrides,
  } as Express.Multer.File;
}

describe('uploadOrganizationLogo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects when no file was uploaded', async () => {
    const req: any = { params: { id: 'org1' }, file: undefined };
    const res = makeRes();
    await uploadOrganizationLogo(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a disallowed mime type', async () => {
    const req: any = { params: { id: 'org1' }, file: makeFile({ mimetype: 'application/pdf' }) };
    const res = makeRes();
    await uploadOrganizationLogo(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(getActiveFileStorageProvider).not.toHaveBeenCalled();
  });

  it('400s when no file storage provider is configured', async () => {
    (getActiveFileStorageProvider as any).mockResolvedValue(null);
    const req: any = { params: { id: 'org1' }, file: makeFile() };
    const res = makeRes();
    await uploadOrganizationLogo(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404s when the organization does not exist', async () => {
    (getActiveFileStorageProvider as any).mockResolvedValue({ uploadFile: vi.fn(), deleteFile: vi.fn() });
    (prisma.organization.findUnique as any).mockResolvedValue(null);
    const req: any = { params: { id: 'org1' }, file: makeFile() };
    const res = makeRes();
    await uploadOrganizationLogo(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('uploads the file and saves the resulting url/fileId, with no previous logo to delete', async () => {
    const uploadFile = vi.fn().mockResolvedValue({ fileId: 'file-2', url: 'https://ucarecdn.com/file-2/' });
    const deleteFile = vi.fn();
    (getActiveFileStorageProvider as any).mockResolvedValue({ uploadFile, deleteFile });
    (prisma.organization.findUnique as any).mockResolvedValue({ logoFileId: null });
    (prisma.organization.update as any).mockResolvedValue({ id: 'org1', logoUrl: 'https://ucarecdn.com/file-2/' });

    const req: any = { params: { id: 'org1' }, file: makeFile() };
    const res = makeRes();
    await uploadOrganizationLogo(req, res, vi.fn());

    expect(uploadFile).toHaveBeenCalledWith(expect.any(Buffer), 'logo.png', 'image/png');
    expect(deleteFile).not.toHaveBeenCalled();
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: { logoUrl: 'https://ucarecdn.com/file-2/', logoFileId: 'file-2' },
      select: { id: true, logoUrl: true },
    });
    expect(res.json).toHaveBeenCalledWith({ id: 'org1', logoUrl: 'https://ucarecdn.com/file-2/' });
  });

  it('deletes the previous logo file when replacing an existing one', async () => {
    const uploadFile = vi.fn().mockResolvedValue({ fileId: 'file-new', url: 'https://ucarecdn.com/file-new/' });
    const deleteFile = vi.fn().mockResolvedValue(undefined);
    (getActiveFileStorageProvider as any).mockResolvedValue({ uploadFile, deleteFile });
    (prisma.organization.findUnique as any).mockResolvedValue({ logoFileId: 'file-old' });
    (prisma.organization.update as any).mockResolvedValue({ id: 'org1', logoUrl: 'https://ucarecdn.com/file-new/' });

    const req: any = { params: { id: 'org1' }, file: makeFile() };
    const res = makeRes();
    await uploadOrganizationLogo(req, res, vi.fn());

    expect(deleteFile).toHaveBeenCalledWith('file-old');
  });

  it('does not fail the request if deleting the old logo file errors', async () => {
    const uploadFile = vi.fn().mockResolvedValue({ fileId: 'file-new', url: 'https://ucarecdn.com/file-new/' });
    const deleteFile = vi.fn().mockRejectedValue(new Error('already gone'));
    (getActiveFileStorageProvider as any).mockResolvedValue({ uploadFile, deleteFile });
    (prisma.organization.findUnique as any).mockResolvedValue({ logoFileId: 'file-old' });
    (prisma.organization.update as any).mockResolvedValue({ id: 'org1', logoUrl: 'https://ucarecdn.com/file-new/' });

    const req: any = { params: { id: 'org1' }, file: makeFile() };
    const res = makeRes();
    await uploadOrganizationLogo(req, res, vi.fn());

    expect(res.json).toHaveBeenCalledWith({ id: 'org1', logoUrl: 'https://ucarecdn.com/file-new/' });
  });

  it('returns 502 without leaking the raw provider error when upload fails', async () => {
    const uploadFile = vi.fn().mockRejectedValue(new Error('Uploadcare said no'));
    (getActiveFileStorageProvider as any).mockResolvedValue({ uploadFile, deleteFile: vi.fn() });
    (prisma.organization.findUnique as any).mockResolvedValue({ logoFileId: null });

    const req: any = { params: { id: 'org1' }, file: makeFile() };
    const res = makeRes();
    await uploadOrganizationLogo(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'File storage provider temporarily unavailable. Please try again shortly.' });
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });
});
