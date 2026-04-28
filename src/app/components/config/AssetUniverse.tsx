import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Globe, 
  Coins, 
  BarChart, 
  Building2, 
  Search, 
  Check, 
  Filter, 
  Layers,
  Sparkles,
  TrendingUp,
  Zap,
  Clock
} from 'lucide-react';

// --- DATA DEFINITIONS ---

// Helper for Tailwind classes to ensure scanner picks them up
const THEME_COLORS = {
  purple: {
    base: 'purple',
    text: 'text-purple-400',
    textDark: 'text-purple-300',
    bgLight: 'bg-purple-500/10',
    bgDark: 'bg-purple-500/5',
    bgHighlight: 'bg-purple-500/20',
    bgFull: 'bg-purple-500',
    border: 'border-purple-500/50',
    borderFull: 'border-purple-500',
    icon: 'text-purple-400'
  },
  emerald: {
    base: 'emerald',
    text: 'text-emerald-400',
    textDark: 'text-emerald-300',
    bgLight: 'bg-emerald-500/10',
    bgDark: 'bg-emerald-500/5',
    bgHighlight: 'bg-emerald-500/20',
    bgFull: 'bg-emerald-500',
    border: 'border-emerald-500/50',
    borderFull: 'border-emerald-500',
    icon: 'text-emerald-400'
  },
  blue: {
    base: 'blue',
    text: 'text-blue-400',
    textDark: 'text-blue-300',
    bgLight: 'bg-blue-500/10',
    bgDark: 'bg-blue-500/5',
    bgHighlight: 'bg-blue-500/20',
    bgFull: 'bg-blue-500',
    border: 'border-blue-500/50',
    borderFull: 'border-blue-500',
    icon: 'text-blue-400'
  },
  amber: {
    base: 'amber',
    text: 'text-amber-400',
    textDark: 'text-amber-300',
    bgLight: 'bg-amber-500/10',
    bgDark: 'bg-amber-500/5',
    bgHighlight: 'bg-amber-500/20',
    bgFull: 'bg-amber-500',
    border: 'border-amber-500/50',
    borderFull: 'border-amber-500',
    icon: 'text-amber-400'
  }
};

type ThemeColorKey = keyof typeof THEME_COLORS;

interface AssetCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: ThemeColorKey; 
  assets: AssetGroup[];
}

interface AssetGroup {
  name: string;
  items: Asset[];
}

interface Asset {
  symbol: string; // ID used for logic
  display: string; // Display name
  name: string; // Full name
  volatility?: 'Low' | 'Medium' | 'High' | 'Extreme';
}

// 🔥 BASE DE DADOS COMPLETA DA INFINOX - SINCRONIZADA COM MT5
export const ASSET_DATABASE: AssetCategory[] = [
  {
    id: 'crypto',
    label: 'Criptoativos (24/7)',
    icon: <Coins className="w-4 h-4" />,
    color: 'purple',
    assets: [
      {
        name: 'Majors (Bitcoin & Ethereum)',
        items: [
          { symbol: 'XBNUSD', display: 'XBNUSD', name: 'Bitcoin', volatility: 'High' },
          { symbol: 'BTCUSD', display: 'BTCUSD', name: 'Bitcoin USD', volatility: 'High' },
          { symbol: 'XETUSD', display: 'XETUSD', name: 'Ethereum', volatility: 'High' },
          { symbol: 'XETLC', display: 'XETLC', name: 'Ethereum Classic', volatility: 'High' },
          { symbol: 'XETEUR', display: 'XETEUR', name: 'Ethereum EUR', volatility: 'High' },
        ]
      },
      {
        name: 'Altcoins & DeFi',
        items: [
          { symbol: 'XBCUSD', display: 'XBCUSD', name: 'Bitcoin Cash', volatility: 'High' },
          { symbol: 'XLMUSD', display: 'XLMUSD', name: 'Stellar Lumens', volatility: 'High' },
          { symbol: 'BNBUSD', display: 'BNBUSD', name: 'Binance Coin', volatility: 'High' },
          { symbol: 'CRVUSD', display: 'CRVUSD', name: 'Curve DAO', volatility: 'Extreme' },
          { symbol: 'ETCUSD', display: 'ETCUSD', name: 'Ethereum Classic', volatility: 'High' },
          { symbol: 'INCUSD', display: 'INCUSD', name: 'Injective', volatility: 'Extreme' },
          { symbol: 'LRCUSD', display: 'LRCUSD', name: 'Loopring', volatility: 'Extreme' },
          { symbol: 'NANUSD', display: 'NANUSD', name: 'Nano', volatility: 'Extreme' },
          { symbol: 'NERUSD', display: 'NERUSD', name: 'Nero', volatility: 'Extreme' },
          { symbol: 'ONEUSD', display: 'ONEUSD', name: 'Harmony', volatility: 'Extreme' },
          { symbol: 'SANUSD', display: 'SANUSD', name: 'Santiment', volatility: 'Extreme' },
          { symbol: 'SUSJUSD', display: 'SUSJUSD', name: 'Sushi', volatility: 'Extreme' },
          { symbol: 'XTXUSD', display: 'XTXUSD', name: 'Tixl', volatility: 'Extreme' },
          { symbol: 'BATUSD', display: 'BATUSD', name: 'Basic Attention', volatility: 'High' },
          { symbol: 'TOTUSD', display: 'TOTUSD', name: 'Tottenham', volatility: 'Extreme' },
          { symbol: 'TRXUSD', display: 'TRXUSD', name: 'Tron', volatility: 'High' },
          { symbol: 'ZECUSD', display: 'ZECUSD', name: 'Zcash', volatility: 'High' },
          { symbol: 'ALGUSD', display: 'ALGUSD', name: 'Algorand', volatility: 'High' },
          { symbol: 'FLIUSD', display: 'FLIUSD', name: 'Floki', volatility: 'Extreme' },
          { symbol: 'SHBUSD', display: 'SHBUSD', name: 'Shiba Inu', volatility: 'Extreme' },
          { symbol: 'AVALUSD', display: 'AVALUSD', name: 'Avalanche', volatility: 'High' },
          { symbol: 'NEOUSD', display: 'NEOUSD', name: 'NEO', volatility: 'High' },
          { symbol: 'DOTLUSD', display: 'DOTLUSD', name: 'Polkadot', volatility: 'High' },
          { symbol: 'LNKJUSD', display: 'LNKJUSD', name: 'Chainlink', volatility: 'High' },
          { symbol: 'SOLUSD', display: 'SOLUSD', name: 'Solana', volatility: 'High' },
          { symbol: 'UNIJUSD', display: 'UNIJUSD', name: 'Uniswap', volatility: 'High' },
          { symbol: 'AFMUSD', display: 'AFMUSD', name: 'Aframe', volatility: 'Extreme' },
          { symbol: 'GALEUR', display: 'GALEUR', name: 'Galatasaray EUR', volatility: 'Extreme' },
        ]
      }
    ]
  },
  {
    id: 'forex',
    label: 'Forex & Moedas',
    icon: <Globe className="w-4 h-4" />,
    color: 'emerald',
    assets: [
      {
        name: 'Major Pairs',
        items: [
          { symbol: 'EURUSD', display: 'EUR/USD', name: 'Euro', volatility: 'Low' },
          { symbol: 'GBPUSD', display: 'GBP/USD', name: 'British Pound', volatility: 'Medium' },
          { symbol: 'USDJPY', display: 'USD/JPY', name: 'Japanese Yen', volatility: 'Medium' },
          { symbol: 'AUDUSD', display: 'AUD/USD', name: 'Australian Dollar', volatility: 'Medium' },
          { symbol: 'USDCAD', display: 'USD/CAD', name: 'Canadian Dollar', volatility: 'Low' },
          { symbol: 'USDCHF', display: 'USD/CHF', name: 'Swiss Franc', volatility: 'Low' },
          { symbol: 'NZDUSD', display: 'NZD/USD', name: 'New Zealand Dollar', volatility: 'Medium' },
        ]
      },
      {
        name: 'Cross Pairs (Minors)',
        items: [
          { symbol: 'EURGBP', display: 'EUR/GBP', name: 'Euro/Pound', volatility: 'Low' },
          { symbol: 'EURJPY', display: 'EUR/JPY', name: 'Euro/Yen', volatility: 'Medium' },
          { symbol: 'GBPJPY', display: 'GBP/JPY', name: 'Pound/Yen', volatility: 'High' },
          { symbol: 'AUDJPY', display: 'AUD/JPY', name: 'Aussie/Yen', volatility: 'High' },
          { symbol: 'CHFJPY', display: 'CHF/JPY', name: 'Swiss/Yen', volatility: 'Medium' },
          { symbol: 'AUDCAD', display: 'AUD/CAD', name: 'Aussie/Canadian', volatility: 'Medium' },
          { symbol: 'AUDCHF', display: 'AUD/CHF', name: 'Aussie/Swiss', volatility: 'Medium' },
          { symbol: 'AUDNZD', display: 'AUD/NZD', name: 'Aussie/Kiwi', volatility: 'Medium' },
          { symbol: 'CADCHF', display: 'CAD/CHF', name: 'Canadian/Swiss', volatility: 'Low' },
          { symbol: 'CADJPY', display: 'CAD/JPY', name: 'Canadian/Yen', volatility: 'Medium' },
          { symbol: 'EURAUD', display: 'EUR/AUD', name: 'Euro/Aussie', volatility: 'Medium' },
          { symbol: 'EURCAD', display: 'EUR/CAD', name: 'Euro/Canadian', volatility: 'Medium' },
          { symbol: 'EURSGD', display: 'EUR/SGD', name: 'Euro/Singapore', volatility: 'Medium' },
          { symbol: 'GBPAUD', display: 'GBP/AUD', name: 'Pound/Aussie', volatility: 'High' },
          { symbol: 'GBPCHF', display: 'GBP/CHF', name: 'Pound/Swiss', volatility: 'Medium' },
          { symbol: 'GBPNZD', display: 'GBP/NZD', name: 'Pound/Kiwi', volatility: 'High' },
          { symbol: 'NZDCAD', display: 'NZD/CAD', name: 'Kiwi/Canadian', volatility: 'Medium' },
          { symbol: 'NZDJPY', display: 'NZD/JPY', name: 'Kiwi/Yen', volatility: 'Medium' },
        ]
      },
      {
        name: 'Exotics & Emerging Markets',
        items: [
          { symbol: 'USDCNH', display: 'USD/CNH', name: 'Chinese Yuan', volatility: 'Medium' },
          { symbol: 'USDSGK', display: 'USD/SGK', name: 'Singapore Dollar', volatility: 'Medium' },
          { symbol: 'EURMXN', display: 'EUR/MXN', name: 'Euro/Mexican Peso', volatility: 'High' },
          { symbol: 'EURNOK', display: 'EUR/NOK', name: 'Euro/Norwegian Krone', volatility: 'Medium' },
          { symbol: 'EURNZD', display: 'EUR/NZD', name: 'Euro/Kiwi', volatility: 'Medium' },
          { symbol: 'EURZAR', display: 'EUR/ZAR', name: 'Euro/Rand', volatility: 'High' },
          { symbol: 'GBPNOK', display: 'GBP/NOK', name: 'Pound/Norwegian', volatility: 'Medium' },
          { symbol: 'USDNOK', display: 'USD/NOK', name: 'Norwegian Krone', volatility: 'Medium' },
          { symbol: 'EURHUF', display: 'EUR/HUF', name: 'Euro/Forint', volatility: 'High' },
          { symbol: 'USDRUB', display: 'USD/RUB', name: 'Russian Ruble', volatility: 'High' },
          { symbol: 'USDTRY', display: 'USD/TRY', name: 'Turkish Lira', volatility: 'Extreme' },
          { symbol: 'USDSBL', display: 'USD/SBL', name: 'Special', volatility: 'Medium' },
          { symbol: 'USDKRW', display: 'USD/KRW', name: 'Korean Won', volatility: 'Medium' },
          { symbol: 'USDTWD', display: 'USD/TWD', name: 'Taiwan Dollar', volatility: 'Medium' },
          { symbol: 'USDSGG', display: 'USD/SGG', name: 'Singapore Dollar', volatility: 'Medium' },
          { symbol: 'USDZAR', display: 'USD/ZAR', name: 'South African Rand', volatility: 'High' },
          { symbol: 'USDIGN', display: 'USD/IGN', name: 'Ignition', volatility: 'Extreme' },
        ]
      },
      {
        name: 'Metals (Precious)',
        items: [
          { symbol: 'XAUUSD', display: 'GOLD', name: 'Gold Spot', volatility: 'Medium' },
          { symbol: 'XAGUSD', display: 'SILVER', name: 'Silver Spot', volatility: 'High' },
          { symbol: 'XAUEUR', display: 'GOLD/EUR', name: 'Gold EUR', volatility: 'Medium' },
          { symbol: 'XAUJPY', display: 'GOLD/JPY', name: 'Gold JPY', volatility: 'Medium' },
          { symbol: 'XAGEUR', display: 'SILVER/EUR', name: 'Silver EUR', volatility: 'High' },
          { symbol: 'XPTUSD', display: 'PLAT', name: 'Platinum', volatility: 'Medium' },
          { symbol: 'XPDUSD', display: 'PALL', name: 'Palladium', volatility: 'High' },
        ]
      }
    ]
  },
  {
    id: 'indices',
    label: 'Índices Globais',
    icon: <BarChart className="w-4 h-4" />,
    color: 'blue',
    assets: [
      {
        name: 'US Markets',
        items: [
          { symbol: 'SPX500', display: 'S&P 500', name: 'US Top 500', volatility: 'Medium' },
          { symbol: 'NAS100', display: 'NAS100', name: 'Nasdaq Tech', volatility: 'High' },
          { symbol: 'US30', display: 'DJI30', name: 'Dow Jones', volatility: 'Medium' },
          { symbol: 'US2000', display: 'RUSS2000', name: 'Small Caps', volatility: 'High' },
          { symbol: 'VIX', display: 'VIX', name: 'Volatility Index', volatility: 'Extreme' },
          { symbol: 'USDX', display: 'USDX', name: 'Dollar Index', volatility: 'Medium' },
          { symbol: 'DJ30R', display: 'DJ30R', name: 'Dow Jones Rotational', volatility: 'Medium' },
          { symbol: 'NAS100R', display: 'NAS100R', name: 'Nasdaq Rotational', volatility: 'High' },
          { symbol: 'SPX500R', display: 'SPX500R', name: 'S&P 500 Rotational', volatility: 'Medium' },
          { symbol: 'RVSPX', display: 'RVSPX', name: 'Reverse S&P', volatility: 'Medium' },
        ]
      },
      {
        name: 'Europe',
        items: [
          { symbol: 'GER40', display: 'DAX40', name: 'Germany 40', volatility: 'Medium' },
          { symbol: 'UK100', display: 'FTSE100', name: 'UK 100', volatility: 'Low' },
          { symbol: 'FRA40', display: 'CAC40', name: 'France 40', volatility: 'Medium' },
          { symbol: 'EUSTX50', display: 'STOXX50', name: 'Euro Stoxx 50', volatility: 'Medium' },
          { symbol: 'ESP35', display: 'IBEX35', name: 'Spain 35', volatility: 'Medium' },
          { symbol: 'GER40dft', display: 'DAX40dft', name: 'Germany 40 Draft', volatility: 'Medium' },
          { symbol: 'UK100dft', display: 'FTSE100dft', name: 'UK 100 Draft', volatility: 'Low' },
        ]
      },
      {
        name: 'Asia Pacific',
        items: [
          { symbol: 'JPN225', display: 'NIKKEI', name: 'Japan 225', volatility: 'High' },
          { symbol: 'HKG33', display: 'HANG SENG', name: 'Hong Kong 33', volatility: 'High' },
          { symbol: 'HK50dft', display: 'HSI50dft', name: 'Hong Kong 50 Draft', volatility: 'High' },
          { symbol: 'AUS200', display: 'ASX200', name: 'Australia 200', volatility: 'Medium' },
          { symbol: 'CHINA50', display: 'CHINA50', name: 'China A50', volatility: 'High' },
        ]
      },
      {
        name: 'Energy Commodities',
        items: [
          { symbol: 'UKOUSD', display: 'BRENT', name: 'UK Brent Oil', volatility: 'High' },
          { symbol: 'USOUSD', display: 'WTI', name: 'US Crude Oil', volatility: 'High' },
          { symbol: 'CL-OIL', display: 'CL-OIL', name: 'Crude Oil', volatility: 'High' },
          { symbol: 'UKOUSDR', display: 'BRENT-R', name: 'UK Brent Rotational', volatility: 'High' },
          { symbol: 'NG', display: 'NGAS', name: 'Natural Gas', volatility: 'Extreme' },
        ]
      },
      {
        name: 'Agriculture',
        items: [
          { symbol: 'Wheat', display: 'WHEAT', name: 'Wheat', volatility: 'High' },
          { symbol: 'Coffee', display: 'COFFEE', name: 'Coffee', volatility: 'Extreme' },
          { symbol: 'Cocoa', display: 'COCOA', name: 'Cocoa', volatility: 'Extreme' },
        ]
      }
    ]
  },
  {
    id: 'stocks',
    label: 'Ações Globais',
    icon: <Building2 className="w-4 h-4" />,
    color: 'amber',
    assets: [
      {
        name: 'UK Stocks (FTSE)',
        items: [
          { symbol: 'AAL', display: 'AAL', name: 'Anglo American', volatility: 'Medium' },
          { symbol: 'ABF', display: 'ABF', name: 'Associated British Foods', volatility: 'Low' },
          { symbol: 'ABDN', display: 'ABDN', name: 'Abrdn', volatility: 'Medium' },
          { symbol: 'AHT', display: 'AHT', name: 'Ashtead Group', volatility: 'Medium' },
          { symbol: 'ANTO', display: 'ANTO', name: 'Antofagasta', volatility: 'High' },
          { symbol: 'AUTO', display: 'AUTO', name: 'Auto Trader', volatility: 'Medium' },
          { symbol: 'AVIVA', display: 'AVIVA', name: 'Aviva', volatility: 'Low' },
          { symbol: 'AZN', display: 'AZN', name: 'AstraZeneca', volatility: 'Medium' },
          { symbol: 'BAE', display: 'BAE', name: 'BAE Systems', volatility: 'Medium' },
          { symbol: 'BARC', display: 'BARC', name: 'Barclays', volatility: 'Medium' },
          { symbol: 'BATS', display: 'BATS', name: 'British American Tobacco', volatility: 'Medium' },
          { symbol: 'BKG', display: 'BKG', name: 'Berkeley Group', volatility: 'Medium' },
          { symbol: 'BLND', display: 'BLND', name: 'British Land', volatility: 'Low' },
          { symbol: 'BNZL', display: 'BNZL', name: 'Bunzl', volatility: 'Low' },
          { symbol: 'BP', display: 'BP', name: 'BP', volatility: 'Medium' },
          { symbol: 'BRBY', display: 'BRBY', name: 'Burberry', volatility: 'High' },
          { symbol: 'BT.A', display: 'BT.A', name: 'BT Group', volatility: 'Medium' },
          { symbol: 'CCH', display: 'CCH', name: 'Coca-Cola HBC', volatility: 'Low' },
          { symbol: 'CL', display: 'CL', name: 'Croda International', volatility: 'Medium' },
          { symbol: 'CNA', display: 'CNA', name: 'Centrica', volatility: 'Medium' },
          { symbol: 'CRDA', display: 'CRDA', name: 'Croda', volatility: 'Medium' },
          { symbol: 'CRM', display: 'CRM', name: 'Compass Group', volatility: 'Low' },
          { symbol: 'DCC', display: 'DCC', name: 'DCC', volatility: 'Low' },
          { symbol: 'DHL', display: 'DHL', name: 'Direct Line', volatility: 'Medium' },
          { symbol: 'DIAGEO', display: 'DIAGEO', name: 'Diageo', volatility: 'Low' },
          { symbol: 'ENT', display: 'ENT', name: 'Entain', volatility: 'High' },
          { symbol: 'EXPN', display: 'EXPN', name: 'Experian', volatility: 'Low' },
          { symbol: 'EZJ', display: 'EZJ', name: 'easyJet', volatility: 'High' },
          { symbol: 'FLTR', display: 'FLTR', name: 'Flutter', volatility: 'High' },
          { symbol: 'FRAS', display: 'FRAS', name: 'Frasers', volatility: 'Medium' },
          { symbol: 'FRES', display: 'FRES', name: 'Fresnillo', volatility: 'High' },
          { symbol: 'GLENL', display: 'GLENL', name: 'Glencore', volatility: 'Medium' },
          { symbol: 'GSK', display: 'GSK', name: 'GSK', volatility: 'Low' },
          { symbol: 'HLMA', display: 'HLMA', name: 'Halma', volatility: 'Low' },
          { symbol: 'HNIK', display: 'HNIK', name: 'Hargreaves', volatility: 'Medium' },
          { symbol: 'HSX', display: 'HSX', name: 'Hiscox', volatility: 'Medium' },
          { symbol: 'HSBA', display: 'HSBA', name: 'HSBC', volatility: 'Low' },
          { symbol: 'IAG', display: 'IAG', name: 'IAG', volatility: 'High' },
          { symbol: 'III', display: 'III', name: '3i Group', volatility: 'Medium' },
          { symbol: 'IMB', display: 'IMB', name: 'Imperial Brands', volatility: 'Medium' },
          { symbol: 'INF', display: 'INF', name: 'Informa', volatility: 'Medium' },
          { symbol: 'ITRK', display: 'ITRK', name: 'Intertek', volatility: 'Low' },
          { symbol: 'ITV', display: 'ITV', name: 'ITV', volatility: 'Medium' },
          { symbol: 'JDI', display: 'JDI', name: 'JD Sports', volatility: 'High' },
          { symbol: 'JMAT', display: 'JMAT', name: 'Johnson Matthey', volatility: 'Medium' },
          { symbol: 'KGF', display: 'KGF', name: 'Kingfisher', volatility: 'Medium' },
          { symbol: 'LAND', display: 'LAND', name: 'Land Securities', volatility: 'Low' },
          { symbol: 'LEG', display: 'LEG', name: 'Legal & General', volatility: 'Low' },
          { symbol: 'LGEN', display: 'LGEN', name: 'Legal & General', volatility: 'Low' },
          { symbol: 'LLOY', display: 'LLOY', name: 'Lloyds', volatility: 'Medium' },
          { symbol: 'LSGG', display: 'LSGG', name: 'LSE Group', volatility: 'Low' },
          { symbol: 'MNDI', display: 'MNDI', name: 'Mondi', volatility: 'Medium' },
          { symbol: 'MNG', display: 'MNG', name: 'M&G', volatility: 'Medium' },
          { symbol: 'MNVG', display: 'MNVG', name: 'Man Group', volatility: 'Medium' },
          { symbol: 'NGRRID', display: 'NGRRID', name: 'National Grid', volatility: 'Low' },
          { symbol: 'NXT', display: 'NXT', name: 'Next', volatility: 'Medium' },
          { symbol: 'OCDO', display: 'OCDO', name: 'Ocado', volatility: 'Extreme' },
          { symbol: 'PHNX', display: 'PHNX', name: 'Phoenix', volatility: 'Medium' },
          { symbol: 'PRU', display: 'PRU', name: 'Prudential', volatility: 'Medium' },
          { symbol: 'PSH', display: 'PSH', name: 'Pershing Square', volatility: 'High' },
          { symbol: 'PSN', display: 'PSN', name: 'Persimmon', volatility: 'Medium' },
          { symbol: 'RB', display: 'RB', name: 'Reckitt Benckiser', volatility: 'Low' },
          { symbol: 'RELX', display: 'RELX', name: 'RELX', volatility: 'Low' },
          { symbol: 'RIO', display: 'RIO', name: 'Rio Tinto', volatility: 'Medium' },
          { symbol: 'RMV', display: 'RMV', name: 'Rightmove', volatility: 'Medium' },
          { symbol: 'RR', display: 'RR', name: 'Rolls-Royce', volatility: 'High' },
          { symbol: 'RTO', display: 'RTO', name: 'Rentokil', volatility: 'Low' },
          { symbol: 'SBRYR', display: 'SBRYR', name: 'Sainsbury', volatility: 'Medium' },
          { symbol: 'SDR', display: 'SDR', name: 'Schroders', volatility: 'Medium' },
          { symbol: 'SGE', display: 'SGE', name: 'Sage', volatility: 'Low' },
          { symbol: 'SGRO', display: 'SGRO', name: 'Segro', volatility: 'Low' },
          { symbol: 'SHELL', display: 'SHELL', name: 'Shell', volatility: 'Medium' },
          { symbol: 'SMFN', display: 'SMFN', name: 'Smiths Group', volatility: 'Low' },
          { symbol: 'SMT', display: 'SMT', name: 'Scottish Mortgage', volatility: 'High' },
          { symbol: 'SN', display: 'SN', name: 'Smith & Nephew', volatility: 'Medium' },
          { symbol: 'SSE', display: 'SSE', name: 'SSE', volatility: 'Low' },
          { symbol: 'STAN', display: 'STAN', name: 'Standard Chartered', volatility: 'Medium' },
          { symbol: 'STJ', display: 'STJ', name: 'St James Place', volatility: 'Medium' },
          { symbol: 'SVT', display: 'SVT', name: 'Severn Trent', volatility: 'Low' },
          { symbol: 'TSCO', display: 'TSCO', name: 'Tesco', volatility: 'Low' },
          { symbol: 'ULVR', display: 'ULVR', name: 'Unilever', volatility: 'Low' },
          { symbol: 'VOD', display: 'VOD', name: 'Vodafone', volatility: 'Medium' },
        ]
      },
      {
        name: 'French Stocks (CAC)',
        items: [
          { symbol: 'ACA', display: 'ACA', name: 'Crédit Agricole', volatility: 'Medium' },
          { symbol: 'AI', display: 'AI', name: 'Air Liquide', volatility: 'Low' },
          { symbol: 'ATOS', display: 'ATOS', name: 'Atos', volatility: 'High' },
          { symbol: 'BN', display: 'BN', name: 'Danone', volatility: 'Low' },
          { symbol: 'BNP', display: 'BNP', name: 'BNP Paribas', volatility: 'Medium' },
          { symbol: 'CA', display: 'CA', name: 'Carrefour', volatility: 'Medium' },
          { symbol: 'CAP', display: 'CAP', name: 'Capgemini', volatility: 'Medium' },
          { symbol: 'CS', display: 'CS', name: 'AXA', volatility: 'Low' },
          { symbol: 'DAST', display: 'DAST', name: 'Dassault', volatility: 'Medium' },
          { symbol: 'DG', display: 'DG', name: 'Vinci', volatility: 'Low' },
          { symbol: 'EL', display: 'EL', name: 'EssilorLuxottica', volatility: 'Low' },
          { symbol: 'EN', display: 'EN', name: 'Bouygues', volatility: 'Low' },
          { symbol: 'ENGI', display: 'ENGI', name: 'Engie', volatility: 'Medium' },
          { symbol: 'FP', display: 'FP', name: 'TotalEnergies', volatility: 'Medium' },
          { symbol: 'GLE', display: 'GLE', name: 'Société Générale', volatility: 'Medium' },
          { symbol: 'HRMS', display: 'HRMS', name: 'Hermès', volatility: 'Medium' },
          { symbol: 'KER', display: 'KER', name: 'Kering', volatility: 'High' },
          { symbol: 'LR', display: 'LR', name: 'Legrand', volatility: 'Low' },
          { symbol: 'LVMH', display: 'LVMH', name: 'LVMH', volatility: 'Medium' },
          { symbol: 'ML', display: 'ML', name: 'Michelin', volatility: 'Medium' },
          { symbol: 'OR', display: 'OR', name: "L'Oréal", volatility: 'Low' },
          { symbol: 'PUBP', display: 'PUBP', name: 'Publicis', volatility: 'Medium' },
          { symbol: 'RI', display: 'RI', name: 'Pernod Ricard', volatility: 'Low' },
          { symbol: 'RNO', display: 'RNO', name: 'Renault', volatility: 'High' },
          { symbol: 'SAF', display: 'SAF', name: 'Safran', volatility: 'Medium' },
          { symbol: 'SGO', display: 'SGO', name: 'Saint-Gobain', volatility: 'Medium' },
          { symbol: 'STM', display: 'STM', name: 'STMicroelectronics', volatility: 'High' },
          { symbol: 'SU', display: 'SU', name: 'Schneider Electric', volatility: 'Medium' },
          { symbol: 'TCFP', display: 'TCFP', name: 'TF1', volatility: 'Medium' },
          { symbol: 'URW', display: 'URW', name: 'Unibail', volatility: 'High' },
          { symbol: 'VIE', display: 'VIE', name: 'Veolia', volatility: 'Low' },
          { symbol: 'VIV', display: 'VIV', name: 'Vivendi', volatility: 'Medium' },
        ]
      },
      {
        name: 'Spanish Stocks (IBEX)',
        items: [
          { symbol: 'AC', display: 'AC', name: 'Acciona', volatility: 'Medium' },
          { symbol: 'ADPR', display: 'ADPR', name: 'Adipec', volatility: 'High' },
          { symbol: 'AMUN', display: 'AMUN', name: 'Amadeus', volatility: 'Medium' },
          { symbol: 'BBVA', display: 'BBVA', name: 'BBVA', volatility: 'Medium' },
          { symbol: 'CABK', display: 'CABK', name: 'CaixaBank', volatility: 'Medium' },
          { symbol: 'CDI', display: 'CDI', name: 'Cellnex', volatility: 'Medium' },
          { symbol: 'DIM', display: 'DIM', name: 'DIA', volatility: 'High' },
          { symbol: 'ELE', display: 'ELE', name: 'Endesa', volatility: 'Low' },
          { symbol: 'IBE', display: 'IBE', name: 'Iberdrola', volatility: 'Low' },
          { symbol: 'ITX', display: 'ITX', name: 'Inditex', volatility: 'Medium' },
          { symbol: 'MAP', display: 'MAP', name: 'Mapfre', volatility: 'Low' },
          { symbol: 'REP', display: 'REP', name: 'Repsol', volatility: 'Medium' },
          { symbol: 'SAB', display: 'SAB', name: 'Sabadell', volatility: 'Medium' },
          { symbol: 'SANTAN', display: 'SANTAN', name: 'Santander', volatility: 'Medium' },
          { symbol: 'SW', display: 'SW', name: 'Swisscom', volatility: 'Low' },
          { symbol: 'TEF', display: 'TEF', name: 'Telefónica', volatility: 'Medium' },
        ]
      },
      {
        name: 'Dutch Stocks (AEX)',
        items: [
          { symbol: 'AALS', display: 'AALS', name: 'Aalberts', volatility: 'Medium' },
          { symbol: 'ABNA', display: 'ABNA', name: 'ABN AMRO', volatility: 'Medium' },
          { symbol: 'ABN', display: 'ABN', name: 'ABN AMRO Bank', volatility: 'Medium' },
          { symbol: 'ADBYN', display: 'ADBYN', name: 'Adyen', volatility: 'High' },
          { symbol: 'AGTK', display: 'AGTK', name: 'Aegon', volatility: 'Medium' },
          { symbol: 'AIR', display: 'AIR', name: 'Airbus', volatility: 'Medium' },
          { symbol: 'AKZA', display: 'AKZA', name: 'Akzo Nobel', volatility: 'Low' },
          { symbol: 'AMS', display: 'AMS', name: 'ArcelorMittal', volatility: 'High' },
          { symbol: 'ANA', display: 'ANA', name: 'Ahold Delhaize', volatility: 'Low' },
          { symbol: 'ASM', display: 'ASM', name: 'ASMI', volatility: 'High' },
          { symbol: 'ASML', display: 'ASML', name: 'ASML', volatility: 'High' },
          { symbol: 'CLNX', display: 'CLNX', name: 'Cellnex', volatility: 'Medium' },
          { symbol: 'GALP', display: 'GALP', name: 'Galp Energia', volatility: 'Medium' },
          { symbol: 'GLPG', display: 'GLPG', name: 'Galapagos', volatility: 'High' },
          { symbol: 'HEIA', display: 'HEIA', name: 'Heineken', volatility: 'Low' },
          { symbol: 'IMCD', display: 'IMCD', name: 'IMCD', volatility: 'Medium' },
          { symbol: 'INGA', display: 'INGA', name: 'ING', volatility: 'Medium' },
          { symbol: 'MT', display: 'MT', name: 'ArcelorMittal', volatility: 'High' },
          { symbol: 'NN', display: 'NN', name: 'NN Group', volatility: 'Medium' },
          { symbol: 'PHIA', display: 'PHIA', name: 'Philips', volatility: 'Medium' },
          { symbol: 'PRX', display: 'PRX', name: 'Prosus', volatility: 'High' },
          { symbol: 'RAND', display: 'RAND', name: 'Randstad', volatility: 'Medium' },
          { symbol: 'SON', display: 'SON', name: 'Sonae', volatility: 'Low' },
          { symbol: 'UNA', display: 'UNA', name: 'Unilever', volatility: 'Low' },
          { symbol: 'VIS', display: 'VIS', name: 'Viscofan', volatility: 'Low' },
          { symbol: 'VPK', display: 'VPK', name: 'VPK Packaging', volatility: 'Low' },
          { symbol: 'WKL', display: 'WKL', name: 'Wolters Kluwer', volatility: 'Low' },
        ]
      },
      {
        name: 'German Stocks (DAX)',
        items: [
          { symbol: 'ADS', display: 'ADS', name: 'Adidas', volatility: 'Medium' },
          { symbol: 'AFX', display: 'AFX', name: 'Carl Zeiss', volatility: 'Medium' },
          { symbol: 'AGRRNL', display: 'AGRRNL', name: 'Aroundtown', volatility: 'High' },
          { symbol: 'ALV', display: 'ALV', name: 'Allianz', volatility: 'Low' },
          { symbol: 'BAS', display: 'BAS', name: 'BASF', volatility: 'Medium' },
          { symbol: 'BAYN', display: 'BAYN', name: 'Bayer', volatility: 'Medium' },
          { symbol: 'BEI', display: 'BEI', name: 'Beiersdorf', volatility: 'Low' },
          { symbol: 'BMW', display: 'BMW', name: 'BMW', volatility: 'Medium' },
          { symbol: 'BNR', display: 'BNR', name: 'Brenntag', volatility: 'Medium' },
          { symbol: 'CBK', display: 'CBK', name: 'Commerzbank', volatility: 'Medium' },
          { symbol: 'CON', display: 'CON', name: 'Continental', volatility: 'Medium' },
          { symbol: 'DB1', display: 'DB1', name: 'Deutsche Börse', volatility: 'Low' },
          { symbol: 'DBK', display: 'DBK', name: 'Deutsche Bank', volatility: 'High' },
          { symbol: 'DHER', display: 'DHER', name: 'Delivery Hero', volatility: 'Extreme' },
          { symbol: 'DWNI', display: 'DWNI', name: 'Deutsche Wohnen', volatility: 'Medium' },
          { symbol: 'DWS', display: 'DWS', name: 'DWS Group', volatility: 'Medium' },
          { symbol: 'EOAN', display: 'EOAN', name: 'E.ON', volatility: 'Low' },
          { symbol: 'FIE', display: 'FIE', name: 'Fielmann', volatility: 'Low' },
          { symbol: 'FME', display: 'FME', name: 'Fresenius Medical', volatility: 'Medium' },
          { symbol: 'FRA', display: 'FRA', name: 'Fraport', volatility: 'Medium' },
          { symbol: 'FRE', display: 'FRE', name: 'Fresenius', volatility: 'Medium' },
          { symbol: 'G24', display: 'G24', name: 'Siemens Gamesa', volatility: 'High' },
          { symbol: 'HEI', display: 'HEI', name: 'HeidelbergCement', volatility: 'Medium' },
          { symbol: 'HLAG', display: 'HLAG', name: 'Hapag-Lloyd', volatility: 'High' },
          { symbol: 'HNR1', display: 'HNR1', name: 'Hannover Re', volatility: 'Low' },
          { symbol: 'HOT', display: 'HOT', name: 'Hochtief', volatility: 'Medium' },
          { symbol: 'IFX', display: 'IFX', name: 'Infineon', volatility: 'High' },
          { symbol: 'KBX', display: 'KBX', name: 'Knorr-Bremse', volatility: 'Medium' },
          { symbol: 'KGX', display: 'KGX', name: 'KION', volatility: 'Medium' },
          { symbol: 'KRN', display: 'KRN', name: 'Krones', volatility: 'Medium' },
          { symbol: 'MBG', display: 'MBG', name: 'Mercedes-Benz', volatility: 'Medium' },
          { symbol: 'MRCK', display: 'MRCK', name: 'Merck', volatility: 'Low' },
          { symbol: 'MTX', display: 'MTX', name: 'MTU Aero', volatility: 'Medium' },
          { symbol: 'MUV2', display: 'MUV2', name: 'Munich Re', volatility: 'Low' },
          { symbol: 'NEMD', display: 'NEMD', name: 'Nemetschek', volatility: 'Medium' },
          { symbol: 'PUM', display: 'PUM', name: 'Puma', volatility: 'High' },
          { symbol: 'RAA', display: 'RAA', name: 'Rational', volatility: 'Low' },
          { symbol: 'RRTL', display: 'RRTL', name: 'RTL Group', volatility: 'Medium' },
          { symbol: 'RWE', display: 'RWE', name: 'RWE', volatility: 'Medium' },
          { symbol: 'SAP', display: 'SAP', name: 'SAP', volatility: 'Medium' },
          { symbol: 'SHL', display: 'SHL', name: 'Siemens Healthineers', volatility: 'Medium' },
          { symbol: 'SIE', display: 'SIE', name: 'Siemens', volatility: 'Low' },
          { symbol: 'SRT3', display: 'SRT3', name: 'Sartorius', volatility: 'High' },
          { symbol: 'SY1', display: 'SY1', name: 'Symrise', volatility: 'Low' },
          { symbol: 'TLX', display: 'TLX', name: 'Talanx', volatility: 'Low' },
          { symbol: 'UTDI', display: 'UTDI', name: 'United Internet', volatility: 'Medium' },
          { symbol: 'VNA', display: 'VNA', name: 'Vonovia', volatility: 'Medium' },
          { symbol: 'VOW', display: 'VOW', name: 'Volkswagen', volatility: 'Medium' },
          { symbol: 'ZAL', display: 'ZAL', name: 'Zalando', volatility: 'High' },
        ]
      },
      {
        name: 'Futures & Bonds',
        items: [
          { symbol: 'GOLDdft', display: 'GOLDdft', name: 'Gold Draft Future', volatility: 'Medium' },
          { symbol: 'SILVERdft', display: 'SILVERdft', name: 'Silver Draft Future', volatility: 'High' },
          { symbol: 'EURGBPft', display: 'EURGBPft', name: 'EUR/GBP Future', volatility: 'Low' },
          { symbol: 'EURUSDft', display: 'EURUSDft', name: 'EUR/USD Future', volatility: 'Low' },
          { symbol: 'GBPUSDft', display: 'GBPUSDft', name: 'GBP/USD Future', volatility: 'Medium' },
          { symbol: 'EUB10Y', display: 'EUB10Y', name: 'Euro Bond 10Y', volatility: 'Low' },
          { symbol: 'EUB2Y', display: 'EUB2Y', name: 'Euro Bond 2Y', volatility: 'Low' },
          { symbol: 'EUB30Y', display: 'EUB30Y', name: 'Euro Bond 30Y', volatility: 'Low' },
          { symbol: 'EUB5Y', display: 'EUB5Y', name: 'Euro Bond 5Y', volatility: 'Low' },
          { symbol: 'EURIBOR', display: 'EURIBOR', name: 'Euribor', volatility: 'Low' },
          { symbol: 'LongGilt', display: 'LongGilt', name: 'UK Long Gilt', volatility: 'Low' },
          { symbol: 'USNote10Y', display: 'USNote10Y', name: 'US Treasury 10Y', volatility: 'Low' },
        ]
      },
      {
        name: 'Misc & Other',
        items: [
          { symbol: 'GBXUSD', display: 'GBXUSD', name: 'Gibraltar Pound', volatility: 'Medium' },
          { symbol: 'JSON', display: 'JSON', name: 'JSON Token', volatility: 'Extreme' },
          { symbol: 'OMLUSD', display: 'OMLUSD', name: 'OmiseGO', volatility: 'High' },
          { symbol: 'TRST', display: 'TRST', name: 'Trust', volatility: 'Medium' },
          { symbol: 'TW', display: 'TW', name: 'Taylor Wimpey', volatility: 'Medium' },
          { symbol: 'UU', display: 'UU', name: 'United Utilities', volatility: 'Low' },
          { symbol: 'WPP', display: 'WPP', name: 'WPP', volatility: 'Medium' },
          { symbol: 'WTB', display: 'WTB', name: 'Whitbread', volatility: 'Medium' },
          { symbol: 'SWR', display: 'SWR', name: 'Swiss Re', volatility: 'Low' },
        ]
      }
    ]
  }
];

interface AssetUniverseProps {
  selectedAssets: string[];
  onToggle: (asset: string) => void;
}

// 🆕 FUNÇÃO QUE DETECTA SE O MERCADO ESTÁ ABERTO
function isMarketOpen(symbol: string, categoryId: string): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  
  // 📍 CRYPTO: 24/7 (Sempre aberto)
  if (categoryId === 'crypto') {
    return true;
  }
  
  // 📍 FOREX: Segunda 00:00 UTC - Sexta 22:00 UTC
  if (categoryId === 'forex' || symbol.includes('USD') || symbol.includes('EUR') || symbol.includes('GBP') || symbol.includes('JPY') || symbol.includes('XAU') || symbol.includes('XAG')) {
    // Fechado no fim de semana
    if (dayOfWeek === 0) return false; // Domingo
    if (dayOfWeek === 6) return false; // Sábado
    
    // Sexta-feira fecha às 22:00 UTC
    if (dayOfWeek === 5 && utcHour >= 22) return false;
    
    // Segunda-feira abre às 00:00 UTC
    return true;
  }
  
  // 📍 AÇÕES: Geralmente 09:00-17:00 horário local (varia por mercado)
  if (categoryId === 'stocks') {
    // Fechado no fim de semana
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // Horário de negociação aproximado (simplificado)
    return utcHour >= 8 && utcHour < 17;
  }
  
  // 📍 ÍNDICES US (S&P500, NASDAQ, DOW): 23:00 Domingo - 22:00 Sexta (Futuros)
  if (['SPX500', 'NAS100', 'US30', 'US2000', 'VIX'].includes(symbol)) {
    // Domingo abre às 23:00 UTC
    if (dayOfWeek === 0 && utcHour >= 23) return true;
    // Segunda a Quinta: 24h
    if (dayOfWeek >= 1 && dayOfWeek <= 4) return true;
    // Sexta fecha às 22:00 UTC
    if (dayOfWeek === 5 && utcHour < 22) return true;
    // Sábado fechado
    if (dayOfWeek === 6) return false;
    
    return false;
  }
  
  // 📍 ÍNDICES EUROPEUS (DAX, FTSE, CAC): 08:00-22:00 UTC
  if (['GER40', 'UK100', 'FRA40', 'EUSTX50'].includes(symbol)) {
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    return utcHour >= 8 && utcHour < 22;
  }
  
  // 📍 ÍNDICES ASIÁTICOS (NIKKEI, HSI): 00:00-08:00 UTC
  if (['JPN225', 'HKG33', 'AUS200'].includes(symbol)) {
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    return utcHour >= 0 && utcHour < 8;
  }
  
  // 📍 COMMODITIES/ENERGY: 23:00 Domingo - 22:00 Sexta
  if (['UKOUSD', 'USOUSD', 'NG'].includes(symbol)) {
    if (dayOfWeek === 0 && utcHour >= 23) return true;
    if (dayOfWeek >= 1 && dayOfWeek <= 4) return true;
    if (dayOfWeek === 5 && utcHour < 22) return true;
    return false;
  }
  
  // Padrão: Considera aberto (para novos ativos)
  return true;
}

export function AssetUniverse({ selectedAssets, onToggle }: AssetUniverseProps) {
  const [activeTab, setActiveTab] = useState('crypto');
  const [searchTerm, setSearchTerm] = useState('');

  const currentCategory = ASSET_DATABASE.find(c => c.id === activeTab);
  const theme = currentCategory ? THEME_COLORS[currentCategory.color] : THEME_COLORS.purple;

  // Filter Logic
  const filteredAssets = currentCategory?.assets.map(group => ({
    ...group,
    items: group.items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.display.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
  })).filter(group => group.items.length > 0);

  return (
    <div className="w-full bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden shadow-2xl relative group">
      {/* Ambient Background Glow */}
      <div className={`absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-50 transition-colors duration-700 pointer-events-none ${theme.bgDark}`}></div>
      
      {/* Header */}
      <div className="p-6 border-b border-white/5 relative z-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2 tracking-tight">
              <Sparkles className={`w-5 h-5 ${theme.icon}`} />
              Universo de Ativos - Infinox
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-md">
              Todos os ativos disponíveis na sua corretora Infinox via MetaTrader 5. Conecte outras corretoras para expandir.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex overflow-x-auto scrollbar-none border-b border-white/5 bg-black/20 px-2">
        {ASSET_DATABASE.map(cat => {
           const catTheme = THEME_COLORS[cat.color];
           const isActive = activeTab === cat.id;
           return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                isActive 
                ? `${catTheme.borderFull} text-white bg-white/[0.02]` 
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/[0.01]'
              }`}
            >
              <span className={isActive ? catTheme.text : ''}>{cat.icon}</span>
              {cat.label}
            </button>
           );
        })}
      </div>

      {/* Grid Content */}
      <div className="p-6 min-h-[400px] relative z-10 bg-black/20">
        <AnimatePresence mode="wait">
           <motion.div
             key={activeTab + searchTerm}
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: -10 }}
             transition={{ duration: 0.2 }}
             className="space-y-8"
           >
             {filteredAssets?.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                  <Filter className="w-12 h-12 mb-4 opacity-20" />
                  <p className="text-sm">Nenhum ativo encontrado nesta categoria.</p>
               </div>
             ) : (
               filteredAssets?.map((group, idx) => (
                 <div key={idx} className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-b border-white/5 pb-2">
                      <Layers className="w-3 h-3" />
                      {group.name}
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {group.items.map((asset) => {
                        const isSelected = selectedAssets.includes(asset.symbol);
                        const isOpen = isMarketOpen(asset.symbol, currentCategory?.id || 'crypto');
                        return (
                          <button
                            key={asset.symbol}
                            onClick={() => onToggle(asset.symbol)}
                            className={`relative z-20 cursor-pointer group/card flex flex-col p-3 rounded-xl border transition-all duration-300 text-left hover:-translate-y-1 ${
                              isSelected 
                                ? `${theme.bgLight} ${theme.border} shadow-[0_0_20px_rgba(0,0,0,0.3)]` 
                                : 'bg-neutral-900 border-white/5 hover:border-white/20 hover:bg-neutral-800'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-xs font-black font-mono px-1.5 py-0.5 rounded ${
                                isSelected 
                                  ? `${theme.bgHighlight} ${theme.textDark}`
                                  : 'bg-white/5 text-slate-400'
                              }`}>
                                {asset.display}
                              </span>
                              
                              <div className="flex flex-col items-end gap-1">
                                {/* 🆕 BADGE MERCADO ABERTO/FECHADO */}
                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase ${
                                  isOpen 
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                    : 'bg-slate-500/10 text-slate-500 border border-slate-500/20'
                                }`}>
                                  <div className={`w-1 h-1 rounded-full ${
                                    isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                                  }`} />
                                  {isOpen ? 'ABERTO' : 'FECHADO'}
                                </div>
                                
                                {isSelected && (
                                  <div className={`w-4 h-4 rounded-full ${theme.bgFull || 'bg-white'} flex items-center justify-center shadow-lg`}>
                                     <Check className="w-2.5 h-2.5 text-black font-bold" />
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="mt-auto">
                               <p className={`text-[10px] font-medium leading-tight mb-1 truncate ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                 {asset.name}
                               </p>
                               <div className="flex items-center gap-1">
                                  {asset.volatility === 'Extreme' && <Zap className="w-3 h-3 text-red-500" />}
                                  {asset.volatility === 'High' && <TrendingUp className="w-3 h-3 text-amber-500" />}
                                  <span className={`text-[9px] uppercase ${
                                    asset.volatility === 'Extreme' ? 'text-red-500 font-bold' :
                                    asset.volatility === 'High' ? 'text-amber-500' :
                                    asset.volatility === 'Low' ? 'text-emerald-500' :
                                    'text-blue-500'
                                  }`}>
                                    {asset.volatility} VOL
                                  </span>
                               </div>
                            </div>

                            {/* Selection Ring Animation */}
                            {isSelected && (
                               <motion.div 
                                 layoutId={`ring-${asset.symbol}`}
                                 className={`absolute inset-0 border-2 ${theme.borderFull} rounded-xl pointer-events-none`}
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 exit={{ opacity: 0 }}
                               />
                            )}
                          </button>
                        );
                      })}
                    </div>
                 </div>
               ))
             )}
           </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Footer Info */}
      <div className="bg-black/40 p-3 border-t border-white/5 flex justify-between items-center text-[10px] text-slate-500 px-6">
         <span>{selectedAssets.length} ativos monitorados</span>
         <div className="flex gap-4">
            <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-red-500" /> Alta Volatilidade</span>
            <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-emerald-500" /> Forex 24h</span>
         </div>
      </div>
    </div>
  );
}