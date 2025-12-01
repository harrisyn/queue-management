import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const createLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.params;
    const { name, address, timezone, publicCode } = req.body;

    const location = await prisma.location.create({
      data: {
        organizationId,
        name,
        address,
        timezone: timezone || 'UTC',
        publicCode: publicCode || null,
      },
    });

    res.status(201).json(location);
  } catch (error) {
    next(error);
  }
};

export const getLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.params;

    const locations = await prisma.location.findMany({
      where: { organizationId },
      include: {
        services: true,
        _count: { select: { services: true } },
      },
    });

    res.json(locations);
  } catch (error) {
    next(error);
  }
};

export const getLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        organization: true,
        services: {
          include: {
            practitioners: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
      },
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(location);
  } catch (error) {
    next(error);
  }
};

export const updateLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, address, timezone, publicCode } = req.body;

    const location = await prisma.location.update({
      where: { id },
      data: { name, address, timezone, publicCode },
    });

    res.json(location);
  } catch (error) {
    next(error);
  }
};

export const deleteLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.location.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Public listing of locations with publicCode for customers
export const getPublicLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locations = await prisma.location.findMany({
      where: { publicCode: { not: null } },
      select: { id: true, name: true, publicCode: true, organization: { select: { id: true, name: true } }, _count: { select: { services: true } } },
    });

    res.json(locations);
  } catch (error) {
    next(error);
  }
};
