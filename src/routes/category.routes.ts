import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { serialize } from '../utils/serialize';
import { cache } from '../utils/cache';

const router = Router();

router.get('/', async (_req, res) => {
  const cached = cache.get<unknown>('categories:all');
  if (cached) {
    res.json({ success: true, data: cached });
    return;
  }
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  const data = serialize(categories);
  cache.set('categories:all', data, 1000 * 60 * 10);
  res.json({ success: true, data });
});

const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  image: z.string().url().optional(),
});

router.post('/', authenticate, validateBody(createCategorySchema), async (req, res) => {
  const existing = await prisma.category.findUnique({ where: { slug: req.body.slug } });
  if (existing) {
    res.status(409).json({ success: false, error: { code: 'DUPLICATE_SLUG', message: 'Une catégorie avec ce slug existe déjà' } });
    return;
  }
  const category = await prisma.category.create({ data: req.body });
  cache.delete('categories:all');
  res.status(201).json({ success: true, data: serialize(category) });
});

// Admin: list categories with product counts
router.get('/admin/list', authenticate, async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  const productCounts = await prisma.product.groupBy({
    by: ['categoryId'],
    _count: { id: true },
  });
  const countMap = new Map(productCounts.map((p) => [p.categoryId, p._count.id]));
  const data = categories.map((c) => ({
    ...c,
    productCount: countMap.get(c.id) || 0,
  }));
  res.json({ success: true, data: serialize(data) });
});

const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().or(z.literal('')),
  image: z.string().url().optional().or(z.literal('')),
  sortOrder: z.number().int().optional(),
});

router.patch('/:id', authenticate, validateBody(updateCategorySchema), async (req, res) => {
  const id = req.params.id as string;
  const data = req.body;
  if (data.slug) {
    const existing = await prisma.category.findFirst({
      where: { slug: data.slug, NOT: { id } },
    });
    if (existing) {
      res.status(409).json({ success: false, error: { code: 'DUPLICATE_SLUG', message: 'Ce slug est déjà utilisé' } });
      return;
    }
  }
  const category = await prisma.category.update({
    where: { id },
    data: {
      ...data,
      image: data.image || null,
      description: data.description || null,
    },
  });
  cache.delete('categories:all');
  cache.clearPrefix('category:');
  res.json({ success: true, data: serialize(category) });
});

router.delete('/:id', authenticate, async (req, res) => {
  const id = req.params.id as string;
  const category = await prisma.category.findUnique({
    where: { id },
  });
  if (!category) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Catégorie introuvable' } });
    return;
  }
  const productCount = await prisma.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    res.status(409).json({
      success: false,
      error: {
        code: 'HAS_PRODUCTS',
        message: `Cette catégorie contient ${productCount} produit(s). Supprimez-les d'abord.`,
      },
    });
    return;
  }
  await prisma.category.delete({ where: { id } });
  cache.delete('categories:all');
  cache.clearPrefix('category:');
  res.json({ success: true, data: { message: 'Catégorie supprimée' } });
});

router.get('/:slug', async (req, res) => {
  const cacheKey = `category:${req.params.slug}`;
  const cached = cache.get<unknown>(cacheKey);
  if (cached) {
    res.json({ success: true, data: cached });
    return;
  }
  const category = await prisma.category.findUnique({
    where: { slug: req.params.slug },
    include: {
      products: {
        where: { isAvailable: true },
        include: {
          variants: {
            where: { isAvailable: true },
            orderBy: { price: 'asc' },
          },
        },
      },
    },
  });

  if (!category) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    return;
  }

  const data = serialize(category);
  cache.set(cacheKey, data, 1000 * 60 * 5);
  res.json({ success: true, data });
});

export default router;
