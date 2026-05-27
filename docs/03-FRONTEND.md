# Frontend Design — `arabesque-web/`

> Vite React SPA evolved from the Kimi agent vitrine. Deployed on Vercel.

---

## 1. Route Structure (React Router v7)

### Public Shop

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `HomePage` | Existing vitrine sections (Hero, Flavors, Heritage, Products, OrderInfo, About, Footer) |
| `/produits` | `ProductsPage` | Full catalog with filters + pagination |
| `/produit/:slug` | `ProductDetailPage` | Product info + variant selector + add to cart |
| `/panier` | `CartPage` | Cart review (or Sheet drawer) |
| `/commande` | `CheckoutPage` | Customer info form |
| `/commande/merci` | `OrderSuccessPage` | Confirmation + WhatsApp link + order number |
| `/suivi/:orderNumber` | `OrderTrackPage` | Public order status lookup |

### Admin Panel (wrapped in `AdminLayout` with persistent sidebar)

| Route | Component | Description |
|-------|-----------|-------------|
| `/admin/login` | `AdminLoginPage` | Password form (no sidebar) |
| `/admin` | `AdminDashboardPage` | Stats + recent orders |
| `/admin/commandes` | `AdminOrdersPage` | All orders table |
| `/admin/commandes/:id` | `AdminOrderDetailPage` | Order detail + status change |
| `/admin/produits` | `AdminProductsPage` | Product list + enable/disable toggle |
| `/admin/produits/nouveau` | `AdminProductFormPage` | Create product |
| `/admin/produits/:slug/modifier` | `AdminProductFormPage` | Edit product (image picker + gallery) |

---

## 2. State Management

### Cart Store (Zustand + localStorage)

```ts
interface CartItem {
  variantId: string;
  productName: string;
  variantWeight: string;
  price: number;
  quantity: number;
  image: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (variant: Variant, product: Product, quantity: number) => void;
  removeItem: (variantId: string) => void;
  updateQty: (variantId: string, quantity: number) => void;
  clear: () => void;
  total: number;
  count: number;
}
```

```ts
export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (variant, product, qty) => {
        const items = get().items;
        const existing = items.find(i => i.variantId === variant.id);
        if (existing) {
          existing.quantity += qty;
          set({ items: [...items] });
        } else {
          set({ items: [...items, {
            variantId: variant.id,
            productName: product.name,
            variantWeight: variant.weight,
            price: variant.price,
            quantity: qty,
            image: product.image,
          }]});
        }
      },
      removeItem: (id) => set({ items: get().items.filter(i => i.variantId !== id) }),
      updateQty: (id, qty) => set({
        items: get().items.map(i => i.variantId === id ? { ...i, quantity: qty } : i)
      }),
      clear: () => set({ items: [] }),
      get total() { return get().items.reduce((s, i) => s + i.price * i.quantity, 0); },
      get count() { return get().items.reduce((s, i) => s + i.quantity, 0); },
    }),
    { name: 'arabesque-cart' }
  )
);
```

### Server State (TanStack Query)

```ts
// hooks/use-products.ts
export function useProducts(category?: string) {
  return useQuery({
    queryKey: ['products', category],
    queryFn: () => api.get(`/products?category=${category || ''}`),
    staleTime: 5 * 60 * 1000,
  });
}

// hooks/use-product.ts
export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: () => api.get(`/products/${slug}`),
  });
}
```

---

## 3. API Client

```ts
// lib/api.ts
const API_URL = import.meta.env.VITE_API_URL;

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, { credentials: 'include' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error.message);
    return json.data;
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error.message);
    return json.data;
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    // similar...
  },
};
```

---

## 4. Component Inventory

### Existing (Keep)
- `Navigation` — Nos Saveurs / Notre Histoire / Commander / **Liste Produits** + cart badge
- `Hero` — Keep as-is
- `Flavors` — Keep as-is
- `Heritage` — Keep as-is
- `Products` — **Evolve**: Replace hardcoded data with API + add "Ajouter" logic
- `OrderInfo` — **Evolve**: Link to `/commande` instead of raw WhatsApp
- `About` / `Footer` — Keep as-is

### Admin Product Form
- Main image upload
- Gallery upload (multiple images at once)
- Gallery thumbnails with delete
- Dynamic variant add/remove (weight, price, SKU)

### New Components

| Component | Purpose |
|-----------|---------|
| `ProductCard` | Image, name, price range, quick add |
| `ImageGallery` | Main image + thumbnail gallery on product detail |
| `VariantSelector` | Weight/size selector on product detail |
| `QuantityStepper` | - / qty / + |
| `CartDrawer` | Slide-out cart (Sheet) |
| `CartLineItem` | Item in cart/drawer |
| `CheckoutForm` | Name, phone, address, zone, notes |
| `OrderStatusBadge` | Colored badge per status |
| `AdminLayout` | Persistent sidebar nav (Dashboard / Commandes / Produits / Déconnexion) |
| `ScrollToTop` | Scrolls to top on every route change |
| `ImageUpload` | Dropzone + preview |
| `ImagePicker` | Modal to browse & select existing Cloudinary images |

---

## 5. WhatsApp Integration

Order confirmation page generates a `wa.me` link with pre-filled message:

```ts
function generateWhatsAppLink(orderNumber: number, total: number, items: CartItem[]) {
  const itemList = items.map(i => `- ${i.productName} (${i.variantWeight}) x${i.quantity}`).join('\n');
  const message = encodeURIComponent(
    `Bonjour Arabesque Assila !\n\n` +
    `Je viens de passer la commande #${orderNumber}.\n\n` +
    `${itemList}\n\n` +
    `Total: ${total} TND\n\n` +
    `Merci !`
  );
  return `https://wa.me/21622670195?text=${message}`;
}
```

---

## 6. Environment Variables

```env
# .env.local
VITE_API_URL=http://localhost:3001/api/v1
VITE_CLOUDINARY_CLOUD_NAME=xxx

# .env.production
VITE_API_URL=https://your-api.railway.app/api/v1
VITE_CLOUDINARY_CLOUD_NAME=xxx
```

---

## 7. Responsive Strategy

Same breakpoints as existing Tailwind config. The Kimi agent already built mobile-responsive sections.

Key mobile considerations:
- Cart drawer instead of cart page on mobile
- Sticky "Commander" CTA on product detail
- Simplified admin table on mobile (card list instead of table)

---

## 8. SEO (SPA Limitations)

Since we're SPA (not SSR):
- Use `react-helmet-async` for `<title>` and `<meta>` per route
- Add Open Graph tags for product pages
- Consider prerendering `/` and `/produits` with `vite-plugin-ssr` or `prerender` if needed later

For a local Tunisian business, social media (Instagram/Facebook) drives more traffic than Google SEO.
