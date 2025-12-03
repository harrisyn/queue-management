import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';

export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, role } = req.query;

    const whereClause: any = {};
    if (organizationId) whereClause.organizationId = organizationId;
    if (role) whereClause.role = role;

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        organizationId: true,
        createdAt: true,
      },
    });

    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const getUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        organization: true,
        identityData: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, phone, role, organizationId } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phone,
        role: role || 'PATIENT',
        organizationId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, role, isActive } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { firstName, lastName, phone, role, isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    res.json(user);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        organizationId: true,
        organization: true,
        isActive: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    next(error);
  }
};

// Assign practitioner to service
export const assignPractitioner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, serviceId } = req.body;

    const practitioner = await prisma.practitioner.create({
      data: { userId, serviceId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        service: true,
      },
    });

    res.status(201).json(practitioner);
  } catch (error) {
    next(error);
  }
};

export const removePractitioner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, serviceId } = req.params;

    await prisma.practitioner.delete({
      where: {
        userId_serviceId: { userId, serviceId },
      },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Update user identity data
export const updateUserIdentity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { identityData } = req.body;

    if (!identityData || typeof identityData !== 'object') {
      return res.status(400).json({ error: 'identityData must be an object' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Merge with existing identity data
    const existingData = (user.identityData as Record<string, unknown>) || {};
    const mergedData = { ...existingData, ...identityData };

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { identityData: mergedData },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        identityData: true,
      },
    });

    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
};
