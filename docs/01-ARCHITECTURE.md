# Arabesque Assila — System Architecture

> **Pattern**: Separate Frontend (Vite SPA) + Backend (Express API)  
> **Date**: 2026-05-26  
> **Status**: FINAL — Approved for implementation  

---

## 1. High-Level Overview

```
┌─────────────────┐      HTTPS       ┌──────────────────┐      TCP       ┌─────────────────┐
│   Customer      │ ◄──────────────► │   Vite React     │ ◄────────────► │  Express.js     │
│   Browser       │                  │   SPA (Frontend) │   REST JSON    │  API (Backend)  │
└─────────────────┘                  │   Vercel         │                │   Railway       │
                                     └──────────────────┘                └────────┬────────┘
                                                                                  │
                                                                                  │ TCP
                                                                                  ▼
                                                                         ┌─────────────────┐
                                                                         │  PostgreSQL 16  │
                                                                         │  Railway (5GB)  │
                                                                         └─────────────────┘

External Services:
  - Cloudinary (Images CDN + Upload via backend proxy)
  - WhatsApp (wa.me links for order confirmation)
```

### Why This Architecture?

| Concern | Decision | Rationale |
|---------|----------|-----------|
| **Frontend** | Vite React SPA (not Next.js) | Preserves existing Kimi agent GSAP/Lenis animations; simpler deployment |
| **Backend** | Express.js (not Fastify) | Familiar, proven, massive ecosystem — pragmatic choice |
| **Database** | PostgreSQL 5GB on Railway | Generous for text data; images go to Cloudinary |
| **ORM** | Prisma | Best DX, migrations, type-safe, relational queries perfect for e-com |
| **State** | Zustand + localStorage (cart) | No auth needed for customers |
| **Images** | Backend proxy upload | Simpler security model; admin-only use |

---

## 2. Technology Stack

### Frontend — `arabesque-web/`

| Layer | Tech | Justification |
|-------|------|---------------|
| Build Tool | Vite | Fast HMR, simple config, already working |
| Framework | React 19 + TypeScript | Existing codebase, familiar |
| Routing | React Router v7 | Already in dependencies, SPA navigation |
| Styling | Tailwind CSS v3 | Already configured, utility-first |
| Components | shadcn/ui | Already installed, accessible |
| Animation | GSAP + Lenis | Already working beautifully |
| State (Server) | TanStack Query | Caching, background refetch |
| State (Client) | Zustand + persist | Cart state, minimal boilerplate |
| Forms | React Hook Form + Zod | Type-safe validation |
| HTTP Client | Fetch API + credentials | Native, sends cookies for admin auth |
| Meta Tags | React Helmet Async | SEO for SPA |
| Deploy | Vercel | Drag-drop or Git push |

### Backend — `arabesque-api/`

| Layer | Tech | Justification |
|-------|------|---------------|
| Runtime | Node.js 22 LTS | Stable, Railway native |
| Framework | Express.js 4.x | Familiar, middleware ecosystem |
| Language | TypeScript | Type safety |
| Validation | Zod | Share schemas between frontend/backend |
| ORM | Prisma | Migrations, relational queries, Studio GUI |
| Database | PostgreSQL 16 | ACID, JSON support, Railway native |
| Auth | `jsonwebtoken` + `bcrypt` | Stateless JWT, httpOnly cookie |
| Upload | `multer` + Cloudinary SDK | Backend receives file → proxies to Cloudinary |
| CORS | `cors` middleware | Whitelist frontend domain |
| Logging | `pino` or `morgan` | Request logging |
| Deploy | Railway | Nixpacks auto-detects Node.js |

---

## 3. Communication Contract

### API Style
- **REST** JSON API
- **Base path**: `/api/v1`
- **Credentials**: `include` on all requests (cookies)

### Response Format
```ts
// Success
type ApiResponse<T> = {
  success: true;
  data: T;
  meta?: { timestamp: string };
};

// Error
type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
};
```

### CORS Policy
```
Access-Control-Allow-Origin: <frontend-url>
Access-Control-Allow-Methods: GET, POST, PATCH, DELETE
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

---

## 4. Domain Model

```
Category ───┬──► Product ───┬──► ProductVariant
            │                │
            └──► (image)     └──► OrderItem ───► Order
            │                │
            └──► gallery[]   └──► (existing image picker)
```

### Product Images
Each product has:
- **Main image** (`image`) — featured on cards and as default detail view
- **Gallery** (`gallery: String[]`) — additional images shown as thumbnails on product detail

Images are uploaded via backend proxy to Cloudinary.

### Product Variants
A Product is a family (e.g., "Bssissa Amande"). Variants are size/price combinations:
- "Bssissa Amande" → 500g @ 22 TND, 1kg @ 38 TND

### Order Lifecycle
```
[PENDING] ──► [CONFIRMED] ──► [PREPARING] ──► [OUT_FOR_DELIVERY] ──► [DELIVERED]
    │
    └──► [CANCELLED]
```

### Business Rules
1. Product belongs to one Category.
2. Product has 1+ Variants (price + weight).
3. Order has many OrderItems.
4. OrderItem references Product + Variant + snapshots unitPrice.
5. No customer accounts. Orders tracked by order reference (#ARB-482913) or phone.
6. Single admin (hardcoded). JWT cookie auth.
7. WhatsApp number: **+216 22 67 01 95**

---

## 5. Folder Structure

```
Arabesque/
├── docs/                          # Architecture documentation
├── arabesque-web/                 # Vite React SPA (from Kimi agent)
│   ├── src/
│   │   ├── pages/                 # Route pages
│   │   ├── sections/              # Homepage sections (existing)
│   │   ├── components/            # Reusable components
│   │   ├── stores/                # Zustand stores
│   │   ├── hooks/                 # TanStack Query hooks
│   │   ├── lib/                   # API client, utils
│   │   └── types/                 # TypeScript types
│   └── package.json
├── arabesque-api/                 # Express + Prisma backend
│   ├── src/
│   │   ├── routes/                # API route handlers
│   │   ├── middleware/            # Auth, error handler, validation
│   │   ├── services/              # DB operations (Prisma)
│   │   ├── types/                 # Shared types
│   │   └── app.ts / server.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── scripts/                   # Bulk import tool
│   │   ├── bulk-import.js
│   │   └── products.json
│   └── package.json
└── products/                      # Source product photos
```

---

## 6. Roadmap

| Phase | Scope | ETA |
|-------|-------|-----|
| **MVP** | Backend API + DB with variants, shop (browse, cart, checkout), admin login + orders | Week 1-2 |
| **v1.1** | Product CRUD in admin, Cloudinary uploads, order status workflow, stats | Week 3 |
| **v1.2** | WhatsApp deep links, email notifications, customer order lookup by phone | Week 4 |

---

## 7. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| **Availability** | 99% (Vercel + Railway) |
| **API Response** | < 150ms p95 |
| **Security** | Input validation, JWT auth, SQL injection protection (Prisma) |
| **SEO** | React Helmet meta tags, structured data |
| **Mobile** | Responsive, touch-friendly |

---

## 8. Decisions Log

| Decision | Choice | Date |
|----------|--------|------|
| Frontend framework | Keep Vite React SPA (Kimi agent) | 2026-05-26 |
| Backend framework | Express.js | 2026-05-26 |
| ORM | Prisma | 2026-05-26 |
| Upload pattern | Backend proxy (multer → Cloudinary) | 2026-05-26 |
| Product variants | Yes — separate `ProductVariant` table | 2026-05-26 |
| Order numbers | Yes — `orderNumber` auto-increment | 2026-05-26 |
| Monorepo | Single repo, two subdirs | 2026-05-26 |
| WhatsApp | +216 22 67 01 95 | 2026-05-26 |
