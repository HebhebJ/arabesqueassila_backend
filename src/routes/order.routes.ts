import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma';
import type { Prisma } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

const router = Router();

// Generate a professional order reference: ARB-XXXXXX
async function generateOrderRef(tx: Prisma.TransactionClient, maxRetries = 10): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const num = Math.floor(100000 + Math.random() * 900000);
    const ref = `ARB-${num}`;
    const existing = await tx.order.findUnique({ where: { orderNumber: ref } });
    if (!existing) return ref;
  }
  throw new Error('Failed to generate unique order reference');
}

const createOrderSchema = z.object({
  customerName: z.string().min(2).max(100),
  phone: z.string().regex(/^[23459]\d{7}$/, 'Tunisian mobile: 8 digits starting with 2,3,4,5,9'),
  address: z.string().min(5).max(500),
  deliveryZone: z.enum(['tunis_centre', 'ariana', 'ben_arous', 'la_marsa', 'autre']),
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(20),
  })).min(1),
});

// Public: create order
router.post('/', validateBody(createOrderSchema), async (req, res) => {
  const { customerName, phone, address, deliveryZone, notes, items } = req.body;

  const order = await prisma.$transaction(async (tx) => {
    const variants = await tx.productVariant.findMany({
      where: { id: { in: items.map((i: any) => i.variantId) } },
      include: { product: true },
    });

    if (variants.length !== items.length) {
      throw new Error('NOT_FOUND');
    }

    const total = items.reduce((sum: number, item: any) => {
      const v = variants.find((v) => v.id === item.variantId)!;
      return sum + Number(v.price) * item.quantity;
    }, 0);

    const orderNumber = await generateOrderRef(tx);

    const order = await tx.order.create({
      data: {
        orderNumber,
        customerName,
        phone,
        address,
        deliveryZone,
        notes,
        total,
        items: {
          create: items.map((item: any) => {
            const v = variants.find((v) => v.id === item.variantId)!;
            return {
              productId: v.productId,
              variantId: v.id,
              quantity: item.quantity,
              unitPrice: v.price,
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true, image: true } },
            variant: { select: { weight: true } },
          },
        },
      },
    });

    return order;
  });

  res.status(201).json({ success: true, data: order });
});

// Public: track order by orderNumber
router.get('/:orderNumber/track', async (req, res) => {
  const orderNumber = req.params.orderNumber;
  if (!orderNumber || orderNumber.length < 3) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid order reference' } });
    return;
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      status: true,
      total: true,
      createdAt: true,
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          product: { select: { name: true } },
          variant: { select: { weight: true } },
        },
      },
    },
  });

  if (!order) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    return;
  }

  res.json({ success: true, data: order });
});

// Admin: list all orders
router.get('/admin/list', authenticate, async (req, res) => {
  const status = req.query.status as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
  const skip = (page - 1) * limit;

  const where = status ? { status: status as any } : {};

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            variant: { select: { weight: true } },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    success: true,
    data: {
      orders,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  });
});

// Admin: get single order
router.get('/admin/:id', authenticate, async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id as string },
    include: {
      items: {
        include: {
          product: { select: { name: true, image: true } },
          variant: { select: { weight: true, price: true } },
        },
      },
    },
  });

  if (!order) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    return;
  }

  res.json({ success: true, data: order });
});

// Admin: update status
const updateStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
});

router.patch('/admin/:id/status', authenticate, validateBody(updateStatusSchema), async (req, res) => {
  const order = await prisma.order.update({
    where: { id: req.params.id as string },
    data: { status: req.body.status },
  });

  res.json({ success: true, data: order });
});

export default router;
