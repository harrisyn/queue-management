import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';

// =====================================================
// ORGANIZATION MANAGEMENT
// =====================================================

// List all organizations with subscription info
export const listOrganizations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, status, planId, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Prisma.OrganizationWhereInput = {};
    
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { email: { contains: String(search), mode: 'insensitive' } },
        { slug: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    if (status || planId) {
      where.subscription = {};
      if (status) {
        where.subscription.status = String(status) as any;
      }
      if (planId) {
        where.subscription.planId = String(planId);
      }
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          subscription: {
            include: {
              plan: true,
            },
          },
          _count: {
            select: {
              locations: true,
              users: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.organization.count({ where }),
    ]);

    res.json({
      organizations,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get single organization details
export const getOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        locations: {
          include: {
            _count: {
              select: {
                services: true,
                servicePoints: true,
              },
            },
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            locations: true,
            users: true,
            dataSources: true,
          },
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

// Update organization subscription
export const updateOrganizationSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { planId, status, billingCycle, trialEndsAt, externalPaymentId } = req.body;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Calculate period end based on billing cycle
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    if (billingCycle === 'yearly') {
      currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
    } else {
      currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    }

    if (organization.subscription) {
      // Update existing subscription
      const subscription = await prisma.organizationSubscription.update({
        where: { id: organization.subscription.id },
        data: {
          planId: planId || undefined,
          status: status || undefined,
          billingCycle: billingCycle || undefined,
          trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : undefined,
          externalPaymentId: externalPaymentId || undefined,
          currentPeriodStart: planId ? currentPeriodStart : undefined,
          currentPeriodEnd: planId ? currentPeriodEnd : undefined,
        },
        include: { plan: true },
      });

      res.json(subscription);
    } else {
      // Create new subscription
      if (!planId) {
        return res.status(400).json({ error: 'Plan ID is required for new subscription' });
      }

      const subscription = await prisma.organizationSubscription.create({
        data: {
          planId,
          status: status || 'ACTIVE',
          billingCycle: billingCycle || 'monthly',
          currentPeriodStart,
          currentPeriodEnd,
          trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null,
          externalPaymentId: externalPaymentId || null,
        },
        include: { plan: true },
      });

      // Link to organization
      await prisma.organization.update({
        where: { id },
        data: { subscriptionId: subscription.id },
      });

      res.json(subscription);
    }
  } catch (error) {
    next(error);
  }
};

// Cancel organization subscription
export const cancelOrganizationSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: { subscription: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    if (!organization.subscription) {
      return res.status(400).json({ error: 'Organization has no active subscription' });
    }

    const subscription = await prisma.organizationSubscription.update({
      where: { id: organization.subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason || null,
      },
      include: { plan: true },
    });

    res.json(subscription);
  } catch (error) {
    next(error);
  }
};

// Delete organization (with all related data)
export const deleteOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { confirm } = req.body;

    if (confirm !== 'DELETE') {
      return res.status(400).json({ error: 'Please confirm deletion by sending confirm: "DELETE"' });
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Delete organization (cascades to locations, users, etc.)
    await prisma.organization.delete({
      where: { id },
    });

    res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// SUBSCRIPTION PLAN MANAGEMENT
// =====================================================

// List all subscription plans
export const listPlans = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { includeInactive } = req.query;

    const where: Prisma.SubscriptionPlanWhereInput = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const plans = await prisma.subscriptionPlan.findMany({
      where,
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    res.json(plans);
  } catch (error) {
    next(error);
  }
};

// Create subscription plan
export const createPlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      code,
      description,
      priceMonthly,
      priceYearly,
      currency,
      maxLocations,
      maxServicesPerLoc,
      maxUsersPerOrg,
      maxQueueEntriesPerDay,
      features,
      displayOrder,
      isDefault,
    } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }

    // Check for duplicate code
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { code },
    });

    if (existing) {
      return res.status(400).json({ error: 'Plan with this code already exists' });
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.subscriptionPlan.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        code,
        description,
        priceMonthly: priceMonthly || 0,
        priceYearly: priceYearly || 0,
        currency: currency || 'USD',
        maxLocations: maxLocations || null,
        maxServicesPerLoc: maxServicesPerLoc || null,
        maxUsersPerOrg: maxUsersPerOrg || null,
        maxQueueEntriesPerDay: maxQueueEntriesPerDay || null,
        features: features || {},
        displayOrder: displayOrder || 0,
        isDefault: isDefault || false,
      },
    });

    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
};

// Update subscription plan
export const updatePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      priceMonthly,
      priceYearly,
      currency,
      maxLocations,
      maxServicesPerLoc,
      maxUsersPerOrg,
      maxQueueEntriesPerDay,
      features,
      displayOrder,
      isActive,
      isDefault,
    } = req.body;

    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // If this is set as default, unset other defaults
    if (isDefault && !existing.isDefault) {
      await prisma.subscriptionPlan.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        priceMonthly: priceMonthly ?? undefined,
        priceYearly: priceYearly ?? undefined,
        currency: currency ?? undefined,
        maxLocations: maxLocations === null ? null : (maxLocations ?? undefined),
        maxServicesPerLoc: maxServicesPerLoc === null ? null : (maxServicesPerLoc ?? undefined),
        maxUsersPerOrg: maxUsersPerOrg === null ? null : (maxUsersPerOrg ?? undefined),
        maxQueueEntriesPerDay: maxQueueEntriesPerDay === null ? null : (maxQueueEntriesPerDay ?? undefined),
        features: features ?? undefined,
        displayOrder: displayOrder ?? undefined,
        isActive: isActive ?? undefined,
        isDefault: isDefault ?? undefined,
      },
    });

    res.json(plan);
  } catch (error) {
    next(error);
  }
};

// Delete subscription plan
export const deletePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: true,
          },
        },
      },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (plan._count.subscriptions > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete plan with active subscriptions. Deactivate it instead.',
        subscriptionCount: plan._count.subscriptions,
      });
    }

    await prisma.subscriptionPlan.delete({
      where: { id },
    });

    res.json({ message: 'Plan deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// =====================================================
// DASHBOARD & ANALYTICS
// =====================================================

// Get superadmin dashboard stats
export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalOrganizations,
      activeSubscriptions,
      trialSubscriptions,
      totalLocations,
      totalUsers,
      planBreakdown,
      recentOrganizations,
    ] = await Promise.all([
      // Total organizations
      prisma.organization.count(),
      
      // Active subscriptions
      prisma.organizationSubscription.count({
        where: { status: 'ACTIVE' },
      }),
      
      // Trial subscriptions
      prisma.organizationSubscription.count({
        where: { status: 'TRIAL' },
      }),
      
      // Total locations
      prisma.location.count(),
      
      // Total users
      prisma.user.count(),
      
      // Subscription breakdown by plan
      prisma.subscriptionPlan.findMany({
        include: {
          _count: {
            select: {
              subscriptions: {
                where: { status: { in: ['ACTIVE', 'TRIAL'] } },
              },
            },
          },
        },
        orderBy: { displayOrder: 'asc' },
      }),
      
      // Recent organizations
      prisma.organization.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          subscription: {
            include: {
              plan: {
                select: { name: true, code: true },
              },
            },
          },
          _count: {
            select: { locations: true, users: true },
          },
        },
      }),
    ]);

    // Calculate MRR (Monthly Recurring Revenue)
    const subscriptions = await prisma.organizationSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: true },
    });

    let mrr = 0;
    subscriptions.forEach(sub => {
      if (sub.billingCycle === 'yearly') {
        mrr += Number(sub.plan.priceYearly) / 12;
      } else {
        mrr += Number(sub.plan.priceMonthly);
      }
    });

    res.json({
      stats: {
        totalOrganizations,
        activeSubscriptions,
        trialSubscriptions,
        cancelledSubscriptions: await prisma.organizationSubscription.count({
          where: { status: 'CANCELLED' },
        }),
        totalLocations,
        totalUsers,
        mrr: mrr.toFixed(2),
      },
      planBreakdown: planBreakdown.map(p => ({
        id: p.id,
        name: p.name,
        code: p.code,
        activeCount: p._count.subscriptions,
      })),
      recentOrganizations,
    });
  } catch (error) {
    next(error);
  }
};

// Get usage stats for an organization
export const getOrganizationUsage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        subscription: {
          include: { plan: true },
        },
      },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      locationsCount,
      usersCount,
      servicesCount,
      todayEntries,
      monthEntries,
    ] = await Promise.all([
      prisma.location.count({ where: { organizationId: id } }),
      prisma.user.count({ where: { organizationId: id } }),
      prisma.service.count({
        where: { location: { organizationId: id } },
      }),
      // Today's queue entries
      prisma.queueEntry.count({
        where: {
          queue: {
            service: {
              location: { organizationId: id },
            },
          },
          joinedAt: { gte: today },
        },
      }),
      // This month's queue entries
      prisma.queueEntry.count({
        where: {
          queue: {
            service: {
              location: { organizationId: id },
            },
          },
          joinedAt: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
          },
        },
      }),
    ]);

    const plan = organization.subscription?.plan;
    
    res.json({
      usage: {
        locations: {
          used: locationsCount,
          limit: plan?.maxLocations || null,
          percentage: plan?.maxLocations ? (locationsCount / plan.maxLocations * 100).toFixed(1) : null,
        },
        users: {
          used: usersCount,
          limit: plan?.maxUsersPerOrg || null,
          percentage: plan?.maxUsersPerOrg ? (usersCount / plan.maxUsersPerOrg * 100).toFixed(1) : null,
        },
        services: {
          used: servicesCount,
          limitPerLocation: plan?.maxServicesPerLoc || null,
        },
        queueEntries: {
          today: todayEntries,
          thisMonth: monthEntries,
          dailyLimit: plan?.maxQueueEntriesPerDay || null,
        },
      },
      plan: plan ? {
        id: plan.id,
        name: plan.name,
        code: plan.code,
        features: plan.features,
      } : null,
      subscription: organization.subscription,
    });
  } catch (error) {
    next(error);
  }
};
