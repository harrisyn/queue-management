import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

// Ensure a service point has exactly `capacity` active ServicePointInstance rows.
// Creates missing instances and deactivates (never deletes) excess ones.
async function syncInstancesForServicePoint(servicePointId: string) {
  const servicePoint = await prisma.servicePoint.findUnique({
    where: { id: servicePointId },
    include: { instances: true },
  });

  if (!servicePoint) return;

  const currentCount = servicePoint.instances.length;
  const targetCount = servicePoint.capacity;

  if (currentCount < targetCount) {
    for (let i = currentCount + 1; i <= targetCount; i++) {
      await prisma.servicePointInstance.create({
        data: {
          servicePointId,
          instanceNumber: i,
          displayName: `${servicePoint.displayName || servicePoint.name} ${i}`,
          isActive: servicePoint.isActive,
        },
      });
    }
  }

  if (currentCount > targetCount) {
    await prisma.servicePointInstance.updateMany({
      where: { servicePointId, instanceNumber: { gt: targetCount } },
      data: { isActive: false },
    });
  }

  // Keep existing instances' active state aligned with the parent service point.
  await prisma.servicePointInstance.updateMany({
    where: { servicePointId, instanceNumber: { lte: targetCount } },
    data: { isActive: servicePoint.isActive },
  });
}

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

    await syncInstancesForServicePoint(servicePoint.id);

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

    if (capacity !== undefined || isActive !== undefined) {
      await syncInstancesForServicePoint(id);
    }

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

    // Get location with organization's default display mode
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        organization: {
          select: { defaultDisplayMode: true }
        }
      }
    });
    
    const orgDefaultDisplayMode = location?.organization?.defaultDisplayMode || 'TICKET_ONLY';

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
                  select: { name: true, displayMode: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    // Format response for display boards
    const displayData = servicePoints.map((sp: typeof servicePoints[number]) => {
      const entry = sp.entries[0];
      const serviceDisplayMode = entry?.queue?.service?.displayMode;
      const displayMode = serviceDisplayMode || orgDefaultDisplayMode;
      
      return {
        id: sp.id,
        name: sp.name,
        displayName: sp.displayName || sp.name,
        type: sp.type,
        displayMode,
        currentlyServing: entry ? {
          ticketNumber: entry.ticketNumber,
          customerName: `${entry.user.firstName} ${entry.user.lastName}`,
          serviceName: entry.queue.service.name,
        } : null,
      };
    });

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

// ==========================================
// Service Point Instances
// ==========================================

// Get all instances for a service point
export const getServicePointInstances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { servicePointId } = req.params;

    const instances = await prisma.servicePointInstance.findMany({
      where: { servicePointId },
      include: {
        occupiedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        currentService: {
          select: { id: true, name: true }
        }
      },
      orderBy: { instanceNumber: 'asc' }
    });

    res.json(instances);
  } catch (error) {
    next(error);
  }
};

// Sync instances based on service point capacity
// This ensures the right number of instances exist
export const syncServicePointInstances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { servicePointId } = req.params;

    const exists = await prisma.servicePoint.findUnique({ where: { id: servicePointId } });
    if (!exists) {
      return res.status(404).json({ error: 'Service point not found' });
    }

    await syncInstancesForServicePoint(servicePointId);

    // Get updated instances
    const instances = await prisma.servicePointInstance.findMany({
      where: { servicePointId },
      include: {
        occupiedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        currentService: {
          select: { id: true, name: true }
        }
      },
      orderBy: { instanceNumber: 'asc' }
    });

    res.json(instances);
  } catch (error) {
    next(error);
  }
};

// Activate an instance (operator claims a desk instance)
export const activateServicePointInstance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instanceId } = req.params;
    const { serviceId } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if instance exists and is active
    const instance = await prisma.servicePointInstance.findUnique({
      where: { id: instanceId },
      include: { servicePoint: true }
    });

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    if (!instance.isActive) {
      return res.status(400).json({ error: 'Instance is not active' });
    }

    if (!instance.servicePoint.isActive) {
      return res.status(400).json({ error: 'Service point is not active' });
    }

    if (instance.isOccupied) {
      return res.status(400).json({ error: 'Instance is already occupied' });
    }

    // Update instance
    const updated = await prisma.servicePointInstance.update({
      where: { id: instanceId },
      data: {
        isOccupied: true,
        occupiedByUserId: userId,
        currentServiceId: serviceId || null,
        occupiedAt: new Date()
      },
      include: {
        occupiedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        currentService: {
          select: { id: true, name: true }
        },
        servicePoint: true
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Vacate an instance (operator releases a desk instance)
export const vacateServicePointInstance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instanceId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const instance = await prisma.servicePointInstance.findUnique({
      where: { id: instanceId }
    });

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // Only the user who activated it can vacate it (or admin)
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    const isAdmin = ['SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'].includes(user?.role || '');
    if (instance.occupiedByUserId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'You can only vacate your own instance' });
    }

    const updated = await prisma.servicePointInstance.update({
      where: { id: instanceId },
      data: {
        isOccupied: false,
        occupiedByUserId: null,
        currentServiceId: null,
        occupiedAt: null
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Get all instances for a location (for display board)
export const getLocationInstances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;

    const instances = await prisma.servicePointInstance.findMany({
      where: {
        isActive: true,
        servicePoint: {
          locationId,
          isActive: true
        }
      },
      include: {
        servicePoint: true,
        occupiedBy: {
          select: { id: true, firstName: true, lastName: true }
        },
        currentService: {
          select: { id: true, name: true, displayMode: true }
        },
        servingEntries: {
          where: { status: 'SERVING' },
          include: {
            user: {
              select: { firstName: true, lastName: true }
            }
          }
        }
      },
      orderBy: [
        { servicePoint: { type: 'asc' } },
        { servicePoint: { name: 'asc' } },
        { instanceNumber: 'asc' }
      ]
    });

    // Get location with organization's default display mode
    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: {
        organization: {
          select: { defaultDisplayMode: true }
        }
      }
    });
    
    const orgDefaultDisplayMode = location?.organization?.defaultDisplayMode || 'TICKET_ONLY';

    // Format response for display boards
    const displayData = instances.map((inst: typeof instances[number]) => {
      const entry = inst.servingEntries[0];
      const serviceDisplayMode = inst.currentService?.displayMode;
      const displayMode = serviceDisplayMode || orgDefaultDisplayMode;
      
      return {
        id: inst.id,
        servicePointId: inst.servicePointId,
        instanceNumber: inst.instanceNumber,
        displayName: inst.displayName,
        servicePointType: inst.servicePoint.type,
        displayMode,
        isOccupied: inst.isOccupied,
        currentService: inst.currentService,
        occupiedBy: inst.occupiedBy,
        currentlyServing: entry ? {
          ticketNumber: entry.ticketNumber,
          customerName: `${entry.user.firstName} ${entry.user.lastName}`,
        } : null,
      };
    });

    res.json(displayData);
  } catch (error) {
    next(error);
  }
};

// Toggle instance active state (admin only)
export const toggleInstanceActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instanceId } = req.params;
    const { isActive } = req.body;

    const instance = await prisma.servicePointInstance.findUnique({
      where: { id: instanceId }
    });

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    // If deactivating, also vacate
    const updated = await prisma.servicePointInstance.update({
      where: { id: instanceId },
      data: {
        isActive,
        ...(isActive === false ? {
          isOccupied: false,
          occupiedByUserId: null,
          currentServiceId: null,
          occupiedAt: null
        } : {})
      }
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Get instances by service (for operator's desk selection)
export const getServiceInstances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;

    // Get service points linked to this service
    const servicePointLinks = await prisma.servicePointService.findMany({
      where: {
        serviceId,
        isActive: true,
        servicePoint: { isActive: true }
      },
      include: {
        servicePoint: {
          include: {
            instances: {
              where: { isActive: true },
              include: {
                occupiedBy: {
                  select: { id: true, firstName: true, lastName: true }
                }
              },
              orderBy: { instanceNumber: 'asc' }
            }
          }
        }
      }
    });

    // Flatten to list of available instances
    const instances = servicePointLinks.flatMap((link: typeof servicePointLinks[number]) => 
      link.servicePoint.instances.map((inst: typeof link.servicePoint.instances[number]) => ({
        id: inst.id,
        servicePointId: inst.servicePointId,
        servicePointName: link.servicePoint.displayName || link.servicePoint.name,
        instanceNumber: inst.instanceNumber,
        displayName: inst.displayName,
        isOccupied: inst.isOccupied,
        occupiedBy: inst.occupiedBy
      }))
    );

    res.json(instances);
  } catch (error) {
    next(error);
  }
};
