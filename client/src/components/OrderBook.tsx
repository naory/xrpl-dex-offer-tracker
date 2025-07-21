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
    <div className={`order-row ${order.type === 'bid' ? 'bid-row' : 'ask-row'}`}>
      <div 
        ref={barRef}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          height: '100%',
          background: order.type === 'bid' 
            ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(16, 185, 129, 0.05))'
            : 'linear-gradient(90deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))',
          borderRadius: '6px',
          transition: 'width 0.3s ease',
          zIndex: 1,
        }}
      />
      <div className="order-row-content">
        <span className={`order-price ${order.type === 'bid' ? 'stat-value green' : 'stat-value red'}`}>
          <AnimatedNumber value={displayPrice} decimals={6} />
        </span>
        <span className="order-amount">
          <AnimatedNumber value={parseFloat(order.amount)} decimals={2} />
        </span>
        <span className="order-total">
          <AnimatedNumber value={order.total || 0} decimals={2} suffix={` ${priceCurrency}`} />
        </span>
      </div>
    </div>
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

  // Calculate best prices
  const bestBid = processedData?.bids[0] ? calculateDisplayPrice(processedData.bids[0]) : 0;
  const bestAsk = processedData?.asks[0] ? calculateDisplayPrice(processedData.asks[0]) : 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const midPrice = bestAsk && bestBid ? (bestBid + bestAsk) / 2 : 0;

  if (isLoading) {
    return (
      <div className="chart-container">
        <div className="component-header">
          <div className="component-title">
            <span>📊</span>
            <h3>Order Book</h3>
            <span className="component-subtitle">({selectedPair})</span>
          </div>
        </div>
        <div className="recent-offers-container">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="loading-shimmer" style={{ height: '48px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      {/* Header with View Mode Toggle */}
      <div className="component-header">
        <div className="component-title">
          <span>📊</span>
          <h3>Order Book</h3>
          <span className="component-subtitle">({selectedPair})</span>
        </div>

        {/* View Mode Toggle */}
        <div className="btn-group">
          <button
            onClick={() => setViewMode('bids')}
            className={`btn-toggle btn-toggle-sm ${viewMode === 'bids' ? 'active green' : ''}`}
          >
            Bids
          </button>
          <button
            onClick={() => setViewMode('combined')}
            className={`btn-toggle btn-toggle-sm ${viewMode === 'combined' ? 'active' : ''}`}
          >
            Both
          </button>
          <button
            onClick={() => setViewMode('asks')}
            className={`btn-toggle btn-toggle-sm ${viewMode === 'asks' ? 'active red' : ''}`}
          >
            Asks
          </button>
        </div>
      </div>

      {/* Column Headers */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 12px',
        fontSize: '12px',
        color: '#94a3b8',
        fontWeight: '600',
        borderBottom: '1px solid rgba(71, 85, 105, 0.5)',
        marginBottom: '12px'
      }}>
        <span>Price ({priceCurrency})</span>
        <span>Amount</span>
        <span>Total</span>
      </div>

      <div>
        {/* Asks */}
        {(viewMode === 'combined' || viewMode === 'asks') && (
          <div style={{ marginBottom: viewMode === 'combined' ? '16px' : '0' }}>
            {processedData?.asks && processedData.asks.length > 0 ? (
              processedData.asks.slice().reverse().map((ask) => (
                <OrderRow 
                  key={ask.key}
                  order={ask} 
                  displayPrice={calculateDisplayPrice(ask)}
                  priceCurrency={priceCurrency}
                />
              ))
            ) : (
              <div className="no-data">
                <div className="no-data-title">No ask orders available</div>
                <div className="no-data-subtitle">for {selectedPair}</div>
              </div>
            )}
          </div>
        )}

        {/* Spread Display */}
        {viewMode === 'combined' && (
          <div className="spread-display">
            <div className="spread-content">
              <div className="spread-item">
                <div className="stat-label">Spread</div>
                <div className="stat-value">
                  <AnimatedNumber value={spread} decimals={6} suffix={` ${priceCurrency}`} />
                </div>
              </div>
              <div className="spread-divider"></div>
              <div className="spread-item">
                <div className="stat-label">Mid Price</div>
                <div className="stat-value blue">
                  <AnimatedNumber value={midPrice} decimals={6} suffix={` ${priceCurrency}`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bids */}
        {(viewMode === 'combined' || viewMode === 'bids') && (
          <div>
            {processedData?.bids && processedData.bids.length > 0 ? (
              processedData.bids.map((bid) => (
                <OrderRow 
                  key={bid.key}
                  order={bid} 
                  displayPrice={calculateDisplayPrice(bid)}
                  priceCurrency={priceCurrency}
                />
              ))
            ) : (
              <div className="no-data">
                <div className="no-data-title">No bid orders available</div>
                <div className="no-data-subtitle">for {selectedPair}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Order Book Stats */}
      <div className="stats-grid cols-2">
        <div className="stat-item">
          <div className="stat-label">↗ Best Bid</div>
          <div className="stat-value green">
            <AnimatedNumber value={bestBid} decimals={6} suffix={` ${priceCurrency}`} />
          </div>
        </div>
        
        <div className="stat-item">
          <div className="stat-label">↘ Best Ask</div>
          <div className="stat-value red">
            <AnimatedNumber value={bestAsk} decimals={6} suffix={` ${priceCurrency}`} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderBook; 