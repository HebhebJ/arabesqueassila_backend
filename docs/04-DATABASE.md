# Database Design — PostgreSQL + Prisma

> Railway PostgreSQL 5GB. Prisma ORM.

---

## 1. Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Category {
  id          String    @id @default(uuid())
  name        String
  slug        String    @unique
  description String?
  image       String?
  sortOrder   Int       @default(0)
  products    Product[]
  createdAt   DateTime  @default(now())
}

model Product {
  id          String           @id @default(uuid())
  name        String
  slug        String           @unique
  description String?
  image       String
  gallery     String[]
  categoryId  String
  category    Category         @relation(fields: [categoryId], references: [id])
  variants    ProductVariant[]
  featured    Boolean          @default(false)
  isAvailable Boolean          @default(true)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt

  orderItems  OrderItem[]
}

model ProductVariant {
  id          String   @id @default(uuid())
  productId   String
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  weight      String   // e.g. "500g", "1kg", "3x250g"
  price       Decimal  @db.Decimal(10, 3)
  sku         String?  // Optional internal SKU
  isAvailable Boolean  @default(true)
  createdAt   DateTime @default(now())

  orderItems  OrderItem[]
}

enum OrderStatus {
  PENDING
  CONFIRMED
  PREPARING
  OUT_FOR_DELIVERY
  DELIVERED
  CANCELLED
}

model Order {
  id            String      @id @default(uuid())
  orderNumber   String      @unique
  status        OrderStatus @default(PENDING)
  customerName  String
  phone         String
  address       String
  deliveryZone  String
  notes         String?
  total         Decimal     @db.Decimal(10, 3)
  items         OrderItem[]
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([status])
  @@index([createdAt])
  @@index([phone])
}

model OrderItem {
  id          String          @id @default(uuid())
  orderId     String
  order       Order           @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   String
  product     Product         @relation(fields: [productId], references: [id])
  variantId   String?
  variant     ProductVariant? @relation(fields: [variantId], references: [id])
  quantity    Int
  unitPrice   Decimal         @db.Decimal(10, 3)
  createdAt   DateTime        @default(now())
}
```

---

## 2. Schema Explanation

### Product Variants
Instead of flat products, we have:
- **Product**: The family/brand ("Bssissa Amande")
- **ProductVariant**: The purchasable unit ("500g @ 22 TND", "1kg @ 38 TND")

This lets us:
- Show one product card with "à partir de 22 TND"
- Let customer pick size on detail page
- Track inventory per variant (future)

### Order Number
`orderNumber String @unique` stores professional references like `ARB-482913` — random 6-digit with prefix, no volume leak.
UUIDs are still the PK for security (internal use only).

### OrderItem Snapshots
- `unitPrice` is snapshot at purchase time (price may change later)
- `productId` and `variantId` maintain referential integrity
- Can join back to current product data if needed

---

## 3. Indexes

```prisma
@@index([status])       // Admin filtering by status
@@index([createdAt])    // Recent orders, dashboard stats
@@index([phone])        // Customer lookup
```

---

## 4. Seed Data

Based on existing hardcoded products + your business plan:

```ts
// prisma/seed.ts
const categories = [
  { name: 'Bssissa', slug: 'bssissa', description: '...' },
  { name: 'Zrir', slug: 'zrir', description: '...' },
  { name: 'Hlou', slug: 'hlou', description: '...' },
  { name: 'Coffrets', slug: 'coffrets', description: '...' },
];

const products = [
  {
    name: 'Bssissa Amande',
    slug: 'bssissa-amande',
    category: 'Bssissa',
    variants: [
      { weight: '500g', price: 22 },
      { weight: '1kg', price: 38 },
    ],
  },
  {
    name: 'Bssissa Pistache',
    slug: 'bssissa-pistache',
    category: 'Bssissa',
    variants: [
      { weight: '500g', price: 24 },
      { weight: '1kg', price: 42 },
    ],
  },
  {
    name: 'Zrir Traditionnel',
    slug: 'zrir-traditionnel',
    category: 'Zrir',
    variants: [
      { weight: '500g', price: 35 },
      { weight: '1kg', price: 60 },
    ],
  },
  // ... etc
];
```

---

## 5. Migration Commands

```bash
# Development
npx prisma migrate dev --name init

# After schema change
npx prisma migrate dev --name add_featured_flag

# Production (Railway)
npx prisma migrate deploy

# Generate client
npx prisma generate

# Open Studio GUI
npx prisma studio

# Seed
npx tsx prisma/seed.ts
```

---

## 6. Key Queries

### Get products with variants (shop catalog)
```ts
const products = await prisma.product.findMany({
  where: { isAvailable: true },
  include: {
    category: { select: { name: true, slug: true } },
    variants: {
      where: { isAvailable: true },
      orderBy: { price: 'asc' },
    },
  },
  orderBy: { createdAt: 'desc' },
});
```

### Create order with items (transaction)
```ts
await prisma.$transaction(async (tx) => {
  // 1. Fetch variant prices to calculate total
  const variants = await tx.productVariant.findMany({
    where: { id: { in: itemIds } },
  });
  
  const total = items.reduce((sum, item) => {
    const v = variants.find(v => v.id === item.variantId)!;
    return sum + v.price * item.quantity;
  }, 0);

  // 2. Create order
  const order = await tx.order.create({
    data: { customerName, phone, address, deliveryZone, notes, total },
  });

  // 3. Create order items
  await tx.orderItem.createMany({
    data: items.map(item => ({
      orderId: order.id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      unitPrice: variants.find(v => v.id === item.variantId)!.price,
    })),
  });

  return order;
});
```

### Admin dashboard stats
```ts
const [todayCount, pendingCount, monthRevenue] = await Promise.all([
  prisma.order.count({
    where: { createdAt: { gte: todayStart } },
  }),
  prisma.order.count({
    where: { status: 'PENDING' },
  }),
  prisma.order.aggregate({
    where: { status: { not: 'CANCELLED' }, createdAt: { gte: monthStart } },
    _sum: { total: true },
  }),
]);
```
