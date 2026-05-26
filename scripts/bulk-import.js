/**
 * Bulk product importer for Arabesque Assila
 * Updates existing products by slug, creates new ones if missing.
 * Usage: cd arabesque-api && node scripts/bulk-import.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API_URL = process.env.API_URL || 'http://127.0.0.1:3001/api/v1';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'bolbolbol3';
const TMP_DIR = path.join(__dirname, '.tmp');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ── Helpers ───────────────────────────────────────────────

let AUTH_COOKIE = '';

function curl(args) {
  const authHeader = AUTH_COOKIE ? `-H "Cookie: ${AUTH_COOKIE}"` : '';
  const cmd = `curl -s -L ${authHeader} ${args}`;
  return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function apiLogin() {
  const bodyFile = path.join(TMP_DIR, 'login.json');
  fs.writeFileSync(bodyFile, JSON.stringify({ password: ADMIN_PASSWORD }));

  // Use -D to capture headers and extract the Set-Cookie
  const raw = execSync(
    `curl -s -L -X POST "${API_URL}/auth/login" -H "Content-Type: application/json" -d @"${bodyFile}" -D -`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  );

  const match = raw.match(/Set-Cookie:\s*(token=[^;\r\n]+)/i);
  if (!match) throw new Error('Login failed: no cookie in response');
  AUTH_COOKIE = match[1];

  const json = JSON.parse(raw.split('\r\n\r\n').pop());
  if (!json.success) throw new Error('Login failed: ' + raw);
  return json;
}

function uploadImage(filePath) {
  const res = curl(`-X POST "${API_URL}/admin/upload" -F "image=@${filePath}"`);
  const json = JSON.parse(res);
  if (!json.success) throw new Error(`Upload failed: ${res}`);
  return json.data.url;
}

function createProduct(product) {
  const bodyFile = path.join(TMP_DIR, 'product.json');
  fs.writeFileSync(bodyFile, JSON.stringify(product));
  const res = curl(`-X POST "${API_URL}/products" -H "Content-Type: application/json" -d @"${bodyFile}"`);
  const json = JSON.parse(res);
  if (!json.success) throw new Error(`Create failed: ${res}`);
  return json.data;
}

function updateProduct(id, product) {
  const bodyFile = path.join(TMP_DIR, 'product.json');
  fs.writeFileSync(bodyFile, JSON.stringify(product));
  const res = curl(`-X PATCH "${API_URL}/products/${id}" -H "Content-Type: application/json" -d @"${bodyFile}"`);
  const json = JSON.parse(res);
  if (!json.success) throw new Error(`Update failed: ${res}`);
  return json.data;
}

function getAdminProducts() {
  const res = curl(`"${API_URL}/products/admin/list"`);
  const json = JSON.parse(res);
  return json.data || [];
}

function getCategories() {
  const res = curl(`"${API_URL}/categories"`);
  const json = JSON.parse(res);
  return json.data || [];
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ── Main ──────────────────────────────────────────────────

async function main() {
  const configPath = path.join(__dirname, 'products.json');
  if (!fs.existsSync(configPath)) {
    console.error(`Missing ${configPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const productsDir = path.join(__dirname, '..', '..', 'products');

  console.log('Logging in...');
  apiLogin();
  console.log('Logged in.');

  console.log('Fetching existing products...');
  const existingProducts = getAdminProducts();
  const existingBySlug = {};
  for (const p of existingProducts) existingBySlug[p.slug] = p;
  console.log(`Found ${existingProducts.length} existing products.`);

  console.log('Fetching categories...');
  const categories = getCategories();
  const catMap = {};
  for (const c of categories) catMap[c.name.toLowerCase()] = c.id;
  console.log('Categories:', Object.keys(catMap).join(', '));

  for (const item of config.products) {
    console.log(`\n--- Processing: ${item.name} ---`);

    const categoryId = catMap[item.category?.toLowerCase()];
    if (!categoryId) {
      console.warn(`  ⚠ Category "${item.category}" not found, skipping ${item.name}`);
      continue;
    }

    const folderName = item.photoFolder || slugify(item.name);
    const folderPath = path.join(productsDir, folderName);
    if (!fs.existsSync(folderPath)) {
      console.warn(`  ⚠ Folder not found: ${folderPath}, skipping ${item.name}`);
      continue;
    }

    const files = fs.readdirSync(folderPath)
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map(f => path.join(folderPath, f));

    if (files.length === 0) {
      console.warn(`  ⚠ No images in ${folderPath}, skipping ${item.name}`);
      continue;
    }

    console.log(`  Uploading ${files.length} image(s)...`);
    const urls = [];
    for (const file of files) {
      try {
        const url = uploadImage(file);
        urls.push(url);
        process.stdout.write('.');
      } catch (err) {
        console.error(`\n  ✗ Upload error: ${err.message}`);
      }
    }
    console.log('');

    if (urls.length === 0) {
      console.warn(`  ⚠ No images uploaded, skipping ${item.name}`);
      continue;
    }

    const slug = item.slug || slugify(item.name);
    const product = {
      name: item.name,
      slug,
      description: item.description || '',
      image: urls[0],
      gallery: urls.slice(1),
      categoryId,
      featured: item.featured || false,
      variants: item.variants || [{ weight: '500g', price: item.price || 0, sku: '' }],
    };

    const existing = existingBySlug[slug];
    try {
      if (existing) {
        product.isAvailable = true;
        const updated = updateProduct(existing.id, product);
        console.log(`  ✓ Updated: ${updated.name} (ID: ${updated.id})`);
      } else {
        const created = createProduct(product);
        console.log(`  ✓ Created: ${created.name} (ID: ${created.id})`);
      }
    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  // Clean up
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });

  console.log('\nDone!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
