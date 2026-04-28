import { useState, useEffect } from 'react';

export interface Sale {
  id: string;
  productName: string;
  amount: number;
  customerName: string;
  date: string;
  status: 'completed' | 'pending';
}

export function useFinanceStore() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [balance, setBalance] = useState(100); // Saldo inicial de testes (Reset p/ 100)

  // Load data helper
  const loadData = () => {
    try {
      const savedSales = localStorage.getItem('neuro_finance_sales_v2');
      const savedBalance = localStorage.getItem('neuro_finance_balance_v2');
      
      if (savedSales) {
        const parsed: Sale[] = JSON.parse(savedSales);
        setSales(parsed);
        setRevenue(parsed.reduce((acc, curr) => acc + curr.amount, 0));
      }
      
      if (savedBalance) {
        setBalance(parseFloat(savedBalance));
      }
    } catch (e) {
      console.error('Failed to load finance data', e);
    }
  };

  // Load from LocalStorage on mount and listen for updates
  useEffect(() => {
    loadData();
    window.addEventListener('neuro_finance_update', loadData);
    return () => window.removeEventListener('neuro_finance_update', loadData);
  }, []);

  const updateBalance = (amount: number) => {
    let currentBalance = 100;
    try {
        const saved = localStorage.getItem('neuro_finance_balance_v2');
        if (saved) currentBalance = parseFloat(saved);
    } catch(e) {}

    const newBalance = currentBalance + amount;
    localStorage.setItem('neuro_finance_balance_v2', newBalance.toString());
    window.dispatchEvent(new Event('neuro_finance_update'));
    setBalance(newBalance);
    return newBalance;
  }

  const addSale = (productName: string, amount: number) => {
    // CRITICAL: Always read from localStorage to ensure we have the latest state
    // This prevents race conditions or stale closures if multiple sales happen quickly
    let currentSales: Sale[] = [];
    try {
      const saved = localStorage.getItem('neuro_finance_sales_v2');
      if (saved) {
        currentSales = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error reading current sales', e);
    }

    const newSale: Sale = {
      id: Math.random().toString(36).substr(2, 9),
      productName,
      amount,
      customerName: 'Cliente ' + Math.floor(Math.random() * 1000), // Simulated
      date: new Date().toISOString(),
      status: 'completed'
    };

    const updatedSales = [newSale, ...currentSales];
    
    // 1. Persist
    localStorage.setItem('neuro_finance_sales_v2', JSON.stringify(updatedSales));
    
    // 2. Dispatch event for cross-component updates
    window.dispatchEvent(new Event('neuro_finance_update'));
    
    // 3. Update local state immediately (redundant if event fires fast, but good for UI responsiveness)
    setSales(updatedSales);
    setRevenue(updatedSales.reduce((acc, curr) => acc + curr.amount, 0));
    
    return newSale;
  };

  const clearData = () => {
    localStorage.removeItem('neuro_finance_sales');
    localStorage.removeItem('neuro_finance_balance');
    window.dispatchEvent(new Event('neuro_finance_update'));
    setSales([]);
    setRevenue(0);
    setBalance(10000);
  }

  return {
    sales,
    revenue,
    balance,
    addSale,
    updateBalance,
    clearData
  };
}
