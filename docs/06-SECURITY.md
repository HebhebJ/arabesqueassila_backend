# Security Considerations

---

## 1. Authentication

- Admin password stored as **bcrypt hash** in env
- JWT secret min 32 chars, random
- `httpOnly`, `Secure`, `SameSite=Strict` cookie
- Token expiry: 24h
- Rate limit login: 5 attempts / minute / IP

## 2. Input Validation

All inputs validated with Zod before DB:
- Phone: `/^[23459]\d{7}$/` (Tunisian 8-digit)
- Names: min 2, max 100 chars
- Address: min 5, max 500 chars
- Quantity: 1-20
- File upload: image/* only, max 5MB

## 3. SQL Injection

Protected by Prisma (parameterized queries). Never write raw SQL without parameterization.

## 4. XSS

- React escapes output by default
- No `dangerouslySetInnerHTML` with user input
- CSP headers recommended

## 5. CORS

Whitelist only:
```
http://localhost:5173       (dev)
https://arabesque-assila.vercel.app   (prod)
```
Never `*` with credentials.

## 6. Order ID Enumeration

- Public tracking uses `orderNumber` (#1001) — sequential but low risk
- Internal APIs use UUID primary keys
- Public tracking endpoint returns limited fields (no phone/address)

## 7. File Upload

- Backend validates MIME type and size
- Multer uses `memoryStorage` (not disk) — no file system exposure
- Cloudinary handles virus scanning implicitly

## 8. Environment Variables

```ts
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3001'),
  DATABASE_URL: z.string().startsWith('postgresql://'),
  JWT_SECRET: z.string().min(32),
  ADMIN_PASSWORD_HASH: z.string().startsWith('$2'),
  FRONTEND_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

Fail fast on missing required vars.

## 9. Dependencies

Run `npm audit` weekly. Use `snyk` for automated scanning.

## 10. GDPR / Privacy

- Minimal data collection (no email needed)
- Phone required for delivery only
- No customer accounts = no password breaches
- Add privacy notice: "Vos données sont utilisées uniquement pour la livraison."
