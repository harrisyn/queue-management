import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

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
      // attach organizationId from invite if present
      if (invite.organizationId) {
        // ensure role assignment will include organizationId
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

    // Generate token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
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
