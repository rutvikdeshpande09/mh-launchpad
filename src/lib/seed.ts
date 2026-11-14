import type { Business } from "./schemas";

// Two fictional demo businesses so the app works on first boot.
// They are clearly labelled "Demo" in the UI and are not real people.
export const SEED_BUSINESSES: Business[] = [
  {
    id: "seed-madhuri",
    slug: "madhuris-home-kitchen",
    isDemo: true,
    ambassadorName: "Demo Ambassador",
    createdAt: "2026-11-13T00:00:00.000Z",
    avatarUrl: null,
    photos: [],
    altLang: { code: "hi", label: "Hindi" },
    content: {
      businessName: "Madhuri's Home Kitchen",
      category: "Home-style Indian snacks",
      tagline: {
        en: "Fresh, handmade snacks from our family kitchen",
        alt: "हमारे घर की रसोई से ताज़ा, हाथ से बने नाश्ते",
      },
      about: {
        en: "Everything is made fresh to order in a home kitchen using family recipes. Orders are open on weekends, and every batch is cooked in small quantities so it arrives warm and tasty.",
        alt: "सब कुछ घर की रसोई में पारिवारिक नुस्खों से ऑर्डर पर ताज़ा बनाया जाता है। ऑर्डर सप्ताहांत में खुले रहते हैं, और हर बैच छोटी मात्रा में बनता है ताकि गरमागरम और स्वादिष्ट पहुँचे।",
      },
      services: [
        {
          name: { en: "Punjabi Samosas", alt: "पंजाबी समोसे" },
          description: {
            en: "Crispy pastry filled with spiced potato and peas. Sold in boxes of six.",
            alt: "मसालेदार आलू और मटर से भरी कुरकुरी पेस्ट्री। छह के डिब्बे में उपलब्ध।",
          },
          price: "$9 / box of 6",
          emoji: "🥟",
        },
        {
          name: { en: "Masala Chai", alt: "मसाला चाय" },
          description: {
            en: "Slow-simmered tea with ginger and cardamom, in a 1-liter flask.",
            alt: "अदरक और इलायची के साथ धीमी आँच पर पकी चाय, 1 लीटर के फ्लास्क में।",
          },
          price: "$8",
          emoji: "🍵",
        },
        {
          name: { en: "Gulab Jamun", alt: "गुलाब जामुन" },
          description: {
            en: "Soft milk dumplings soaked in rose-cardamom syrup. Box of eight.",
            alt: "गुलाब और इलायची की चाशनी में डूबे नरम खोया के गोले। आठ का डिब्बा।",
          },
          price: "$12",
          emoji: "🍯",
        },
      ],
      highlights: [
        { en: "Made fresh to order", alt: "ऑर्डर पर ताज़ा बना" },
        { en: "Family recipes", alt: "पारिवारिक नुस्खे" },
        { en: "Vegetarian menu", alt: "शाकाहारी मेन्यू" },
      ],
      hours: { en: "Weekends, by order", alt: "सप्ताहांत, ऑर्डर पर" },
      serviceArea: "Mountain House, CA",
      announcement: { en: "", alt: "" },
      theme: { primary: "#c2410c", accent: "#0f766e", emoji: "🥟" },
      cardTagline: "Fresh family-recipe snacks",
    },
  },
  {
    id: "seed-abuela",
    slug: "tamales-la-abuela",
    isDemo: true,
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
