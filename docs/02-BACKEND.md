# Backend Design — `arabesque-api/`

> Express.js API on Railway. Prisma ORM. PostgreSQL 5GB.

---

## 1. Tech Stack

```
Express 4.x
├── TypeScript (ts-node-dev for dev, tsc for build)
├── Prisma (ORM + migrations)
├── Zod (input validation)
├── bcrypt (password hashing)
├── jsonwebtoken (JWT)
├── multer (file upload)
├── cloudinary (image hosting)
├── cors (CORS)
├── cookie-parser (cookie parsing)
└── dotenv (env vars)
```

---

## 2. API Endpoints

### Public Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/v1/categories` | List categories |
| `GET` | `/api/v1/categories/:slug` | Category + products |
| `GET` | `/api/v1/products` | List products (with variants) |
| `GET` | `/api/v1/products/:slug` | Single product with variants |
| `POST` | `/api/v1/orders` | Create order |
| `GET` | `/api/v1/orders/:orderNumber/track` | Public order tracking |

### Admin Routes (JWT Required)

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/v1/auth/login` | Login → sets httpOnly cookie |
| `POST` | `/api/v1/auth/logout` | Clear cookie |
| `GET` | `/api/v1/auth/me` | Verify auth status |
| `GET` | `/api/v1/admin/orders` | List orders |
| `GET` | `/api/v1/admin/orders/:id` | Order detail |
| `PATCH` | `/api/v1/admin/orders/:id/status` | Update status |
| `GET` | `/api/v1/products/admin/list` | List **all** products (admin, includes inactive) |
| `POST` | `/api/v1/products` | Create product |
| `PATCH` | `/api/v1/products/:id` | Update product |
| `DELETE`| `/api/v1/products/:id` | Soft delete |
| `POST` | `/api/v1/admin/upload` | Upload image → Cloudinary |
| `GET` | `/api/v1/admin/upload/images` | List existing Cloudinary images |

---

## 3. Authentication

### Design
- Single admin user, hardcoded password hash in env.
- JWT stored in `httpOnly`, `Secure`, `SameSite=Strict` cookie.
- Token expiry: 24 hours.

### Login
```
POST /api/v1/auth/login
Body: { "password": "string" }

Response 200:
  Set-Cookie: token=<jwt>; HttpOnly; Secure; SameSite=Strict; Max-Age=86400
  { success: true }

Response 401:
  { success: false, error: { code: "INVALID_CREDENTIALS", message: "..." } }
```

### Logout
```
POST /api/v1/auth/logout
Response:
  Set-Cookie: token=; Max-Age=0
  { success: true }
```

### Auth Middleware
```ts
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' } });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { admin: boolean };
    if (!decoded.admin) throw new Error();
    req.admin = decoded;
    next();
  } catch {
    res.status(401).send({ success: false, error: { code: 'UNAUTHORIZED' } });
  }
};
```

---

## 4. Order Lifecycle

| Status | Meaning | Trigger |
|--------|---------|---------|
| `PENDING` | New order | Auto on creation |
| `CONFIRMED` | Mom verified she can make it | Admin action |
| `PREPARING` | Currently being made | Admin action |
| `OUT_FOR_DELIVERY` | With delivery person | Admin action |
| `DELIVERED` | Customer received & paid | Admin action |
| `CANCELLED` | Cannot fulfill | Admin action |

**Order references**: Format `ARB-XXXXXX` (random 6-digit), stored as `String @unique`.

### Create Order
```ts
POST /api/v1/orders
Body (Zod):
{
  customerName: string.min(2).max(100),
  phone: string.regex(/^[23459]\d{7}$/),     // Tunisian 8-digit mobile
  address: string.min(5).max(500),
  deliveryZone: enum(['tunis_centre', 'ariana', 'ben_arous', 'la_marsa', 'autre']),
  notes?: string.max(1000),
  items: array({
    variantId: string.uuid,
    quantity: number.int.min(1).max(20)
  }).min(1),
}

// Server calculates total from variant prices
// Returns: { success: true, data: { orderNumber: 'ARB-482913', status: 'PENDING', total: 85.000 } }
```

### Public Tracking
```ts
GET /api/v1/orders/ARB-482913/track
Response: { orderNumber, status, total, createdAt, items: [...] }
// Deliberately excludes: customerName, phone, address
```

---

## 5. Upload Flow (Backend Proxy)

```
Admin Panel
    │
    │ POST /api/v1/admin/upload
    │ Content-Type: multipart/form-data
    │ Body: file (image, max 5MB)
    ▼
Express + Multer
    │
    │ → Validate file (image/*, < 5MB)
    │ → Upload to Cloudinary
    │ → Return Cloudinary URL
    ▼
Response: { success: true, data: { url: "https://res.cloudinary.com/..." } }
```

### Multer Config
```ts
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  },
});
```

---

## 6. Environment Variables

```env
PORT=3001
NODE_ENV=development

DATABASE_URL=postgresql://user:pass@host:5432/arabesque

ADMIN_PASSWORD_HASH=$2b$10$...          # bcrypt hash
JWT_SECRET=min-32-char-random-string     # strong secret

CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx

FRONTEND_URL=http://localhost:3000       # Vite config sets port 3000
```

---

## 7. Error Handling

```ts
// Global error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err);

  if (err.name === 'ZodError') {
    return res.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: err.message }
    });
  }

  if (err.message === 'UNAUTHORIZED') {
    return res.status(401).send({
      success: false, error: { code: 'UNAUTHORIZED', message: 'Auth required' }
    });
  }

  res.status(500).send({
    success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' }
  });
});
```

---

## 8. Express App Structure

```
src/
├── server.ts              # Entry point, starts HTTP server
├── app.ts                 # Express app config (middleware, routes)
├── config/
│   └── env.ts             # Validated env vars
├── middleware/
│   ├── auth.ts            # JWT verification
│   ├── error-handler.ts   # Global error handler
│   └── validate.ts        # Zod request validation wrapper
├── routes/
│   ├── auth.routes.ts
│   ├── product.routes.ts
│   ├── category.routes.ts
│   ├── order.routes.ts
│   └── admin.routes.ts
├── services/
│   ├── product.service.ts
│   ├── order.service.ts
│   └── upload.service.ts
├── types/
│   └── express.d.ts       # Extend Request type
└── utils/
    └── cloudinary.ts      # Cloudinary config
```
