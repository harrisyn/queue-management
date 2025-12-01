import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const createOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone } = req.body;

    const organization = await prisma.organization.create({
      data: { name, email, phone },
    });

    res.status(201).json(organization);
  } catch (error) {
    next(error);
  }
};

export const getOrganizations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const organizations = await prisma.organization.findMany({
      include: {
        locations: true,
        _count: { select: { users: true, locations: true } },
      },
    });

    res.json(organizations);
  } catch (error) {
    next(error);
  }
};

export const getOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        locations: {
          include: { services: true },
        },
        users: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(organization);
  } catch (error) {
    next(error);
  }
};

export const updateOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, email, phone } = req.body;

    const organization = await prisma.organization.update({
      where: { id },
      data: { name, email, phone },
    });

    res.json(organization);
  } catch (error) {
    next(error);
  }
};

export const deleteOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.organization.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
