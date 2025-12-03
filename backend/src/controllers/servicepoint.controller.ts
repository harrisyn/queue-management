import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

// Get all service points for a location
export const getServicePoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;

    const servicePoints = await prisma.servicePoint.findMany({
      where: { locationId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        services: {
          select: {
            serviceId: true,
            isActive: true,
          },
        },
      },
    });

    res.json(servicePoints);
  } catch (error) {
    next(error);
  }
};

// Get single service point
export const getServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const servicePoint = await prisma.servicePoint.findUnique({
      where: { id },
      include: {
        location: true,
        entries: {
          where: { status: 'SERVING' },
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
    });

    if (!servicePoint) {
      return res.status(404).json({ error: 'Service point not found' });
    }

    res.json(servicePoint);
  } catch (error) {
    next(error);
  }
};

// Create service point
export const createServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId, name, displayName, type, capacity } = req.body;

    // Verify location exists
    const location = await prisma.location.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const servicePoint = await prisma.servicePoint.create({
      data: {
        locationId,
        name,
        displayName: displayName || name,
        type: type || 'OTHER',
        capacity: capacity || 1,
      },
    });

    res.status(201).json(servicePoint);
  } catch (error) {
    next(error);
  }
};

// Update service point
export const updateServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, displayName, type, capacity, isActive } = req.body;

    const servicePoint = await prisma.servicePoint.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(displayName !== undefined && { displayName }),
        ...(type !== undefined && { type }),
        ...(capacity !== undefined && { capacity }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(servicePoint);
  } catch (error) {
    next(error);
  }
};

// Delete service point
export const deleteServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Check if any entries are being served at this point
    const activeEntries = await prisma.queueEntry.count({
      where: {
        servicePointId: id,
        status: 'SERVING',
      },
    });

    if (activeEntries > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete service point while entries are being served' 
      });
    }

    await prisma.servicePoint.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Get active service points with current status (for display boards)
export const getActiveServicePoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;

    const servicePoints = await prisma.servicePoint.findMany({
      where: { 
        locationId,
        isActive: true,
      },
      include: {
        entries: {
          where: { status: 'SERVING' },
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
            queue: {
              include: {
                service: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    // Format response for display boards
    const displayData = servicePoints.map((sp: typeof servicePoints[number]) => ({
      id: sp.id,
      name: sp.name,
      displayName: sp.displayName || sp.name,
      type: sp.type,
      currentlyServing: sp.entries.length > 0 ? {
        ticketNumber: sp.entries[0].ticketNumber,
        customerName: `${sp.entries[0].user.firstName} ${sp.entries[0].user.lastName}`,
        serviceName: sp.entries[0].queue.service.name,
      } : null,
    }));

    res.json(displayData);
  } catch (error) {
    next(error);
  }
};

// Get service points linked to a specific service
export const getServicePointsForService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;

    const links = await prisma.servicePointService.findMany({
      where: { 
        serviceId,
        isActive: true,
        servicePoint: { isActive: true }
      },
      include: {
        servicePoint: true,
        activatedBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { servicePoint: { name: 'asc' } }
    });

    const servicePoints = links.map((link: typeof links[number]) => ({
      id: link.servicePoint.id,
      name: link.servicePoint.name,
      displayName: link.servicePoint.displayName,
      type: link.servicePoint.type,
      // Use service-specific capacity if set, otherwise fall back to servicePoint.capacity
      capacity: link.capacity ?? link.servicePoint.capacity,
      serviceCapacity: link.capacity, // Explicit service-specific capacity (may be null)
      defaultCapacity: link.servicePoint.capacity, // Original service point capacity
      isOccupied: link.isOccupied,
      activatedBy: link.activatedBy,
      activatedAt: link.activatedAt,
      linkId: link.id
    }));

    res.json(servicePoints);
  } catch (error) {
    next(error);
  }
};

// Link a service point to a service
export const linkServicePointToService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { servicePointId, serviceId } = req.body;

    // Check if link already exists
    const existing = await prisma.servicePointService.findUnique({
      where: { servicePointId_serviceId: { servicePointId, serviceId } }
    });

    if (existing) {
      // Reactivate if it was deactivated
      const updated = await prisma.servicePointService.update({
        where: { id: existing.id },
        data: { isActive: true }
      });
      return res.json(updated);
    }

    const link = await prisma.servicePointService.create({
      data: { servicePointId, serviceId }
    });

    res.status(201).json(link);
  } catch (error) {
    next(error);
  }
};

// Unlink a service point from a service
export const unlinkServicePointFromService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { servicePointId, serviceId } = req.body;

    await prisma.servicePointService.updateMany({
      where: { servicePointId, serviceId },
      data: { isActive: false, isOccupied: false, activatedByUserId: null, activatedAt: null }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Activate (occupy) a service point for a service - operator "sits down"
export const activateServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { servicePointId, serviceId } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if link exists and is active
    const link = await prisma.servicePointService.findUnique({
      where: { servicePointId_serviceId: { servicePointId, serviceId } }
    });

    if (!link || !link.isActive) {
      return res.status(400).json({ 
        error: 'Service point is not linked to this service. Please link it first in admin settings.' 
      });
    }

    // Check if already occupied by someone else
    if (link.isOccupied && link.activatedByUserId !== userId) {
      const occupier = await prisma.user.findUnique({
        where: { id: link.activatedByUserId! },
        select: { firstName: true, lastName: true }
      });
      return res.status(400).json({ 
        error: `This service point is already occupied by ${occupier?.firstName} ${occupier?.lastName}` 
      });
    }

    // Vacate any other service points the user might be occupying for this service
    await prisma.servicePointService.updateMany({
      where: { 
        serviceId,
        activatedByUserId: userId,
        id: { not: link.id }
      },
      data: { isOccupied: false, activatedByUserId: null, activatedAt: null }
    });

    // Activate this service point
    const updated = await prisma.servicePointService.update({
      where: { id: link.id },
      data: {
        isOccupied: true,
        activatedByUserId: userId,
        activatedAt: new Date()
      },
      include: {
        servicePoint: true,
        activatedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    res.json({
      success: true,
      servicePoint: {
        id: updated.servicePoint.id,
        name: updated.servicePoint.name,
        displayName: updated.servicePoint.displayName,
        isOccupied: updated.isOccupied,
        activatedBy: updated.activatedBy,
        activatedAt: updated.activatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// Vacate (deactivate) a service point - operator "leaves"
export const vacateServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { servicePointId, serviceId } = req.body;
    const userId = (req as any).user?.userId;

    const link = await prisma.servicePointService.findUnique({
      where: { servicePointId_serviceId: { servicePointId, serviceId } }
    });

    if (!link) {
      return res.status(404).json({ error: 'Service point link not found' });
    }

    // Only the user who activated it or an admin can vacate
    // For now, we allow anyone to vacate
    await prisma.servicePointService.update({
      where: { id: link.id },
      data: {
        isOccupied: false,
        activatedByUserId: null,
        activatedAt: null
      }
    });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

// Get all occupied service points for a location (for display)
export const getOccupiedServicePoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;

    const occupied = await prisma.servicePointService.findMany({
      where: {
        isOccupied: true,
        isActive: true,
        servicePoint: { locationId, isActive: true }
      },
      include: {
        servicePoint: true,
        service: { select: { id: true, name: true } },
        activatedBy: { select: { id: true, firstName: true, lastName: true } }
      }
    });

    res.json(occupied.map((link: typeof occupied[number]) => ({
      servicePointId: link.servicePoint.id,
      servicePointName: link.servicePoint.displayName || link.servicePoint.name,
      serviceId: link.service.id,
      serviceName: link.service.name,
      activatedBy: link.activatedBy,
      activatedAt: link.activatedAt
    })));
  } catch (error) {
    next(error);
  }
};

// Update service point link (e.g., capacity for a specific service)
export const updateServicePointLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { linkId } = req.params;
    const { capacity } = req.body;

    const updated = await prisma.servicePointService.update({
      where: { id: linkId },
      data: { 
        capacity: capacity !== undefined ? (capacity === null ? null : parseInt(capacity, 10)) : undefined
      },
      include: {
        servicePoint: true,
        activatedBy: {
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    res.json({
      id: updated.servicePoint.id,
      name: updated.servicePoint.name,
      displayName: updated.servicePoint.displayName,
      type: updated.servicePoint.type,
      capacity: updated.capacity ?? updated.servicePoint.capacity,
      serviceCapacity: updated.capacity,
      defaultCapacity: updated.servicePoint.capacity,
      isOccupied: updated.isOccupied,
      activatedBy: updated.activatedBy,
      activatedAt: updated.activatedAt,
      linkId: updated.id
    });
  } catch (error) {
    next(error);
  }
};
