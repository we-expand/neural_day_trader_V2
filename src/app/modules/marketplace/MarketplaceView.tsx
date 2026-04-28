/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║  NEURAL DAY TRADER - MARKETPLACE                                  ║
 * ║  Main Component                                                   ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import React, { useState } from 'react';
import { 
  ShoppingCart, 
  Star, 
  Check, 
  Sparkles, 
  TrendingUp,
  Shield,
  Zap,
  Crown,
  X,
  CreditCard,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { Product, CartItem } from './types';
import { MARKETPLACE_PRODUCTS } from './products';

export function MarketplaceView() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Adicionar ao carrinho
  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product.id === product.id);
    
    if (existingItem) {
      toast.info('Produto já está no carrinho');
      return;
    }
    
    setCart([...cart, { product, quantity: 1 }]);
    toast.success(`${product.name} adicionado ao carrinho!`, {
      description: `${formatPrice(product.price)}`,
    });
    
    console.log('[MARKETPLACE] Product added to cart:', product.id);
  };

  // Remover do carrinho
  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
    toast.info('Produto removido do carrinho');
  };

  // Calcular total
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price, 0);

  // Checkout
  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio');
      return;
    }

    toast.success('Compra processada com sucesso!', {
      description: `Total: ${formatPrice(cartTotal)} • ${cart.length} ${cart.length === 1 ? 'produto' : 'produtos'}`,
      duration: 5000,
    });

    console.log('[MARKETPLACE] Checkout completed:', { total: cartTotal, items: cart.length });
    setCart([]);
    setShowCart(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <div className="border-b border-white/10 bg-gradient-to-br from-emerald-950/20 via-black to-cyan-950/20">
        <div className="max-w-[1600px] mx-auto px-8 py-16">
          <div className="flex items-start justify-between gap-8">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-sm text-emerald-400 font-semibold mb-6">
                <Sparkles className="w-4 h-4" />
                5 Produtos Exclusivos
              </div>
              
              <h1 className="text-6xl font-bold mb-6 leading-tight">
                <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
                  Neural Marketplace
                </span>
              </h1>
              
              <p className="text-xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
                Ferramentas profissionais de trading desenvolvidas com IA e tecnologia de ponta. 
                Eleve seu trading para o próximo nível.
              </p>

              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <span className="text-sm text-slate-400">Pagamento Seguro</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm text-slate-400">Acesso Instantâneo</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  <span className="text-sm text-slate-400">15,000+ Clientes</span>
                </div>
              </div>
            </div>

            {/* Cart Button */}
            <button
              onClick={() => setShowCart(!showCart)}
              className="relative px-6 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <ShoppingCart className="w-6 h-6 text-emerald-400" />
                <div className="text-left">
                  <div className="text-xs text-slate-400">Carrinho</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {cart.length > 0 ? formatPrice(cartTotal) : '$0'}
                  </div>
                </div>
              </div>
              {cart.length > 0 && (
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-sm font-bold shadow-lg shadow-emerald-500/50">
                  {cart.length}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-[1600px] mx-auto px-8 py-16">
        <div className="grid grid-cols-1 gap-8">
          {MARKETPLACE_PRODUCTS.map((product, index) => (
            <ProductCard
              key={product.id}
              product={product}
              index={index}
              onAddToCart={addToCart}
              onViewDetails={setSelectedProduct}
              isInCart={cart.some(item => item.product.id === product.id)}
            />
          ))}
        </div>
      </div>

      {/* Cart Modal */}
      {showCart && (
        <CartModal
          cart={cart}
          total={cartTotal}
          onClose={() => setShowCart(false)}
          onRemove={removeFromCart}
          onCheckout={handleCheckout}
        />
      )}

      {/* Product Details Modal */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={addToCart}
          isInCart={cart.some(item => item.product.id === selectedProduct.id)}
        />
      )}
    </div>
  );
}

// ============================================================================
// PRODUCT CARD COMPONENT
// ============================================================================

interface ProductCardProps {
  product: Product;
  index: number;
  onAddToCart: (product: Product) => void;
  onViewDetails: (product: Product) => void;
  isInCart: boolean;
}

function ProductCard({ product, index, onAddToCart, onViewDetails, isInCart }: ProductCardProps) {
  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const getBadgeConfig = () => {
    switch (product.badge) {
      case 'best-seller': return { icon: Crown, text: 'Best Seller', color: 'yellow' };
      case 'new': return { icon: Sparkles, text: 'Novo', color: 'cyan' };
      case 'exclusive': return { icon: Shield, text: 'Exclusivo', color: 'emerald' };
      case 'premium': return { icon: Star, text: 'Premium', color: 'purple' };
      default: return null;
    }
  };

  const badge = getBadgeConfig();

  return (
    <div 
      className="group bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 rounded-3xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/10"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="lg:flex">
        {/* Image */}
        <div className="lg:w-2/5 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
          <img 
            src={product.image} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          
          {/* Badges */}
          <div className="absolute top-6 left-6 flex flex-col gap-2">
            {product.isOwnProduct && (
              <div className="px-4 py-2 bg-emerald-500 rounded-full text-sm font-bold shadow-lg shadow-emerald-500/50 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                NOSSO PRODUTO
              </div>
            )}
            
            {badge && (
              <div className={`px-4 py-2 bg-${badge.color}-500/20 backdrop-blur-sm border border-${badge.color}-500/30 rounded-full text-sm font-semibold flex items-center gap-2`}>
                <badge.icon className={`w-4 h-4 text-${badge.color}-400`} />
                <span className={`text-${badge.color}-400`}>{badge.text}</span>
              </div>
            )}
          </div>

          {discount > 0 && (
            <div className="absolute top-6 right-6 px-4 py-2 bg-red-500 rounded-full text-lg font-bold shadow-lg shadow-red-500/50">
              -{discount}% OFF
            </div>
          )}

          {/* Stats Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="text-white font-semibold">{product.rating}</span>
                <span className="text-slate-400 text-sm">({product.reviews})</span>
              </div>
              <div className="text-sm text-slate-400">
                {formatNumber(product.sales)} vendas
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="lg:w-3/5 p-8 lg:p-10 flex flex-col">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold mb-3 group-hover:text-emerald-400 transition-colors">
              {product.name}
            </h2>
            <p className="text-lg text-emerald-400 font-semibold mb-4">
              {product.tagline}
            </p>
            <p className="text-slate-300 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Features */}
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">
              Recursos Principais:
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {product.features.slice(0, 4).map((feature, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price & CTA */}
          <div className="mt-auto pt-6 border-t border-white/10">
            <div className="flex items-end justify-between gap-6">
              <div>
                {product.originalPrice && (
                  <div className="text-sm text-slate-500 line-through mb-1">
                    {formatPrice(product.originalPrice)}
                  </div>
                )}
                <div className="text-4xl font-bold text-emerald-400 mb-1">
                  {formatPrice(product.price)}
                </div>
                <div className="text-xs text-slate-500">
                  {product.type === 'lifetime' ? 'Pagamento único' : 'Assinatura mensal'}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => onViewDetails(product)}
                  className="px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-semibold transition-all"
                >
                  Ver Detalhes
                </button>
                
                <button
                  onClick={() => onAddToCart(product)}
                  disabled={isInCart}
                  className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  {isInCart ? (
                    <>
                      <Check className="w-5 h-5" />
                      No Carrinho
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CART MODAL
// ============================================================================

interface CartModalProps {
  cart: CartItem[];
  total: number;
  onClose: () => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
}

function CartModal({ cart, total, onClose, onRemove, onCheckout }: CartModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Meu Carrinho</h2>
              <p className="text-sm text-slate-400">{cart.length} {cart.length === 1 ? 'produto' : 'produtos'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingCart className="w-20 h-20 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">Carrinho vazio</p>
            </div>
          ) : (
            cart.map(item => (
              <div
                key={item.product.id}
                className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-emerald-500/30 transition-all"
              >
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="w-24 h-24 object-cover rounded-xl"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">{item.product.name}</h3>
                  <p className="text-sm text-slate-400 mb-2">{item.product.tagline}</p>
                  <div className="text-2xl font-bold text-emerald-400">
                    {formatPrice(item.product.price)}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(item.product.id)}
                  className="p-3 hover:bg-red-500/20 text-red-400 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="p-6 border-t border-white/10 space-y-4">
            <div className="flex items-center justify-between text-2xl font-bold">
              <span>Total:</span>
              <span className="text-emerald-400">{formatPrice(total)}</span>
            </div>
            
            <button
              onClick={onCheckout}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/20"
            >
              <Lock className="w-5 h-5" />
              Finalizar Compra Segura
            </button>

            <div className="flex items-center justify-center gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <Shield className="w-4 h-4" />
                <span>Pagamento Seguro</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4" />
                <span>Acesso Instantâneo</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PRODUCT DETAILS MODAL
// ============================================================================

interface ProductDetailsModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (product: Product) => void;
  isInCart: boolean;
}

function ProductDetailsModal({ product, onClose, onAddToCart, isInCart }: ProductDetailsModalProps) {
  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="w-full max-w-5xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header Image */}
        <div className="relative h-80">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
          
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-3 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {discount > 0 && (
            <div className="absolute top-6 left-6 px-6 py-3 bg-red-500 rounded-full text-xl font-bold shadow-lg">
              -{discount}% OFF
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-10 space-y-8">
          {/* Title */}
          <div>
            <h1 className="text-5xl font-bold mb-4">{product.name}</h1>
            <p className="text-2xl text-emerald-400 font-semibold mb-4">{product.tagline}</p>
            <p className="text-lg text-slate-300 leading-relaxed">{product.description}</p>
          </div>

          {/* Features */}
          <div>
            <h3 className="text-2xl font-bold mb-4">✨ Recursos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {product.features.map((feature, i) => (
                <div key={i} className="flex items-start gap-3 p-3 bg-white/5 rounded-xl">
                  <span className="text-slate-300">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Benefits */}
          <div>
            <h3 className="text-2xl font-bold mb-4">🎯 Benefícios</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {product.benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-slate-300">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Included */}
          <div>
            <h3 className="text-2xl font-bold mb-4">📦 O que está incluído</h3>
            <div className="space-y-3">
              {product.included.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl">
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                  <span className="text-slate-300">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price & CTA */}
          <div className="flex items-center justify-between pt-8 border-t border-white/10">
            <div>
              {product.originalPrice && (
                <div className="text-lg text-slate-500 line-through mb-2">
                  {formatPrice(product.originalPrice)}
                </div>
              )}
              <div className="text-5xl font-bold text-emerald-400 mb-2">
                {formatPrice(product.price)}
              </div>
              <div className="text-sm text-slate-500">
                {product.type === 'lifetime' ? 'Pagamento único • Acesso vitalício' : 'Assinatura mensal • Cancele quando quiser'}
              </div>
            </div>

            <button
              onClick={() => {
                onAddToCart(product);
                onClose();
              }}
              disabled={isInCart}
              className="px-12 py-5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-2xl text-xl font-bold transition-all flex items-center gap-3 shadow-lg shadow-emerald-500/20"
            >
              {isInCart ? (
                <>
                  <Check className="w-6 h-6" />
                  No Carrinho
                </>
              ) : (
                <>
                  <ShoppingCart className="w-6 h-6" />
                  Adicionar ao Carrinho
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// UTILS
// ============================================================================

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatNumber(num: number): string {
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}k`;
  }
  return num.toString();
}
