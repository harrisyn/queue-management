import prisma from '../lib/prisma';
import { isReservedSlug } from '../constants/reservedSlugs';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'org';
}

/**
 * Generates a slug from a base name, appending -2, -3, ... on collision
 * with an existing organization or a reserved word.
 */
export async function generateUniqueSlug(baseName: string): Promise<string> {
  const base = slugify(baseName);
  let candidate = base;
  let suffix = 2;

  while (true) {
    if (!isReservedSlug(candidate)) {
      const existing = await prisma.organization.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
