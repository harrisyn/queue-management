import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

const VALID_RESOURCE_TYPES = ['LOCATIONS', 'USERS', 'DISPLAY_MEDIA'];

export const listAddOnPricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.addOnPricing.findMany({ orderBy: { resourceType: 'asc' } });
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

export const updateAddOnPricing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resourceType } = req.params;
    if (!VALID_RESOURCE_TYPES.includes(resourceType)) {
      return res.status(400).json({ error: 'Unknown resourceType' });
    }

    const { pricePerUnitMonthly, pricePerUnitOneOff, currency } = req.body as {
      pricePerUnitMonthly: number;
      pricePerUnitOneOff: number;
      currency?: string;
    };

    if (typeof pricePerUnitMonthly !== 'number' || pricePerUnitMonthly < 0) {
      return res.status(400).json({ error: 'pricePerUnitMonthly must be a non-negative number' });
    }
    if (typeof pricePerUnitOneOff !== 'number' || pricePerUnitOneOff < 0) {
      return res.status(400).json({ error: 'pricePerUnitOneOff must be a non-negative number' });
    }

    const updated = await prisma.addOnPricing.update({
      where: { resourceType: resourceType as 'LOCATIONS' | 'USERS' | 'DISPLAY_MEDIA' },
      data: {
        pricePerUnitMonthly,
        pricePerUnitOneOff,
        ...(currency ? { currency } : {}),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};
