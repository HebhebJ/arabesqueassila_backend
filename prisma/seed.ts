import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  const categories = await prisma.category.createMany({
    data: [
      { name: 'Bssissa', slug: 'bssissa', description: 'La spécialité maison — mélange de céréales torréfiées et fruits secs', image: '/assets/cat-bssissa.jpg', sortOrder: 1 },
      { name: 'Zrir', slug: 'zrir', description: 'Mélange traditionnel tunisien aux graines et fruits secs', image: '/assets/cat-zrir.jpg', sortOrder: 2 },
      { name: 'Hlou', slug: 'hlou', description: 'Pâtisseries tunisiennes fines', image: '/assets/cat-hlou.jpg', sortOrder: 3 },
      { name: 'Coffrets', slug: 'coffrets', description: 'Coffrets cadeaux et assortiments', image: '/assets/cat-coffrets.jpg', sortOrder: 4 },
      { name: 'Gâteaux', slug: 'gateaux', description: 'Gâteaux personnalisés sur commande', image: '/assets/cat-gateaux.jpg', sortOrder: 5 },
    ],
  });

  const catBssissa = await prisma.category.findUnique({ where: { slug: 'bssissa' } });
  const catZrir = await prisma.category.findUnique({ where: { slug: 'zrir' } });
  const catHlou = await prisma.category.findUnique({ where: { slug: 'hlou' } });
  const catCoffrets = await prisma.category.findUnique({ where: { slug: 'coffrets' } });
  const catGateaux = await prisma.category.findUnique({ where: { slug: 'gateaux' } });

  const products = [
    {
      name: 'Bssissa Amande',
      slug: 'bssissa-amande',
      description: 'Notre bssissa signature aux amandes soigneusement sélectionnées. Un équilibre parfait entre céréales torréfiées et amandes croquantes.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catBssissa!.id,
      variants: [
        { weight: '500g', price: 22 },
        { weight: '1kg', price: 38 },
      ],
    },
    {
      name: 'Bssissa Pistache',
      slug: 'bssissa-pistache',
      description: 'Bssissa premium aux pistaches vertes. Une saveur riche et authentique pour les amateurs de pistache.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catBssissa!.id,
      variants: [
        { weight: '500g', price: 24 },
        { weight: '1kg', price: 42 },
      ],
    },
    {
      name: 'Bssissa Chocolat',
      slug: 'bssissa-chocolat',
      description: 'La rencontre gourmande entre le cacao et les céréales torréfiées. Un délice pour les amateurs de chocolat.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catBssissa!.id,
      variants: [
        { weight: '500g', price: 20 },
        { weight: '1kg', price: 35 },
      ],
    },
    {
      name: 'Bssissa Noix',
      slug: 'bssissa-noix',
      description: 'Bssissa aux noix locales. Un goût terreux et réconfortant, parfait pour le petit-déjuner.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catBssissa!.id,
      variants: [
        { weight: '500g', price: 22 },
        { weight: '1kg', price: 36 },
      ],
    },
    {
      name: 'Bssissa Noisette',
      slug: 'bssissa-noisette',
      description: 'La douceur de la noisette associée aux céréales torréfiées. Une texture fondante et savoureuse.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catBssissa!.id,
      variants: [
        { weight: '500g', price: 23 },
        { weight: '1kg', price: 38 },
      ],
    },
    {
      name: 'Bssissa Trio',
      slug: 'bssissa-trio',
      description: 'Un mélange exclusif de trois saveurs signature : amande, pistache et noisette.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catBssissa!.id,
      variants: [
        { weight: '500g', price: 24 },
        { weight: '1kg', price: 39 },
      ],
    },
    {
      name: 'Bssissa Multi-Fekia',
      slug: 'bssissa-multi-fekia',
      description: 'Notre bssissa la plus généreuse avec un mélange de fruits secs variés.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catBssissa!.id,
      variants: [
        { weight: '500g', price: 24 },
        { weight: '1kg', price: 40 },
      ],
    },
    {
      name: 'Zrir Traditionnel',
      slug: 'zrir-traditionnel',
      description: 'Zrir authentique aux graines de sésame, noisettes et amandes. Parfait pour l\'hiver et le Ramadan.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catZrir!.id,
      featured: true,
      variants: [
        { weight: '500g', price: 35 },
        { weight: '1kg', price: 60 },
      ],
    },
    {
      name: 'Kâak Warka',
      slug: 'kaak-warka',
      description: 'Biscuits traditionnels en forme de fleur, croquants et parfumés à l\'eau de rose.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catHlou!.id,
      variants: [
        { weight: '250g', price: 18 },
        { weight: '500g', price: 32 },
      ],
    },
    {
      name: 'Baklawa Amande',
      slug: 'baklawa-amande',
      description: 'Fine pâte filo croustillante garnie d\'amandes et parfumée au sirop de fleur d\'oranger.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catHlou!.id,
      variants: [
        { weight: '500g', price: 45 },
        { weight: '1kg', price: 80 },
      ],
    },
    {
      name: 'Samsa',
      slug: 'samsa',
      description: 'Triangles croustillants aux amandes et noisettes, enrobés de sucre glace.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catHlou!.id,
      variants: [
        { weight: '500g', price: 38 },
        { weight: '1kg', price: 68 },
      ],
    },
    {
      name: 'Coffret Découverte',
      slug: 'coffret-decouverte',
      description: 'Assortiment de 3x250g de nos bssissas signature. Idéal pour offrir ou découvrir.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catCoffrets!.id,
      featured: true,
      variants: [
        { weight: '3x250g', price: 55 },
      ],
    },
    {
      name: 'Coffret Prestige',
      slug: 'coffret-prestige',
      description: 'Coffret luxueux avec bssissa, zrir et baklawa. Le cadeau parfait.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catCoffrets!.id,
      variants: [
        { weight: 'Assorti', price: 85 },
      ],
    },
    {
      name: 'Gâteau Personnalisé',
      slug: 'gateau-personnalise',
      description: 'Gâteau sur mesure pour vos occasions spéciales. Contactez-nous pour discuter de votre design.',
      image: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      categoryId: catGateaux!.id,
      variants: [
        { weight: '6-8 personnes', price: 80 },
        { weight: '10-12 personnes', price: 120 },
        { weight: '14-16 personnes', price: 160 },
      ],
    },
  ];

  for (const p of products) {
    const { variants, ...productData } = p as any;
    await prisma.product.create({
      data: {
        ...productData,
        gallery: [],
        variants: {
          create: variants,
        },
      },
    });
  }

  console.log('✅ Seed complete:');
  console.log(`   ${categories.count} categories`);
  console.log(`   ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
