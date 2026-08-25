import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { getProvider, ProviderNotActiveError } from '../services/payments';
import { ProviderName, AddOnResourceType, AddOnBillingMode } from '../services/payments/types';

export const createAddOnCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { resourceType, quantity, billingMode, provider } = req.body as {
      resourceType: AddOnResourceType;
      quantity: number;
      billingMode: AddOnBillingMode;
      provider: ProviderName;
    };

    if (resourceType !== 'LOCATIONS' && resourceType !== 'USERS') {
      return res.status(400).json({ error: 'resourceType must be LOCATIONS or USERS' });
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ error: 'quantity must be a positive integer' });
    }
    if (billingMode !== 'recurring' && billingMode !== 'one_off') {
      return res.status(400).json({ error: 'billingMode must be recurring or one_off' });
    }
    if (!provider) {
      return res.status(400).json({ error: 'provider is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User has no organization' });
    }

    const pricing = await prisma.addOnPricing.findUnique({ where: { resourceType } });
    if (!pricing) {
      return res.status(500).json({ error: 'Add-on pricing is not configured' });
    }

    let paymentProvider;
    try {
      paymentProvider = await getProvider(provider);
    } catch (err) {
      if (err instanceof ProviderNotActiveError) {
        return res.status(400).json({ error: err.message });
      }
      throw err;
    }

    const unitPrice = billingMode === 'recurring' ? Number(pricing.pricePerUnitMonthly) : Number(pricing.pricePerUnitOneOff);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8003';

    let redirectUrl: string;
    try {
      const result = await paymentProvider.createAddOnCheckoutSession({
        organizationId: user.organizationId,
        resourceType,
        quantity,
        billingMode,
        unitPrice,
        currency: pricing.currency,
        successUrl: `${frontendUrl}/admin/billing?addon=success`,
        cancelUrl: `${frontendUrl}/admin/billing?addon=cancelled`,
      });
      redirectUrl = result.redirectUrl;
    } catch (err) {
      // Don't leak raw provider errors (e.g. a revoked key) to the tenant.
      // Full detail is logged server-side for the operator to diagnose.
      console.error(`Add-on checkout session creation failed for provider "${provider}":`, err);
      return res.status(502).json({ error: 'Payment provider temporarily unavailable. Please try again shortly.' });
    }

    res.json({ redirectUrl });
  } catch (error) {
    next(error);
  }
};

export const listMyAddOns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return res.json([]);
    }

    const addOns = await prisma.organizationAddOn.findMany({
      where: { organizationId: user.organizationId, status: 'ACTIVE' },
      orderBy: { purchasedAt: 'desc' },
    });

    res.json(addOns);
  } catch (error) {
    next(error);
  }
};

export const cancelAddOn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User has no organization' });
    }

    const addOn = await prisma.organizationAddOn.findUnique({ where: { id } });
    if (!addOn || addOn.organizationId !== user.organizationId) {
      return res.status(404).json({ error: 'Add-on not found' });
    }
    if (addOn.billingMode !== 'RECURRING') {
      return res.status(400).json({ error: 'One-off add-ons cannot be cancelled' });
    }
    if (addOn.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Add-on is already cancelled' });
    }

    if (addOn.provider && addOn.externalSubscriptionId) {
      const paymentProvider = await getProvider(addOn.provider as ProviderName);
      await paymentProvider.cancelSubscription(addOn.externalSubscriptionId);
    }

    const updated = await prisma.organizationAddOn.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};
