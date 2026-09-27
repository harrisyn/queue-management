export interface BackfillLink {
  id: string;
  serviceId: string;
  createdAt: Date;
}

export interface BackfillInstance {
  servicePointId: string;
  currentServiceId: string | null;
}

// Mirrors the SQL migration's ORDER BY (serviceId = currentServiceId) DESC, createdAt ASC, LIMIT 1:
// prefer the link matching currentServiceId if set, else the earliest-created link.
export function resolveBackfillLink(instance: BackfillInstance, linksForServicePoint: BackfillLink[]): string | null {
  if (linksForServicePoint.length === 0) return null;

  if (instance.currentServiceId) {
    const matching = linksForServicePoint.find(l => l.serviceId === instance.currentServiceId);
    if (matching) return matching.id;
  }

  const sorted = [...linksForServicePoint].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return sorted[0].id;
}
