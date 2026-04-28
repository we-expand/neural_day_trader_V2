import { toast } from "sonner";

// 🚨 EMERGENCY MODE: Binance WebSocket disabled (CORS/SSL errors)
// Using only simulation mode

type PriceHandler = (symbol: string, price: number) => void;

class NeuralBridgeService {
  private subscribers: PriceHandler[] = [];
  private isConnected = false;
  private simulationInterval: any = null;

  connect() {
    if (this.isConnected) return;

    console.log('[NEURAL BRIDGE] 🎭 EMERGENCY MODE: Using simulation only (WebSocket disabled)');
    this.startSimulation();
  }

  private startSimulation() {
    if (this.simulationInterval) return;
    
    this.isConnected = true;
    console.log('[NEURAL BRIDGE] 🎭 Simulation mode active');
    
    // Preços base fixos
    const basePrices: Record<string, number> = {
      'BTC/USD': 102500,
      'ETH/USD': 3420,
      'EUR/USD': 1.0415,
      'XAU/USD': 2678,
    };

    // Simular preços a cada 1 segundo
    this.simulationInterval = setInterval(() => {
      Object.entries(basePrices).forEach(([symbol, basePrice]) => {
        // Variação mínima de ±0.01%
        const variation = (Math.random() - 0.5) * 0.0002;
        const price = basePrice * (1 + variation);
        this.notifySubscribers(symbol, price);
      });
    }, 1000);
  }

  private notifySubscribers(symbol: string, price: number) {
    this.subscribers.forEach(handler => handler(symbol, price));
  }

  subscribe(handler: PriceHandler) {
    this.subscribers.push(handler);
  }

  disconnect() {
    this.isConnected = false;
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }
}

export const neuralBridge = new NeuralBridgeService();