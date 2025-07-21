import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface OrderBookEntry {
  price: string;
  amount: string;
  account: string;
  total?: number;
  percentage?: number;
  type?: 'bid' | 'ask';
  key?: string;
}

interface OrderBookData {
  taker_gets_currency: string;
  taker_pays_currency: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
}

interface OrderBookHeatmapProps {
  selectedPair: string;
}

interface PriceLevel {
  price: number;
  bidVolume: number;
  askVolume: number;
  totalVolume: number;
  bidCount: number;
  askCount: number;
}

const OrderBookHeatmap: React.FC<OrderBookHeatmapProps> = ({ selectedPair }) => {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredLevel, setHoveredLevel] = useState<PriceLevel | null>(null);
  const [viewMode, setViewMode] = useState<'volume' | 'count' | 'heatmap'>('volume');
  const [showExtremeOrders, setShowExtremeOrders] = useState(true);
  const [priceRange, setPriceRange] = useState<'all' | 'normal' | 'extreme'>('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Process order data for heatmap visualization
  const heatmapData = useMemo(() => {
    if (!orderBook) return { priceLevels: [], priceRange: { min: 0, max: 0 }, currentPrice: 0 };

    try {
      // Aggregate orders by price levels
      const priceMap = new Map<number, PriceLevel>();

      const processOrders = (orders: OrderBookEntry[], type: 'bid' | 'ask') => {
        // Limit processing to prevent hanging
        const maxOrders = 1000;
        const limitedOrders = orders.slice(0, maxOrders);
        
        limitedOrders.forEach(order => {
          try {
            const price = calculateDisplayPrice({ ...order, type });
            const amount = parseFloat(order.amount);
            
            if (price > 0 && amount > 0 && price < 1000000) { // Sanity check
              // Use less precision to reduce processing load
              const roundedPrice = Math.round(price * 1000) / 1000; // 3 decimal places
              
              if (!priceMap.has(roundedPrice)) {
                priceMap.set(roundedPrice, {
                  price: roundedPrice,
                  bidVolume: 0,
                  askVolume: 0,
                  totalVolume: 0,
                  bidCount: 0,
                  askCount: 0
                });
              }
              
              const level = priceMap.get(roundedPrice)!;
              if (type === 'bid') {
                level.bidVolume += amount;
                level.bidCount += 1;
              } else {
                level.askVolume += amount;
                level.askCount += 1;
              }
              level.totalVolume = level.bidVolume + level.askVolume;
            }
          } catch (error) {
            console.log('Error processing order:', error);
          }
        });
      };

      processOrders(orderBook.bids, 'bid');
      processOrders(orderBook.asks, 'ask');

      // Convert to array and sort by price
      let priceLevels = Array.from(priceMap.values()).sort((a, b) => a.price - b.price);

      // Calculate current market price (mid of best bid/ask)
      const bestBid = orderBook.bids[0] ? calculateDisplayPrice({ ...orderBook.bids[0], type: 'bid' }) : 0;
      const bestAsk = orderBook.asks[0] ? calculateDisplayPrice({ ...orderBook.asks[0], type: 'ask' }) : 0;
      const currentPrice = bestBid && bestAsk ? (bestBid + bestAsk) / 2 : (bestBid || bestAsk || 0);

      // Filter based on price range setting
      if (currentPrice > 0) {
        if (priceRange === 'normal') {
          // Show orders within 50% of current price
          const minPrice = currentPrice * 0.5;
          const maxPrice = currentPrice * 1.5;
          priceLevels = priceLevels.filter(level => level.price >= minPrice && level.price <= maxPrice);
        } else if (priceRange === 'extreme') {
          // Show only extreme orders (outside 50% of current price)
          const minPrice = currentPrice * 0.5;
          const maxPrice = currentPrice * 1.5;
          priceLevels = priceLevels.filter(level => level.price < minPrice || level.price > maxPrice);
        }
      }

      // Limit the number of price levels to prevent rendering issues
      if (priceLevels.length > 500) {
        priceLevels = priceLevels.slice(0, 500);
      }

      // Calculate price range for visualization
      const prices = priceLevels.map(level => level.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const pricePadding = (maxPrice - minPrice) * 0.05;

      return {
        priceLevels,
        priceRange: {
          min: Math.max(0, minPrice - pricePadding),
          max: maxPrice + pricePadding
        },
        currentPrice
      };
    } catch (error) {
      console.error('Error processing heatmap data:', error);
      return { priceLevels: [], priceRange: { min: 0, max: 0 }, currentPrice: 0 };
    }
  }, [orderBook, calculateDisplayPrice, priceRange]);

  // Handle processing state
  useEffect(() => {
    if (priceRange === 'extreme') {
      setIsProcessing(true);
      const timer = setTimeout(() => {
        setIsProcessing(false);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setIsProcessing(false);
    }
  }, [priceRange]);

  // Draw the heatmap
  const drawHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heatmapData.priceLevels.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const { priceLevels, priceRange } = heatmapData;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate scales
    const maxVolume = Math.max(...priceLevels.map(level => level.totalVolume));
    const maxCount = Math.max(...priceLevels.map(level => level.bidCount + level.askCount));

    const priceToX = (price: number) => {
      return ((price - priceRange.min) / (priceRange.max - priceRange.min)) * width;
    };

    const volumeToHeight = (volume: number) => {
      return (volume / maxVolume) * (height * 0.8);
    };

    const countToHeight = (count: number) => {
      return (count / maxCount) * (height * 0.8);
    };

    // Draw grid lines
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.2)';
    ctx.lineWidth = 1;
    
    // Vertical grid lines (price)
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw price levels
    priceLevels.forEach((level, index) => {
      const x = priceToX(level.price);
      const barWidth = Math.max(2, width / priceLevels.length * 0.8);
      
      let barHeight = 0;
      let color = '';

      // Calculate distance from current price
      const priceDistance = Math.abs(level.price - heatmapData.currentPrice) / heatmapData.currentPrice;
      const isExtreme = priceDistance > 0.5; // More than 50% from current price

      if (viewMode === 'volume') {
        barHeight = volumeToHeight(level.totalVolume);
        // Color based on bid/ask ratio and extremity
        const bidRatio = level.bidVolume / level.totalVolume;
        if (isExtreme) {
          // Extreme orders get special colors
          if (level.price > heatmapData.currentPrice) {
            color = `rgba(255, 165, 0, ${0.4 + (level.totalVolume / maxVolume) * 0.4})`; // Orange for extreme asks
          } else {
            color = `rgba(128, 0, 128, ${0.4 + (level.totalVolume / maxVolume) * 0.4})`; // Purple for extreme bids
          }
        } else {
          if (bidRatio > 0.6) {
            color = `rgba(16, 185, 129, ${0.3 + bidRatio * 0.4})`; // Green for bid-heavy
          } else if (bidRatio < 0.4) {
            color = `rgba(239, 68, 68, ${0.3 + (1 - bidRatio) * 0.4})`; // Red for ask-heavy
          } else {
            color = `rgba(59, 130, 246, ${0.3 + 0.2})`; // Blue for balanced
          }
        }
      } else if (viewMode === 'count') {
        barHeight = countToHeight(level.bidCount + level.askCount);
        if (isExtreme) {
          color = `rgba(255, 215, 0, ${0.4 + (level.bidCount + level.askCount) / maxCount * 0.4})`; // Gold for extreme
        } else {
          color = `rgba(139, 92, 246, ${0.3 + (level.bidCount + level.askCount) / maxCount * 0.4})`;
        }
      } else { // heatmap
        barHeight = volumeToHeight(level.totalVolume);
        const intensity = level.totalVolume / maxVolume;
        if (isExtreme) {
          color = `rgba(255, 69, 0, ${0.2 + intensity * 0.6})`; // Red-orange for extreme
        } else {
          color = `rgba(59, 130, 246, ${0.1 + intensity * 0.6})`;
        }
      }

      // Draw bar
      ctx.fillStyle = color;
      ctx.fillRect(x - barWidth / 2, height - barHeight, barWidth, barHeight);

      // Draw border
      ctx.strokeStyle = isExtreme ? 'rgba(255, 255, 255, 0.6)' : 'rgba(71, 85, 105, 0.3)';
      ctx.lineWidth = isExtreme ? 2 : 1;
      ctx.strokeRect(x - barWidth / 2, height - barHeight, barWidth, barHeight);

      // Draw hover effect
      if (hoveredLevel && hoveredLevel.price === level.price) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.strokeRect(x - barWidth / 2, height - barHeight, barWidth, barHeight);
      }
    });

    // Draw current price line
    if (heatmapData.currentPrice > 0) {
      const currentX = priceToX(heatmapData.currentPrice);
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(currentX, 0);
      ctx.lineTo(currentX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Add current price label
      ctx.fillStyle = '#3b82f6';
      ctx.font = 'bold 12px Arial';
      ctx.fillText(`Current: ${heatmapData.currentPrice.toFixed(6)}`, currentX + 5, 15);
    }

    // Draw hover tooltip
    if (hoveredLevel) {
      const x = priceToX(hoveredLevel.price);
      const y = 20;
      
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.fillRect(x + 10, y - 10, 200, 80);
      
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText(`Price: ${hoveredLevel.price.toFixed(6)}`, x + 15, y + 5);
      ctx.fillText(`Bid Volume: ${hoveredLevel.bidVolume.toFixed(0)}`, x + 15, y + 20);
      ctx.fillText(`Ask Volume: ${hoveredLevel.askVolume.toFixed(0)}`, x + 15, y + 35);
      ctx.fillText(`Total Volume: ${hoveredLevel.totalVolume.toFixed(0)}`, x + 15, y + 50);
      ctx.fillText(`Orders: ${hoveredLevel.bidCount + hoveredLevel.askCount}`, x + 15, y + 65);
    }
  }, [heatmapData, hoveredLevel, viewMode]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = 400;
        drawHeatmap();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawHeatmap]);

  // Handle mouse events
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !heatmapData.priceLevels.length) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { width } = canvas;
    const { priceRange } = heatmapData;

    const priceToX = (price: number) => {
      return ((price - priceRange.min) / (priceRange.max - priceRange.min)) * width;
    };

    const xToPrice = (x: number) => {
      return priceRange.min + (x / width) * (priceRange.max - priceRange.min);
    };

    const hoveredPrice = xToPrice(x);
    const barWidth = Math.max(2, width / heatmapData.priceLevels.length * 0.8);

    // Find closest price level
    let closestLevel: PriceLevel | null = null;
    let minDistance = Infinity;

    heatmapData.priceLevels.forEach(level => {
      const levelX = priceToX(level.price);
      const distance = Math.abs(x - levelX);
      
      if (distance < minDistance && distance < barWidth) {
        minDistance = distance;
        closestLevel = level;
      }
    });

    setHoveredLevel(closestLevel);
  }, [heatmapData]);

  const handleMouseLeave = useCallback(() => {
    setHoveredLevel(null);
  }, []);

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
  const volumeCurrency = base === 'XRP' ? base : (quote === 'XRP' ? quote : base);

  if (isLoading || !heatmapData.priceLevels.length) {
    return (
      <div className="chart-container">
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-blue-400">🔥</span>
          <h3 className="text-xl font-semibold text-white">Order Book Heatmap</h3>
          <span className="text-sm text-slate-400">({selectedPair})</span>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-400">Loading heatmap...</div>
        </div>
      </div>
    );
  }

  const totalBidVolume = heatmapData.priceLevels.reduce((sum, level) => sum + level.bidVolume, 0);
  const totalAskVolume = heatmapData.priceLevels.reduce((sum, level) => sum + level.askVolume, 0);
  const totalOrders = heatmapData.priceLevels.reduce((sum, level) => sum + level.bidCount + level.askCount, 0);

  return (
    <div className="chart-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <span className="text-blue-400">🔥</span>
          <h3 className="text-xl font-semibold text-white">Order Book Heatmap</h3>
          <span className="text-sm text-slate-400">({selectedPair})</span>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex" style={{ background: 'rgba(30, 41, 59, 0.8)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(71, 85, 105, 0.3)' }}>
            <button
              onClick={() => setViewMode('volume')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                viewMode === 'volume' 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm border border-blue-500' 
                  : 'text-slate-500 hover:text-white hover:bg-slate-700/50 border border-transparent bg-slate-900/40'
              }`}
            >
              Volume
            </button>
            <button
              onClick={() => setViewMode('count')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                viewMode === 'count' 
                  ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-sm border border-purple-500' 
                  : 'text-slate-500 hover:text-white hover:bg-slate-700/50 border border-transparent bg-slate-900/40'
              }`}
            >
              Count
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                viewMode === 'heatmap' 
                  ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-sm border border-orange-500' 
                  : 'text-slate-500 hover:text-white hover:bg-slate-700/50 border border-transparent bg-slate-900/40'
              }`}
            >
              Heatmap
            </button>
          </div>

          {/* Price Range Filter */}
          <div className="flex" style={{ background: 'rgba(30, 41, 59, 0.8)', borderRadius: '8px', padding: '4px', border: '1px solid rgba(71, 85, 105, 0.3)' }}>
            <button
              onClick={() => setPriceRange('all')}
              disabled={isProcessing}
              className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                priceRange === 'all' 
                  ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-sm border border-green-500' 
                  : 'text-slate-500 hover:text-white hover:bg-slate-700/50 border border-transparent bg-slate-900/40'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              All
            </button>
            <button
              onClick={() => setPriceRange('normal')}
              disabled={isProcessing}
              className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                priceRange === 'normal' 
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-sm border border-blue-500' 
                  : 'text-slate-500 hover:text-white hover:bg-slate-700/50 border border-transparent bg-slate-900/40'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Normal
            </button>
            <button
              onClick={() => setPriceRange('extreme')}
              disabled={isProcessing}
              className={`px-3 py-1 rounded text-xs font-medium transition-all duration-200 ${
                priceRange === 'extreme' 
                  ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-sm border border-red-500' 
                  : 'text-slate-500 hover:text-white hover:bg-slate-700/50 border border-transparent bg-slate-900/40'
              } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isProcessing ? 'Processing...' : 'Extreme'}
            </button>
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            width: '100%',
            height: '400px',
            cursor: 'crosshair',
            borderRadius: '8px',
            background: 'rgba(15, 23, 42, 0.3)'
          }}
        />
        {isProcessing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
              <div className="text-sm">Processing extreme orders...</div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mt-6 pt-4 border-t border-slate-700/50">
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Current Price</div>
          <div className="text-lg font-bold text-blue-400">
            {heatmapData.currentPrice.toFixed(6)} {priceCurrency}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Total Bid Volume</div>
          <div className="text-lg font-bold text-green-400">
            {totalBidVolume.toLocaleString()} {volumeCurrency}
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Total Ask Volume</div>
          <div className="text-lg font-bold text-red-400">
            {totalAskVolume.toLocaleString()} {volumeCurrency}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Total Orders</div>
          <div className="text-lg font-bold text-purple-400">
            {totalOrders.toLocaleString()}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Price Levels</div>
          <div className="text-lg font-bold text-orange-400">
            {heatmapData.priceLevels.length}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-xs text-slate-500 text-center">
        Hover over bars to see detailed volume and order information • {viewMode === 'volume' ? 'Shows volume distribution' : viewMode === 'count' ? 'Shows order count distribution' : 'Shows volume heatmap'} • {priceRange === 'all' ? 'Showing all price levels' : priceRange === 'normal' ? 'Showing normal price range (±50%)' : 'Showing extreme orders only (>50% from current price)'}
      </div>
    </div>
  );
};

export default OrderBookHeatmap; 