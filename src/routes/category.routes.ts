import { Router } from 'express';
import { prisma } from '../services/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ success: true, data: categories });
});

router.get('/:slug', async (req, res) => {
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

  res.json({ success: true, data: category });
});

export default router;
