import { Prisma } from '@prisma/client';

/**
 * Recursively convert Prisma Decimal values to plain JavaScript numbers.
 * Prisma's Decimal.toJSON() returns a *string*, which causes string
 * concatenation on the frontend. This helper walks the tree and
 * converts every Decimal to a Number before JSON serialization.
 * Date objects are preserved as ISO strings.
 */
export function serialize<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (data instanceof Prisma.Decimal) {
    return Number(data) as T;
  }

  if (data instanceof Date) {
    return data.toISOString() as T;
  }

  if (Array.isArray(data)) {
    return data.map(serialize) as T;
  }

  if (typeof data === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(data)) {
      result[key] = serialize(value);
    }
    return result;
  }

  return data;
}
