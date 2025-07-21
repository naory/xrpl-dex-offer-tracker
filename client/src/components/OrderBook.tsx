import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface OrderBookEntry {
  price: string;
  amount: string;
  account: string;
  total?: number;
  percentage?: number;
  type?: 'bid' | 'ask';
  isNew?: boolean;
  isUpdated?: boolean;
  key?: string;
}

interface OrderBookData {
  taker_gets_currency: string;
  taker_pays_currency: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

interface OrderBookProps {
  selectedPair: string;
}

// Simple animated number component
const AnimatedNumber: React.FC<{ 
  value: number; 
  decimals?: number; 
  className?: string;
  suffix?: string;
}> = ({ value, decimals = 6, className = '', suffix = '' }) => {
  const [displayValue, setDisplayValue] = useState(value.toFixed(decimals) + suffix);
  const targetRef = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = targetRef.current;
    const endValue = value;
    
    if (Math.abs(startValue - endValue) < 0.000001) {
      setDisplayValue(endValue.toFixed(decimals) + suffix);
      return;
    }

    const duration = 600;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 2);
      const currentValue = startValue + (endValue - startValue) * easeOut;
      
      setDisplayValue(currentValue.toFixed(decimals) + suffix);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        targetRef.current = endValue;
      }
    };

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, decimals, suffix]);

  return <span className={className}>{displayValue}</span>;
};

// Simple order row component
const OrderRow: React.FC<{ 
  order: OrderBookEntry; 
  displayPrice: number;
  priceCurrency: string;
}> = React.memo(({ order, displayPrice, priceCurrency }) => {
  const barRef = useRef<HTMLDivElement>(null);
  
  // Update bar width directly
  useEffect(() => {
    if (barRef.current) {
      barRef.current.style.width = `${order.percentage || 0}%`;
    }
  }, [order.percentage]);

  return (
    <div 
      className={`order-row ${order.type === 'bid' ? 'bid-row' : 'ask-row'}`}
      style={{ 
        position: 'relative',
        padding: '8px 12px',
        borderRadius: '4px',
        marginBottom: '2px',
        cursor: 'pointer'
      }}
    >
      {/* Depth bar */}
      <div 
        ref={barRef}
        className={`depth-bar ${order.type === 'bid' ? 'depth-bid' : 'depth-ask'}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: '0%',
          borderRadius: '4px',
          transition: 'width 0.6s ease-out',
          zIndex: 1
        }}
      />
      
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <AnimatedNumber
          value={displayPrice}
          decimals={6}
          className={`price ${order.type === 'bid' ? 'price-bid' : 'price-ask'}`}
        />
        <AnimatedNumber
          value={parseFloat(order.amount)}
          decimals={0}
          className="amount"
        />
        <AnimatedNumber
          value={order.total || 0}
          decimals={0}
          className="total text-slate-400 text-sm"
        />
      </div>
    </div>
  );
}, (prev, next) => {
  // Only re-render if key data actually changed
  return (
    prev.order.key === next.order.key &&
    prev.order.price === next.order.price &&
    prev.order.amount === next.order.amount &&
    prev.order.total === next.order.total &&
    prev.order.percentage === next.order.percentage &&
    prev.displayPrice === next.displayPrice
  );
});

const OrderBook: React.FC<OrderBookProps> = ({ selectedPair }) => {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [viewMode, setViewMode] = useState<'combined' | 'bids' | 'asks'>('combined');
  const [isLoading, setIsLoading] = useState(true);

  // Parse the trading pair to get currencies
  const parseTradingPair = useCallback((pair: string) => {
    const [base, quote] = pair.split('/');
    return { base, quote };
  }, []);

  // Determine which currency to show the price in
  const getPriceCurrency = useCallback((base: string, quote: string) => {
    if (base === 'XRP') return quote;
    if (quote === 'XRP') return base;
    return quote;
  }, []);

  // Calculate the display price based on the pair
  const calculateDisplayPrice = useCallback((order: OrderBookEntry) => {
    const price = parseFloat(order.price);
    const { base, quote } = parseTradingPair(selectedPair);
    
    if (base === 'XRP' && quote !== 'XRP') {
      if (order.type === 'ask') {
        return price > 0 ? 1 / price : 0;
      } else {
        return price;
      }
    } else if (quote === 'XRP' && base !== 'XRP') {
      if (order.type === 'ask') {
        return price;
      } else {
        return price > 0 ? 1 / price : 0;
      }
    } else {
      return price;
    }
  }, [selectedPair, parseTradingPair]);

  // Process order data with running totals
  const processedData = useMemo(() => {
    if (!orderBook) return null;

    const processOrders = (orders: OrderBookEntry[], type: 'bid' | 'ask') => {
      if (!orders?.length) return [];
      
      // Filter extreme values and take top 10
      const filtered = orders
        .filter(order => {
          const price = parseFloat(order.price);
          return price > 0 && price < 1000000; // Basic sanity check
        })
        .slice(0, 10);

      let runningTotal = 0;
      const withTotals = filtered.map(order => {
        runningTotal += parseFloat(order.amount);
        return {
          ...order,
          type,
          total: runningTotal,
          key: `${type}-${order.price}-${order.account}`
        };
      });

      // Calculate percentages
      const maxTotal = Math.max(...withTotals.map(o => o.total || 0));
      return withTotals.map(order => ({
        ...order,
        percentage: maxTotal > 0 ? ((order.total || 0) / maxTotal) * 100 : 0
      }));
    };

    return {
      ...orderBook,
      bids: processOrders(orderBook.bids, 'bid'),
      asks: processOrders(orderBook.asks, 'ask')
    };
  }, [orderBook]);

  // Fetch order book data
  useEffect(() => {
    const fetchOrderBook = async () => {
      try {
        const { base, quote } = parseTradingPair(selectedPair);
        const url = `http://localhost:3001/analytics/orderbook?taker_gets_currency=${base}&taker_pays_currency=${quote}`;
        
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setOrderBook(data);
        }
      } catch (error) {
        console.log('Order book fetch failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrderBook();
    const interval = setInterval(fetchOrderBook, 5000);
    return () => clearInterval(interval);
  }, [selectedPair, parseTradingPair]);

  const { base, quote } = parseTradingPair(selectedPair);
  const priceCurrency = getPriceCurrency(base, quote);
  const amountCurrency = base === 'XRP' ? base : (quote === 'XRP' ? quote : base);

  if (isLoading || !processedData) {
    return (
      <div className="chart-container">
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-blue-400">📖</span>
          <h3 className="text-xl font-semibold text-white">Order Book</h3>
          <span className="text-sm text-slate-400">({selectedPair})</span>
        </div>
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="loading-shimmer" style={{ height: '32px', borderRadius: '4px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  const bestBid = processedData.bids[0] ? calculateDisplayPrice(processedData.bids[0]) : 0;
  const bestAsk = processedData.asks[0] ? calculateDisplayPrice(processedData.asks[0]) : 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const midPrice = bestAsk && bestBid ? (bestBid + bestAsk) / 2 : 0;

  return (
    <div className="chart-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <span className="text-blue-400">📖</span>
          <h3 className="text-xl font-semibold text-white">Order Book</h3>
          <span className="text-sm text-slate-400">({selectedPair})</span>
        </div>

        {/* View Mode Toggle */}
        <div className="flex" style={{ background: 'rgba(30, 41, 59, 0.8)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(71, 85, 105, 0.3)' }}>
          <button
            onClick={() => setViewMode('bids')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
              viewMode === 'bids' 
                ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-sm border border-green-500' 
                : 'text-slate-500 hover:text-white hover:bg-slate-700/50 border border-transparent bg-slate-900/40'
            }`}
          >
            Bids
          </button>
          <button
            onClick={() => setViewMode('combined')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
              viewMode === 'combined' 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm border border-blue-500' 
                : 'text-slate-500 hover:text-white hover:bg-slate-700/50 border border-transparent bg-slate-900/40'
            }`}
          >
            Both
          </button>
          <button
            onClick={() => setViewMode('asks')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
              viewMode === 'asks' 
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-sm border border-red-500' 
                : 'text-slate-500 hover:text-white hover:bg-slate-700/50 border border-transparent bg-slate-900/40'
            }`}
          >
            Asks
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div className="flex justify-between px-3 py-2 text-xs text-slate-400 font-semibold border-b border-slate-700/50 mb-3">
        <span>Price ({priceCurrency})</span>
        <span>Amount ({amountCurrency})</span>
        <span>Total</span>
      </div>

      {/* Order Book Content */}
      <div className="space-y-1">
        {/* Asks */}
        {(viewMode === 'combined' || viewMode === 'asks') && (
          <div className="asks-section">
            {processedData.asks.length > 0 ? (
              processedData.asks.slice().reverse().map((ask) => (
                <OrderRow 
                  key={ask.key}
                  order={ask} 
                  displayPrice={calculateDisplayPrice(ask)}
                  priceCurrency={priceCurrency}
                />
              ))
            ) : (
              <div className="text-center py-4 text-slate-400">
                <div className="text-sm">No ask orders available</div>
                <div className="text-xs text-slate-500 mt-1">for {selectedPair}</div>
              </div>
            )}
          </div>
        )}

        {/* Spread Display */}
        {viewMode === 'combined' && (
          <div className="spread-display my-4 py-3 px-4 text-center" style={{
            background: 'rgba(51, 65, 85, 0.3)',
            borderRadius: '8px',
            border: '1px solid rgba(71, 85, 105, 0.3)'
          }}>
            <div className="flex items-center justify-center space-x-6">
              <div className="text-center">
                <div className="text-xs text-slate-400">Spread</div>
                <div className="text-sm font-semibold text-white">
                  <AnimatedNumber value={spread} decimals={6} suffix={` ${priceCurrency}`} />
                </div>
              </div>
              <div className="w-px h-8" style={{ background: 'rgba(71, 85, 105, 0.5)' }}></div>
              <div className="text-center">
                <div className="text-xs text-slate-400">Mid Price</div>
                <div className="text-lg font-bold text-blue-400">
                  <AnimatedNumber value={midPrice} decimals={6} suffix={` ${priceCurrency}`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bids */}
        {(viewMode === 'combined' || viewMode === 'bids') && (
          <div className="bids-section">
            {processedData.bids.length > 0 ? (
              processedData.bids.map((bid) => (
                <OrderRow 
                  key={bid.key}
                  order={bid} 
                  displayPrice={calculateDisplayPrice(bid)}
                  priceCurrency={priceCurrency}
                />
              ))
            ) : (
              <div className="text-center py-4 text-slate-400">
                <div className="text-sm">No bid orders available</div>
                <div className="text-xs text-slate-500 mt-1">for {selectedPair}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Book Stats */}
      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-700/50">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-green-400 mb-1">
            <span>↗</span>
            <span className="text-xs font-semibold">Best Bid</span>
          </div>
          <div className="text-lg font-bold text-green-400">
            <AnimatedNumber value={bestBid} decimals={6} suffix={` ${priceCurrency}`} />
          </div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-red-400 mb-1">
            <span>↘</span>
            <span className="text-xs font-semibold">Best Ask</span>
          </div>
          <div className="text-lg font-bold text-red-400">
            <AnimatedNumber value={bestAsk} decimals={6} suffix={` ${priceCurrency}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderBook; 