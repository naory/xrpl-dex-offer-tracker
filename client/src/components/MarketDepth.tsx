import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Typography, Box, Skeleton, Chip } from '@mui/material';
import { chartCanvasSx, tooltipBoxSx } from '../styles/sx';
import SectionCard from './common/SectionCard';

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
    const allPrices = [...bids, ...asks].map(p => p.price).filter(p => p > 0);
    const priceRange = {
      min: allPrices.length > 0 ? Math.min(...allPrices) : 0,
      max: allPrices.length > 0 ? Math.max(...allPrices) : 0
    };

    return { bids, asks, priceRange };
  }, [orderBook, calculateDisplayPrice]);

  // Canvas drawing function
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !depthData.bids.length || !depthData.asks.length) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 30, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
    ctx.fillRect(0, 0, width, height);

    // Calculate scales
    const allVolumes = [...depthData.bids, ...depthData.asks].map(d => d.cumulativeVolume);
    const maxVolume = Math.max(...allVolumes);
    const { min: minPrice, max: maxPrice } = depthData.priceRange;

    const xScale = (price: number) => padding.left + ((price - minPrice) / (maxPrice - minPrice)) * chartWidth;
    const yScale = (volume: number) => padding.top + chartHeight - (volume / maxVolume) * chartHeight;

    // Draw grid
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const yPos = padding.top + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding.left, yPos);
      ctx.lineTo(padding.left + chartWidth, yPos);
      ctx.stroke();
    }

    // Draw bid area
    if (depthData.bids.length > 0) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(xScale(depthData.bids[0].price), yScale(0));
      depthData.bids.forEach(point => {
        ctx.lineTo(xScale(point.price), yScale(point.cumulativeVolume));
      });
      ctx.lineTo(xScale(depthData.bids[depthData.bids.length - 1].price), yScale(0));
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      depthData.bids.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(xScale(point.price), yScale(point.cumulativeVolume));
        } else {
          ctx.lineTo(xScale(point.price), yScale(point.cumulativeVolume));
        }
      });
      ctx.stroke();
    }

    // Draw ask area
    if (depthData.asks.length > 0) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.moveTo(xScale(depthData.asks[0].price), yScale(0));
      depthData.asks.forEach(point => {
        ctx.lineTo(xScale(point.price), yScale(point.cumulativeVolume));
      });
      ctx.lineTo(xScale(depthData.asks[depthData.asks.length - 1].price), yScale(0));
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      depthData.asks.forEach((point, i) => {
        if (i === 0) {
          ctx.moveTo(xScale(point.price), yScale(point.cumulativeVolume));
        } else {
          ctx.lineTo(xScale(point.price), yScale(point.cumulativeVolume));
        }
      });
      ctx.stroke();
    }

    // Draw mid price line
    const bestBid = depthData.bids[0]?.price || 0;
    const bestAsk = depthData.asks[0]?.price || 0;
    if (bestBid && bestAsk) {
      const midPrice = (bestBid + bestAsk) / 2;
      const midX = xScale(midPrice);
      
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(midX, padding.top);
      ctx.lineTo(midX, padding.top + chartHeight);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw axes labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    
    // X-axis (price) labels
    for (let i = 0; i <= 4; i++) {
      const price = minPrice + (i / 4) * (maxPrice - minPrice);
      const x = xScale(price);
      ctx.fillText(price.toFixed(6), x, height - 10);
    }

    // Y-axis (volume) labels
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
      const volume = (i / 4) * maxVolume;
      const yPos = yScale(volume);
      ctx.fillText(volume.toFixed(0), padding.left - 10, yPos + 4);
    }

  }, [depthData]);

  // Mouse move handler
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;

    // Find closest point
    let closestPoint = null;
    let minDistance = Infinity;

    [...depthData.bids, ...depthData.asks].forEach(point => {
      const pointX = ((point.price - depthData.priceRange.min) / (depthData.priceRange.max - depthData.priceRange.min)) * (rect.width - 90) + 60;
      const distance = Math.abs(x - pointX);
      
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

  // Draw chart when data changes
  useEffect(() => {
    drawChart();
  }, [drawChart]);

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
      <SectionCard title="Market Depth" subheader={`(${selectedPair})`}>
        <Skeleton variant="rectangular" height={400} />
      </SectionCard>
    );
  }

  const bestBid = depthData.bids[0]?.price || 0;
  const bestAsk = depthData.asks[0]?.price || 0;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const midPrice = bestAsk && bestBid ? (bestBid + bestAsk) / 2 : 0;

  return (
    <SectionCard
      title="Market Depth"
      subheader={`(${selectedPair})`}
      action={
        <Box display="flex" gap={1}>
          <Chip label="Bids" size="small" sx={{ color: '#10b981', borderColor: '#10b981' }} variant="outlined" />
          <Chip label="Asks" size="small" sx={{ color: '#ef4444', borderColor: '#ef4444' }} variant="outlined" />
          <Chip label="Mid Price" size="small" color="info" variant="outlined" />
        </Box>
      }
    >
        <Box position="relative">
          <Box component="canvas" ref={canvasRef as any} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} sx={chartCanvasSx} />
          {hoveredPoint && (
            <Box position="absolute" top={20} right={20} sx={tooltipBoxSx}>
              <div>Price: {hoveredPoint.price.toFixed(6)} {priceCurrency}</div>
              <div>Volume: {hoveredPoint.cumulativeVolume.toFixed(2)} {volumeCurrency}</div>
              <div>Type: <span style={{ color: hoveredPoint.type === 'bid' ? '#10b981' : '#ef4444' }}>{hoveredPoint.type.toUpperCase()}</span></div>
            </Box>
          )}
        </Box>
        <Box display="grid" gridTemplateColumns="repeat(4,1fr)" gap={2} mt={2}>
          <Box>
            <Typography variant="caption" color="text.secondary">Best Bid</Typography>
            <Typography variant="body2" color="success.main">{bestBid.toFixed(6)} {priceCurrency}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Best Ask</Typography>
            <Typography variant="body2" color="error.main">{bestAsk.toFixed(6)} {priceCurrency}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Spread</Typography>
            <Typography variant="body2">{spread.toFixed(6)} {priceCurrency}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Mid Price</Typography>
            <Typography variant="body2" color="info.main">{midPrice.toFixed(6)} {priceCurrency}</Typography>
          </Box>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" textAlign="center" mt={2}>
          Hover over the chart to see detailed price and volume information
        </Typography>
    </SectionCard>
  );
};

export default MarketDepth; 