export type BusinessAdvert = {
  id: string;
  title: string;
  description: string;
  tagline?: string;
  image: string;
  website?: string;
  phone?: string;
  category?: string;
  rating?: number; // 1–5 stars
  isFeatured?: boolean;
  clicks?: number;
};
export const businessAdverts: BusinessAdvert[] = [
  {
    id: "AD-001",
    title: "Torbay Van Hire",
    description: "Affordable van rentals for sellers attending local boot fairs.",
    tagline: "Move more, earn more",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70",
    website: "https://torbayvanhire.co.uk",
    phone: "01803 123456",
    category: "Transport",
    rating: 4.7,
    isFeatured: true,
  },
  {
    id: "AD-002",
    title: "Paignton Coffee Co.",
    description: "Fresh artisan coffee served hot every weekend near major fairs.",
    tagline: "Fuel your flipping",
    image: "https://images.unsplash.com/photo-1509042239860-f550ce710b93",
    website: "https://paigntoncoffee.co.uk",
    phone: "01803 987654",
    category: "Food & Drink",
    rating: 4.8,
    isFeatured: true,
  },
  {
    id: "AD-003",
    title: "FlipMaster Scales",
    description: "Digital scales perfect for weighing items before listing online.",
    tagline: "Accuracy that pays",
    image: "https://images.unsplash.com/photo-1581091012184-5c7b1a5e0f3b",
    website: "https://flipmasterscales.com",
    category: "Tools",
    rating: 4.9,
  }
];
