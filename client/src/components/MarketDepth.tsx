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

interface MarketDepthProps {
  selectedPair: string;
}

interface DepthPoint {
  price: number;
  cumulativeVolume: number;
  type: 'bid' | 'ask';
}

const MarketDepth: React.FC<MarketDepthProps> = ({ selectedPair }) => {
  const [orderBook, setOrderBook] = useState<OrderBookData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<DepthPoint | null>(null);
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

  // Process order data for depth chart
  const depthData = useMemo(() => {
    if (!orderBook) return { bids: [], asks: [], priceRange: { min: 0, max: 0 } };

    const processOrders = (orders: OrderBookEntry[], type: 'bid' | 'ask') => {
      if (!orders?.length) return [];
      
      // Filter extreme values and take top 20 for better visualization
      const filtered = orders
        .filter(order => {
          const price = parseFloat(order.price);
          return price > 0 && price < 1000000;
        })
        .slice(0, 20);

      let cumulativeVolume = 0;
      const depthPoints: DepthPoint[] = [];

      filtered.forEach(order => {
        cumulativeVolume += parseFloat(order.amount);
        const displayPrice = calculateDisplayPrice({ ...order, type });
        depthPoints.push({
          price: displayPrice,
          cumulativeVolume,
          type
        });
      });

      return depthPoints;
    };

    const bids = processOrders(orderBook.bids, 'bid');
    const asks = processOrders(orderBook.asks, 'ask');

    // Calculate price range
    const allPrices = [...bids.map(b => b.price), ...asks.map(a => a.price)];
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const pricePadding = (maxPrice - minPrice) * 0.1;

    return {
      bids,
      asks,
      priceRange: {
        min: Math.max(0, minPrice - pricePadding),
        max: maxPrice + pricePadding
      }
    };
  }, [orderBook, calculateDisplayPrice]);

  // Draw the depth chart
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !depthData.bids.length || !depthData.asks.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    const { bids, asks, priceRange } = depthData;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Calculate scales
    const maxVolume = Math.max(
      ...bids.map(b => b.cumulativeVolume),
      ...asks.map(a => a.cumulativeVolume)
    );

    const priceToX = (price: number) => {
      return ((price - priceRange.min) / (priceRange.max - priceRange.min)) * width;
    };

    const volumeToY = (volume: number) => {
      return height - (volume / maxVolume) * height;
    };

    // Draw grid lines
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
    ctx.lineWidth = 1;
    
    // Vertical grid lines (price)
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines (volume)
    for (let i = 0; i <= 5; i++) {
      const y = (height / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw depth curves
    const drawCurve = (points: DepthPoint[], color: string, fill: boolean = false) => {
      if (points.length < 2) return;

      ctx.strokeStyle = color;
      ctx.fillStyle = color + '20'; // Add transparency for fill
      ctx.lineWidth = 2;

      ctx.beginPath();
      
      // Start from left edge
      ctx.moveTo(0, height);
      
      // Draw curve through points
      points.forEach((point, index) => {
        const x = priceToX(point.price);
        const y = volumeToY(point.cumulativeVolume);
        
        if (index === 0) {
          ctx.lineTo(x, y);
        } else {
          // Smooth curve
          const prevPoint = points[index - 1];
          const prevX = priceToX(prevPoint.price);
          const prevY = volumeToY(prevPoint.cumulativeVolume);
          const cp1x = prevX + (x - prevX) * 0.5;
          const cp1y = prevY;
          const cp2x = x - (x - prevX) * 0.5;
          const cp2y = y;
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y);
        }
      });

      // Complete the shape for fill
      if (fill) {
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      }
      
      ctx.stroke();
    };

    // Draw bid curve (green)
    drawCurve(bids, '#10b981', true);
    
    // Draw ask curve (red)
    drawCurve(asks, '#ef4444', true);

    // Draw mid-price line
    if (bids.length > 0 && asks.length > 0) {
      const midPrice = (bids[0].price + asks[0].price) / 2;
      const midX = priceToX(midPrice);
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(midX, 0);
      ctx.lineTo(midX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw hover point
    if (hoveredPoint) {
      const x = priceToX(hoveredPoint.price);
      const y = volumeToY(hoveredPoint.cumulativeVolume);
      
      ctx.fillStyle = hoveredPoint.type === 'bid' ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw tooltip
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(x + 10, y - 30, 120, 50);
      
      ctx.fillStyle = 'white';
      ctx.font = '12px Arial';
      ctx.fillText(`Price: ${hoveredPoint.price.toFixed(6)}`, x + 15, y - 15);
      ctx.fillText(`Volume: ${hoveredPoint.cumulativeVolume.toFixed(0)}`, x + 15, y);
    }
  }, [depthData, hoveredPoint]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = 400;
        drawChart();
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawChart]);

  // Handle mouse events
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !depthData.bids.length || !depthData.asks.length) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const { width, height } = canvas;
    const { priceRange } = depthData;

    const priceToX = (price: number) => {
      return ((price - priceRange.min) / (priceRange.max - priceRange.min)) * width;
    };

    const xToPrice = (x: number) => {
      return priceRange.min + (x / width) * (priceRange.max - priceRange.min);
    };

    const maxVolume = Math.max(
      ...depthData.bids.map(b => b.cumulativeVolume),
      ...depthData.asks.map(a => a.cumulativeVolume)
    );

    const volumeToY = (volume: number) => {
      return height - (volume / maxVolume) * height;
    };

    const yToVolume = (y: number) => {
      return ((height - y) / height) * maxVolume;
    };

    const hoveredPrice = xToPrice(x);
    const hoveredVolume = yToVolume(y);

    // Find closest point
    const allPoints = [...depthData.bids, ...depthData.asks];
    let closestPoint: DepthPoint | null = null;
    let minDistance = Infinity;

    allPoints.forEach(point => {
      const pointX = priceToX(point.price);
      const pointY = volumeToY(point.cumulativeVolume);
      const distance = Math.sqrt((x - pointX) ** 2 + (y - pointY) ** 2);
      
      if (distance < minDistance && distance < 20) {
        minDistance = distance;
        closestPoint = point;
      }
    });

    setHoveredPoint(closestPoint);
  }, [depthData]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
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

  if (isLoading || !depthData.bids.length || !depthData.asks.length) {
    return (
      <div className="chart-container">
        <div className="flex items-center space-x-2 mb-4">
          <span className="text-blue-400">📊</span>
          <h3 className="text-xl font-semibold text-white">Market Depth</h3>
          <span className="text-sm text-slate-400">({selectedPair})</span>
        </div>
        <div className="flex items-center justify-center h-96">
          <div className="text-slate-400">Loading depth chart...</div>
        </div>
      </div>
    );
  }

  const bestBid = depthData.bids[0]?.price || 0;
  const bestAsk = depthData.asks[0]?.price || 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const midPrice = bestAsk && bestBid ? (bestBid + bestAsk) / 2 : 0;

  return (
    <div className="chart-container">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <span className="text-blue-400">📊</span>
          <h3 className="text-xl font-semibold text-white">Market Depth</h3>
          <span className="text-sm text-slate-400">({selectedPair})</span>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-sm" style={{ background: 'rgba(30, 41, 59, 0.6)', borderRadius: '8px', padding: '8px 12px', border: '1px solid rgba(71, 85, 105, 0.2)' }}>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded shadow-sm"></div>
            <span className="text-green-400 font-medium">Bids</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded shadow-sm"></div>
            <span className="text-red-400 font-medium">Asks</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded shadow-sm" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, #3b82f6 2px, #3b82f6 4px)' }}></div>
            <span className="text-blue-400 font-medium">Mid Price</span>
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-slate-700/50">
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Best Bid</div>
          <div className="text-lg font-bold text-green-400">
            {bestBid.toFixed(6)} {priceCurrency}
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Best Ask</div>
          <div className="text-lg font-bold text-red-400">
            {bestAsk.toFixed(6)} {priceCurrency}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Spread</div>
          <div className="text-lg font-bold text-slate-300">
            {spread.toFixed(6)} {priceCurrency}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs text-slate-400 mb-1">Mid Price</div>
          <div className="text-lg font-bold text-blue-400">
            {midPrice.toFixed(6)} {priceCurrency}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-4 text-xs text-slate-500 text-center">
        Hover over the chart to see detailed price and volume information
      </div>
    </div>
  );
};

export default MarketDepth; 