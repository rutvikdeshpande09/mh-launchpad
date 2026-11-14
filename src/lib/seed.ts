import type { Business } from "./schemas";

// A fictional demo business so the app works on first boot.
// It is clearly labelled "Demo" in the UI and is not a real person.
export const SEED_BUSINESSES: Business[] = [
  {
    id: "seed-abuela",
    slug: "tamales-la-abuela",
    isDemo: true,
    published: true,
    ambassadorName: "Demo Ambassador",
    createdAt: "2026-11-13T00:00:00.000Z",
    avatarUrl: null,
    photos: [],
    altLang: { code: "es", label: "Spanish" },
    content: {
      businessName: "Tamales La Abuela",
      category: "Home-made tamales",
      tagline: {
        en: "Tamales made the way grandma taught us",
        alt: "Tamales hechos como nos enseñó la abuela",
      },
      about: {
        en: "Tamales are steamed in small batches using a recipe passed down through three generations. Orders for holidays and family gatherings are welcome, with a few days' notice.",
        alt: "Los tamales se cocinan al vapor en tandas pequeñas con una receta que pasó por tres generaciones. Aceptamos pedidos para fiestas y reuniones familiares con unos días de anticipación.",
      },
      services: [
        {
          name: { en: "Chicken Tamales", alt: "Tamales de pollo" },
          description: {
            en: "Shredded chicken in red chile sauce. Sold by the dozen.",
            alt: "Pollo deshebrado en salsa de chile rojo. Se venden por docena.",
          },
          price: "$28 / dozen",
          emoji: "🌽",
        },
        {
          name: { en: "Cheese & Poblano Tamales", alt: "Tamales de rajas con queso" },
          description: {
            en: "Roasted poblano strips with melted cheese. A vegetarian favorite.",
            alt: "Rajas de chile poblano asado con queso derretido. Un favorito vegetariano.",
          },
          price: "$26 / dozen",
          emoji: "🧀",
        },
        {
          name: { en: "Champurrado", alt: "Champurrado" },
          description: {
            en: "Warm, thick Mexican chocolate drink. Perfect with tamales.",
            alt: "Bebida espesa y caliente de chocolate mexicano. Perfecta con tamales.",
          },
          price: "$10 / liter",
          emoji: "☕",
        },
      ],
      highlights: [
        { en: "Three-generation recipe", alt: "Receta de tres generaciones" },
        { en: "Small batches", alt: "Tandas pequeñas" },
        { en: "Holiday orders welcome", alt: "Pedidos para fiestas" },
      ],
      hours: { en: "Orders 3 days ahead", alt: "Pedidos con 3 días de anticipación" },
      serviceArea: "Mountain House, CA",
      announcement: { en: "", alt: "" },
      theme: { primary: "#b45309", accent: "#15803d", emoji: "🌽" },
      cardTagline: "Grandma's recipe, made fresh",
    },
  },
];
