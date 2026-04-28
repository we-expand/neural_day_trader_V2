/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - PARTNERS MODULE                              ║
 * ║  Types & Interfaces                                               ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

export type PartnerCategory = 
  | 'broker' 
  | 'data-provider' 
  | 'prop-firm' 
  | 'education' 
  | 'technology' 
  | 'exchange';

export type PartnerTier = 'platinum' | 'gold' | 'silver' | 'bronze';

export interface Partner {
  id: string;
  name: string;
  logo: string;
  description: string;
  category: PartnerCategory;
  tier: PartnerTier;
  website: string;
  benefits: string[];
  specialOffer?: string;
  discount?: string;
  rating: number;
  usersCount: number;
  established: number;
  locations: string[];
  verified: boolean;
  featured: boolean;
}

export interface PartnerStats {
  totalPartners: number;
  totalUsers: number;
  averageRating: number;
  categories: number;
}
