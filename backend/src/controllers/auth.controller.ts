import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
    },
  });
  return token;
}

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, role, inviteToken } = req.body;

    // Registration mode: 'open' | 'invite' (default invite)
    const mode = process.env.REGISTRATION_MODE || 'invite';

    let inviteRecord: any = null;
    if (mode !== 'open') {
      // invite-based registration required for non-open mode
      if (!inviteToken) {
        return res.status(403).json({ error: 'Registration is invite-only. Please provide an invite token.' });
      }

      inviteRecord = await prisma.invite.findUnique({ where: { code: inviteToken } });
      if (!inviteRecord) return res.status(403).json({ error: 'Invalid invite token' });
      if (inviteRecord.used) return res.status(403).json({ error: 'Invite token already used' });
      if (inviteRecord.expiresAt && inviteRecord.expiresAt.getTime() < Date.now()) return res.status(403).json({ error: 'Invite token expired' });
      if (inviteRecord.role && role && inviteRecord.role !== role) {
        return res.status(403).json({ error: 'Invite does not allow requested role' });
      }
    }

    // Do not allow patients to register through the operator registration endpoint
    if (!role || role === 'PATIENT') {
      return res.status(403).json({ error: 'Patient accounts are not created via this endpoint. Use the public join pages to participate in queues.' });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || inviteRecord?.role || 'PATIENT',
        organizationId: inviteRecord?.organizationId || undefined,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    res.status(201).json({ user });

    // mark invite used
    if (inviteToken) {
      try {
        await prisma.invite.update({ where: { code: inviteToken }, data: { used: true } });
      } catch (_) { /* ignore */ }
    }
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate short-lived access token + long-lived refresh token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );

    const refresh = await createRefreshToken(user.id);

    res.json({
      token,
      refreshToken: refresh,
      expiresIn: 15 * 60, // seconds
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const stored = await prisma.refreshToken.findUnique({ where: { token } });

    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({
      where: { id: stored.userId },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or deactivated' });
    }

    // Rotate: revoke the consumed token and issue a new pair
    await prisma.refreshToken.update({ where: { token }, data: { revoked: true } });
    const newAccessToken = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
    const newRefreshToken = await createRefreshToken(user.id);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 15 * 60,
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = req.body;

    if (token) {
      await prisma.refreshToken.updateMany({
        where: { token },
        data: { revoked: true },
      });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
