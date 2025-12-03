import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const createService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;
    const { 
      name, 
      description, 
      type, 
      slotDuration, 
      concurrentLimit, 
      activeDays, 
      startTime, 
      endTime 
    } = req.body;

    const service = await prisma.service.create({
      data: {
        locationId,
        name,
        description,
        type: type || 'GENERAL',
        slotDuration: slotDuration || 15,
        concurrentLimit: concurrentLimit || 1,
        activeDays: activeDays || '1,2,3,4,5',
        startTime: startTime || '09:00',
        endTime: endTime || '17:00',
      },
    });

    res.status(201).json(service);
  } catch (error) {
    next(error);
  }
};

export const getServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;

    const services = await prisma.service.findMany({
      where: { locationId, isActive: true },
      include: {
        practitioners: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        _count: { select: { queues: true, appointments: true } },
      },
    });

    res.json(services);
  } catch (error) {
    next(error);
  }
};

export const getService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        location: true,
        practitioners: {
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        },
        flowsFrom: { include: { toService: true } },
        flowsTo: { include: { fromService: true } },
      },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    next(error);
  }
};

export const getServiceSchedule = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const service = await prisma.service.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        slotDuration: true,
        concurrentLimit: true,
        activeDays: true,
        startTime: true,
        endTime: true,
      },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    res.json(service);
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const service = await prisma.service.update({
      where: { id },
      data: updates,
    });

    res.json(service);
  } catch (error) {
    next(error);
  }
};

export const deleteService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.service.update({
      where: { id },
      data: { isActive: false },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Service Flow management
export const createServiceFlow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fromServiceId, toServiceId, condition, autoTransfer } = req.body;

    const flow = await prisma.serviceFlow.create({
      data: {
        fromServiceId,
        toServiceId,
        condition,
        autoTransfer: autoTransfer || false,
      },
      include: {
        fromService: true,
        toService: true,
      },
    });

    res.status(201).json(flow);
  } catch (error) {
    next(error);
  }
};

export const getServiceFlows = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;

    const flows = await prisma.serviceFlow.findMany({
      where: {
        OR: [{ fromServiceId: serviceId }, { toServiceId: serviceId }],
      },
      include: {
        fromService: true,
        toService: true,
      },
    });

    res.json(flows);
  } catch (error) {
    next(error);
  }
};

// Public endpoint: Get services for a location (for public kiosk/tablet view)
export const getPublicLocationServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orgId, locationId } = req.params;

    // Verify location belongs to organization
    const location = await prisma.location.findFirst({
      where: {
        id: locationId,
        organizationId: orgId,
      },
      include: {
        organization: {
          select: { id: true, name: true },
        },
      },
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    // Get active services with queue requirements
    const services = await prisma.service.findMany({
      where: {
        locationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        slotDuration: true,
        startTime: true,
        endTime: true,
        requiresName: true,
        requiresPhone: true,
        allowAnonymous: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      location: {
        id: location.id,
        name: location.name,
        address: location.address,
      },
      organization: location.organization,
      services,
    });
  } catch (error) {
    next(error);
  }
};
