import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, ArrowDown, BookOpen, TrendingUp, TrendingDown } from 'lucide-react';

interface OrderBookProps {
  selectedPair: string;
}

interface OrderBookEntry {
  price: number;
  volume: number;
  total: number;
  percentage: number;
  type: 'bid' | 'ask';
}

const OrderBook: React.FC<OrderBookProps> = ({ selectedPair }) => {
  const [viewMode, setViewMode] = useState<'combined' | 'bids' | 'asks'>('combined');

  // Fetch order book data
  const { data: offers, isLoading } = useQuery({
    queryKey: ['orderbook', selectedPair],
    queryFn: async () => {
      const response = await fetch('http://localhost:3001/analytics/orderbook?taker_gets_currency=XRP&taker_pays_currency=USDC');
      if (!response.ok) {
        throw new Error('Failed to fetch order book');
      }
      return response.json();
    },
  });

  // Process data for order book display
  const processOrderBook = () => {
    if (!offers) return { bids: [], asks: [] };

    const processSide = (orders: any[], type: 'bid' | 'ask') => {
      let runningTotal = 0;
      const processed = orders.slice(0, 10).map((order: any) => {
        runningTotal += parseFloat(order.amount);
        return {
          price: parseFloat(order.price),
          volume: parseFloat(order.amount),
          total: runningTotal,
          percentage: 0, // Will be calculated after
          type,
        };
      });

      // Calculate percentages
      const maxTotal = Math.max(...processed.map(p => p.total));
      return processed.map(p => ({
        ...p,
        percentage: (p.total / maxTotal) * 100,
      }));
    };

    const bids = processSide(offers.bids || [], 'bid');
    const asks = processSide(offers.asks || [], 'ask');

    return { bids, asks };
  };

  const { bids, asks } = processOrderBook();

  const OrderRow: React.FC<{ order: OrderBookEntry; index: number }> = ({ order, index }) => (
    <motion.div
      initial={{ opacity: 0, x: order.type === 'bid' ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={`relative flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 hover:bg-slate-700/30 group`}
    >
      {/* Background bar showing volume */}
      <div
        className={`absolute inset-0 rounded-lg transition-all duration-500 ${
          order.type === 'bid' 
            ? 'bg-gradient-to-r from-green-500/10 to-transparent' 
            : 'bg-gradient-to-r from-red-500/10 to-transparent'
        }`}
        style={{ width: `${order.percentage}%` }}
      />
      
      <div className="relative z-10 flex items-center justify-between w-full">
        <div className={`font-mono text-sm font-semibold ${
          order.type === 'bid' ? 'text-green-400' : 'text-red-400'
        }`}>
          {order.price.toFixed(4)}
        </div>
        
        <div className="text-slate-300 text-sm">
          {order.volume.toFixed(2)}
        </div>
        
        <div className="text-slate-400 text-xs">
          {order.total.toFixed(2)}
        </div>
      </div>

      {/* Hover effect */}
      <div className={`absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${
        order.type === 'bid' 
          ? 'bg-green-500/5 border border-green-500/20' 
          : 'bg-red-500/5 border border-red-500/20'
      }`} />
    </motion.div>
  );

  if (isLoading) {
    return (
      <div className="chart-container">
        <div className="flex items-center space-x-2 mb-4">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Order Book</h3>
        </div>
        
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="loading-shimmer h-8 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="chart-container"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Order Book</h3>
        </div>

        {/* View Mode Toggle */}
        <div className="flex bg-slate-700/50 rounded-lg p-1">
          <button
            onClick={() => setViewMode('bids')}
            className={`px-2 py-1 rounded text-xs transition-all flex items-center space-x-1 ${
              viewMode === 'bids'
                ? 'bg-green-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <TrendingUp className="w-3 h-3" />
            <span>Bids</span>
          </button>
          <button
            onClick={() => setViewMode('combined')}
            className={`px-2 py-1 rounded text-xs transition-all ${
              viewMode === 'combined'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Both
          </button>
          <button
            onClick={() => setViewMode('asks')}
            className={`px-2 py-1 rounded text-xs transition-all flex items-center space-x-1 ${
              viewMode === 'asks'
                ? 'bg-red-600 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <TrendingDown className="w-3 h-3" />
            <span>Asks</span>
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-400 font-semibold border-b border-slate-700/50 mb-2">
        <span>Price</span>
        <span>Amount</span>
        <span>Total</span>
      </div>

      {/* Order Book Content */}
      <div className="space-y-1">
        <AnimatePresence mode="wait">
          {(viewMode === 'combined' || viewMode === 'asks') && (
            <motion.div
              key="asks"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1"
            >
              {/* Asks (Sell Orders) - Show in reverse order */}
              {asks.slice().reverse().map((ask, index) => (
                <OrderRow key={`ask-${ask.price}`} order={ask} index={index} />
              ))}
            </motion.div>
          )}

          {viewMode === 'combined' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center justify-center py-4 my-2"
            >
              <div className="flex items-center space-x-4 bg-slate-800/50 rounded-lg px-4 py-2 border border-slate-600/30">
                <div className="text-center">
                  <div className="text-xs text-slate-400">Spread</div>
                  <div className="text-sm font-semibold text-white">
                    {asks.length > 0 && bids.length > 0 
                      ? (asks[0].price - bids[0].price).toFixed(4)
                      : '--'
                    }
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-600"></div>
                <div className="text-center">
                  <div className="text-xs text-slate-400">Mid Price</div>
                  <div className="text-lg font-bold text-blue-400">
                    {asks.length > 0 && bids.length > 0 
                      ? ((asks[0].price + bids[0].price) / 2).toFixed(4)
                      : '--'
                    }
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {(viewMode === 'combined' || viewMode === 'bids') && (
            <motion.div
              key="bids"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1"
            >
              {/* Bids (Buy Orders) */}
              {bids.map((bid, index) => (
                <OrderRow key={`bid-${bid.price}`} order={bid} index={index} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Order Book Stats */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-700/50">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-green-400 mb-1">
            <ArrowUp className="w-4 h-4" />
            <span className="text-xs font-semibold">Best Bid</span>
          </div>
          <div className="text-lg font-bold text-green-400">
            {bids.length > 0 ? bids[0].price.toFixed(4) : '--'}
          </div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-red-400 mb-1">
            <ArrowDown className="w-4 h-4" />
            <span className="text-xs font-semibold">Best Ask</span>
          </div>
          <div className="text-lg font-bold text-red-400">
            {asks.length > 0 ? asks[0].price.toFixed(4) : '--'}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderBook; 