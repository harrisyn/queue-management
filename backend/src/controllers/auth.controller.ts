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
    const { email, password, slug, adminLogin } = req.body;

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

    // Subdomain-scoped login: verify the user is allowed in this context.
    if (adminLogin) {
      if (user.role !== 'SUPER_ADMIN') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } else if (slug) {
      const org = await prisma.organization.findUnique({ where: { slug } });
      if (!org || user.organizationId !== org.id) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
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
        role: user.role,
        organizationId: user.organizationId
      }
    });
  } catch (error) {
    next(error);
  }
};

// Send OTP for email verification
export const sendOTP = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if email already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const { sendOTPEmail } = require('../utils/email');
    const result = await sendOTPEmail(email.toLowerCase().trim());

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    res.json({ 
      success: true, 
      message: 'Verification code sent to your email',
      // In development, include preview info
      ...(process.env.NODE_ENV !== 'production' && { dev: true })
    });
  } catch (error) {
    next(error);
  }
};

// Verify OTP code
export const verifyOTPCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: 'Email and verification code are required' });
    }

    const { verifyOTP } = require('../utils/email');
    const result = verifyOTP(email.toLowerCase().trim(), code);

    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      success: true, 
      verified: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    next(error);
  }
};
