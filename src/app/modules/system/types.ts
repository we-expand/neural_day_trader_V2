/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  SYSTEM MODULE - TYPESCRIPT TYPES                                 ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

export type SystemPage = 
  | 'admin'
  | 'innovation'
  | 'monitoring'
  | 'users'
  | 'security'
  | 'marketdata';

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalTrades: number;
  systemUptime: number;
}