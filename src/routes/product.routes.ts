import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

// Public: list products
router.get('/', async (req, res) => {
  const categorySlug = req.query.category as string | undefined;
  const search = req.query.search as string | undefined;

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

  res.json({ success: true, data: products });
});

// Public: single product
router.get('/:slug', async (req, res) => {
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

  res.json({ success: true, data: product });
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
  variants: z.array(z.object({
    weight: z.string().min(1).max(50),
    price: z.number().positive(),
    sku: z.string().optional(),
  })).min(1),
});

router.post('/', authenticate, validateBody(createProductSchema), async (req, res) => {
  const { variants, ...productData } = req.body;

  const product = await prisma.product.create({
    data: {
      ...productData,
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

  res.status(201).json({ success: true, data: product });
});

// Admin: update product
router.patch('/:id', authenticate, async (req, res) => {
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

  res.json({ success: true, data: product });
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
  res.json({ success: true, data: products });
});

// Admin: soft delete
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  await prisma.product.update({
    where: { id: id as string },
    data: { isAvailable: false },
  });
  res.json({ success: true, data: { message: 'Product deleted' } });
});

export default router;
