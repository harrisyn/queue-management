import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { getProvider, ProviderNotActiveError } from '../services/payments';
import { ProviderName } from '../services/payments/types';

export const createCheckoutSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { planId, provider, billingCycle } = req.body as {
      planId: string;
      provider: ProviderName;
      billingCycle: 'monthly' | 'yearly';
    };

    if (!planId || !provider) {
      return res.status(400).json({ error: 'planId and provider are required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User has no organization' });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Plan not found' });
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

    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = cycle === 'yearly' ? Number(plan.priceYearly) : Number(plan.priceMonthly);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8003';

    let redirectUrl: string;
    try {
      const result = await paymentProvider.createCheckoutSession({
        organizationId: user.organizationId,
        planId: plan.id,
        planCode: plan.code,
        planName: plan.name,
        amount,
        currency: plan.currency,
        billingCycle: cycle,
        successUrl: `${frontendUrl}/admin/billing?checkout=success`,
        cancelUrl: `${frontendUrl}/admin/billing?checkout=cancelled`,
      });
      redirectUrl = result.redirectUrl;
    } catch (err) {
      // Don't leak raw provider errors (e.g. a revoked key) to the tenant.
      // Full detail is logged server-side for the operator to diagnose.
      console.error(`Checkout session creation failed for provider "${provider}":`, err);
      return res.status(502).json({ error: 'Payment provider temporarily unavailable. Please try again shortly.' });
    }

    res.json({ redirectUrl });
  } catch (error) {
    next(error);
  }
};

export const switchToFreePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { planId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User has no organization' });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const isFree = Number(plan.priceMonthly) === 0 && Number(plan.priceQuarterly) === 0 && Number(plan.priceYearly) === 0;
    if (!isFree) {
      return res.status(400).json({ error: 'This plan requires payment; use checkout instead' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscriptionId: true },
    });

    const now = new Date();
    const periodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    let subscriptionId: string;
    if (org?.subscriptionId) {
      const updated = await prisma.organizationSubscription.update({
        where: { id: org.subscriptionId },
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          trialEndsAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      subscriptionId = updated.id;
    } else {
      const created = await prisma.organizationSubscription.create({
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          billingCycle: 'monthly',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      subscriptionId = created.id;
      await prisma.organization.update({
        where: { id: user.organizationId },
        data: { subscriptionId },
      });
    }

    res.json({ success: true, planId: plan.id, planName: plan.name });
  } catch (error) {
    next(error);
  }
};
