import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { serialize } from '../utils/serialize';
import { cache } from '../utils/cache';

const router = Router();

async function ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
  let candidate = slug;
  let counter = 2;
  while (true) {
    const existing = await prisma.product.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${slug}-${counter}`;
    counter++;
  }
}

// Public: list products
router.get('/', async (req, res) => {
  const categorySlug = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;
  const cacheKey = `products:list:${categorySlug || 'all'}:${search || 'none'}`;

  const cached = cache.get<unknown>(cacheKey);
  if (cached) {
    res.json({ success: true, data: cached });
    return;
  }

  const products = await prisma.product.findMany({
    where: {
      isAvailable: true,
      ...(categorySlug && { category: { slug: categorySlug } }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    },
    include: {
      category: { select: { name: true, slug: true } },
      variants: {
        where: { isAvailable: true },
        orderBy: { price: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const data = serialize(products);
  cache.set(cacheKey, data, 1000 * 60 * 5);
  res.json({ success: true, data });
});

// Public: single product
router.get('/:slug', async (req, res) => {
  const cacheKey = `product:${req.params.slug}`;
  const cached = cache.get<unknown>(cacheKey);
  if (cached) {
    res.json({ success: true, data: cached });
    return;
  }

  const product = await prisma.product.findUnique({
    where: { slug: req.params.slug },
    include: {
      category: { select: { name: true, slug: true } },
      variants: {
        where: { isAvailable: true },
        orderBy: { price: 'asc' },
      },
    },
  });

  if (!product) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Product not found' } });
    return;
  }

  const data = serialize(product);
  cache.set(cacheKey, data, 1000 * 60 * 10);
  res.json({ success: true, data });
});

// Admin: create product with variants
const createProductSchema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  image: z.string().url(),
  gallery: z.array(z.string().url()).optional(),
  categoryId: z.string().uuid(),
  featured: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  variants: z.array(z.object({
    weight: z.string().min(1).max(50),
    price: z.number().positive(),
    sku: z.string().optional(),
  })).min(1),
});

router.post('/', authenticate, validateBody(createProductSchema), async (req, res) => {
  const { variants, ...productData } = req.body;
  const uniqueSlug = await ensureUniqueSlug(productData.slug);

  const product = await prisma.product.create({
    data: {
      ...productData,
      slug: uniqueSlug,
      variants: {
        create: variants.map((v: any) => ({
          weight: v.weight,
          price: v.price,
          sku: v.sku,
        })),
      },
    },
    include: { variants: true },
  });

  // Invalidate all related caches
  cache.delete('categories:all');
  cache.clearPrefix('products:list:');
  cache.clearPrefix('product:');
  cache.clearPrefix('category:');
  res.status(201).json({ success: true, data: serialize(product) });
});

// Admin: update product
const updateProductSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  slug: z.string().min(2).max(200).optional(),
  description: z.string().max(2000).optional().or(z.literal('')),
  image: z.string().url().optional(),
  gallery: z.array(z.string().url()).optional(),
  categoryId: z.string().uuid().optional(),
  featured: z.boolean().optional(),
  isAvailable: z.boolean().optional(),
  variants: z.array(z.object({
    weight: z.string().min(1).max(50),
    price: z.number().positive(),
    sku: z.string().optional(),
  })).min(1).optional(),
});

router.patch('/:id', authenticate, validateBody(updateProductSchema), async (req, res) => {
  const { id } = req.params;
  const { variants, ...productData } = req.body;

  const product = await prisma.product.update({
    where: { id: id as string },
    data: {
      ...productData,
      ...(variants && {
        variants: {
          deleteMany: {},
          create: variants.map((v: any) => ({
            weight: v.weight,
            price: v.price,
            sku: v.sku || null,
          })),
        },
      }),
    },
    include: { variants: true },
  });

  // Invalidate all related caches
  cache.delete('categories:all');
  cache.clearPrefix('products:list:');
  cache.clearPrefix('product:');
  cache.clearPrefix('category:');
  res.json({ success: true, data: serialize(product) });
});

// Admin: list all products (including inactive)
router.get('/admin/list', authenticate, async (_req, res) => {
  const products = await prisma.product.findMany({
    include: {
      category: { select: { name: true, slug: true } },
      variants: {
        orderBy: { price: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: serialize(products) });
});

// Admin: soft delete
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const product = await prisma.product.update({
    where: { id: id as string },
    data: { isAvailable: false },
  });
  // Invalidate all related caches
  cache.delete('categories:all');
  cache.clearPrefix('products:list:');
  cache.clearPrefix('product:');
  cache.clearPrefix('category:');
  res.json({ success: true, data: { message: 'Product deleted' } });
});

export default router;
