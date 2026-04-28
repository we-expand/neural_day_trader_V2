/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - MARKETPLACE                                  ║
 * ║  Types & Interfaces                                               ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency: string;
  image: string;
  badge?: 'best-seller' | 'new' | 'exclusive' | 'premium';
  features: string[];
  benefits: string[];
  included: string[];
  rating: number;
  reviews: number;
  sales: number;
  category: 'risk-management' | 'ai-tools' | 'automation' | 'analytics' | 'education';
  type: 'software' | 'subscription' | 'course' | 'lifetime';
  isOwnProduct?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
