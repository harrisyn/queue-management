import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { slugify, generateUniqueSlug } from '../utils/slug';
import { isReservedSlug } from '../constants/reservedSlugs';

// Public endpoint: Register a new organization with first admin user
export const registerOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      organizationName,
      email,           // Organization email (optional)
      phone,           // Organization phone (optional)
      slug,            // Optional caller-chosen subdomain slug
      adminEmail,      // Admin email - or use 'email' if adminEmail not provided
      adminPassword,   // Admin password
      adminFirstName,  // Admin first name
      adminLastName,   // Admin last name
      emailVerified    // Flag to indicate email was verified via OTP
    } = req.body;

    // Support both 'email' and 'adminEmail' for backward compatibility
    const actualAdminEmail = (adminEmail || email || '').toLowerCase().trim();

    // Validate required fields
    if (!organizationName || !actualAdminEmail || !adminPassword || !adminFirstName || !adminLastName) {
      return res.status(400).json({ 
        error: 'Missing required fields: organizationName, email, password, firstName, lastName' 
      });
    }

    // In production, require email verification
    // In development, allow bypass for testing
    if (process.env.NODE_ENV === 'production' && !emailVerified) {
      return res.status(400).json({ error: 'Email must be verified before registration' });
    }

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({ where: { email: actualAdminEmail } });
    if (existingUser) {
      return res.status(400).json({ error: 'A user with this email already exists' });
    }

    // Resolve the org's subdomain slug: use the caller's choice if valid,
    // otherwise auto-generate one from the org name.
    let resolvedSlug: string;
    if (slug) {
      const normalized = slugify(slug);
      if (normalized !== slug.toLowerCase()) {
        return res.status(400).json({ error: 'Slug must be lowercase letters, numbers, and hyphens only' });
      }
      if (isReservedSlug(normalized)) {
        return res.status(400).json({ error: 'This slug is reserved and cannot be used' });
      }
      const existingOrgWithSlug = await prisma.organization.findUnique({ where: { slug: normalized } });
      if (existingOrgWithSlug) {
        return res.status(400).json({ error: 'This slug is already taken' });
      }
      resolvedSlug = normalized;
    } else {
      resolvedSlug = await generateUniqueSlug(organizationName);
    }

    // Create organization and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          email: actualAdminEmail, // Use admin email as org email
          phone: phone || null,
          slug: resolvedSlug,
        },
      });

      // Hash password
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      // Create admin user
      const adminUser = await tx.user.create({
        data: {
          email: actualAdminEmail,
          password: hashedPassword,
          firstName: adminFirstName,
          lastName: adminLastName,
          role: 'ORG_ADMIN',
          organizationId: organization.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      return { organization, adminUser };
    });

    // Generate JWT token for auto-login
    const token = jwt.sign(
      { userId: result.adminUser.id, role: result.adminUser.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      organization: result.organization,
      user: result.adminUser,
      token,
    });
  } catch (error) {
    next(error);
  }
};

// Public endpoint: Get organization details for public pages
export const getPublicOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        locations: {
          select: {
            id: true,
            name: true,
            address: true,
            publicCode: true,
            services: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
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

// Public endpoint: resolve an organization by its subdomain slug
export const getPublicOrganizationBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(organization);
  } catch (error) {
    next(error);
  }
};

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
    // SUPER_ADMIN sees every org (this route is used by the general orgs
    // list — the dedicated /superadmin/organizations endpoint has its own
    // richer listing, this one stays available for backward compatibility).
    // Any other caller (e.g. ORG_ADMIN) is scoped to only their own org —
    // never return every tenant's org list to a non-superadmin.
    let organizations;
    if (req.user?.role === 'SUPER_ADMIN') {
      organizations = await prisma.organization.findMany({
        include: {
          locations: true,
          _count: { select: { users: true, locations: true } },
        },
      });
    } else {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        return res.json([]);
      }

      organizations = await prisma.organization.findMany({
        where: { id: user.organizationId },
        include: {
          locations: true,
          _count: { select: { users: true, locations: true } },
        },
      });
    }

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
    const { name, email, phone, slug, identityFieldsConfig, defaultDisplayMode } = req.body;

    // If slug is provided, validate it
    if (slug) {
      // Slug must be lowercase alphanumeric with hyphens
      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(slug)) {
        return res.status(400).json({ error: 'Slug must be lowercase alphanumeric with hyphens only' });
      }
      if (isReservedSlug(slug)) {
        return res.status(400).json({ error: 'This slug is reserved and cannot be used' });
      }
      // Check if slug is already taken by another org. Use findUnique for the slug
      // (slug is unique in the schema) and ensure the found org isn't the one being updated.
      const existing = await prisma.organization.findUnique({ where: { slug } });
      if (existing && existing.id !== id) {
        return res.status(400).json({ error: 'This slug is already taken' });
      }
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (slug !== undefined) updateData.slug = slug || null;
    if (identityFieldsConfig !== undefined) updateData.identityFieldsConfig = identityFieldsConfig;
    if (defaultDisplayMode !== undefined) updateData.defaultDisplayMode = defaultDisplayMode;

    const organization = await prisma.organization.update({
      where: { id },
      data: updateData,
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
