import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';

interface TradingPair {
  pairKey: string;
  takerGets: {
    currency: string;
    issuer: string | null;
    value: number;
  };
  takerPays: {
    currency: string;
    issuer: string | null;
    value: number;
  };
  volume: number;
  count: number;
  lastUpdate: number;
  isXRPPair: boolean;
  bidVolume: number;
  askVolume: number;
  bidCount: number;
  askCount: number;
  lastPrice: number;
  priceHistory: Array<{
    price: number;
    timestamp: number;
  }>;
}

interface TopTradingPairsData {
  window: string;
  k: number;
  pairs: TradingPair[];
  timestamp: number;
}

const TopTradingPairs: React.FC = () => {
  const [selectedWindow, setSelectedWindow] = useState<'10m' | '1h' | '24h'>('24h');
  const [showCount, setShowCount] = useState(20);

  // Fetch top trading pairs
  const { data: topPairs, isLoading } = useQuery({
    queryKey: ['top-trading-pairs', selectedWindow, showCount],
    queryFn: async (): Promise<TopTradingPairsData> => {
      const response = await fetch(`http://localhost:3001/top-trading-pairs?window=${selectedWindow}&k=${showCount}`);
      if (!response.ok) {
        throw new Error('Failed to fetch top trading pairs');
      }
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const formatCurrency = (currency: string) => {
    // Handle common currency display names
    if (currency === 'XRP') return 'XRP';
    if (currency.length > 6) return currency.slice(0, 6) + '...';
    return currency;
  };

  const formatPairName = (pair: TradingPair) => {
    const base = formatCurrency(pair.takerGets.currency);
    const quote = formatCurrency(pair.takerPays.currency);
    return `${base}/${quote}`;
  };

  const calculatePriceChange = (priceHistory: Array<{ price: number; timestamp: number }>) => {
    if (priceHistory.length < 2) return { change: 0, percentage: 0 };
    
    const firstPrice = priceHistory[0].price;
    const lastPrice = priceHistory[priceHistory.length - 1].price;
    const change = lastPrice - firstPrice;
    const percentage = firstPrice > 0 ? (change / firstPrice) * 100 : 0;
    
    return { change, percentage };
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toFixed(0);
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ago`;
    return `${minutes}m ago`;
  };

  if (isLoading) {
    return (
      <div className="trading-pairs-container">
        <div className="trading-pairs-header">
          <div className="trading-pairs-title">
            <BarChart3 style={{ width: '20px', height: '20px', color: '#60a5fa' }} />
            <h3>Top Trading Pairs</h3>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[...Array(10)].map((_, i) => (
            <div key={i} className="loading-shimmer" style={{ height: '64px', borderRadius: '8px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="trading-pairs-container"
    >
      {/* Header */}
      <div className="trading-pairs-header">
        <div className="trading-pairs-title">
          <BarChart3 style={{ width: '20px', height: '20px', color: '#60a5fa' }} />
          <h3>Top Trading Pairs</h3>
          <span>
            ({topPairs?.pairs?.length || 0} pairs, {selectedWindow})
          </span>
        </div>

        {/* Controls */}
        <div className="trading-pairs-controls">
          {/* Time Window Selector */}
          <div className="btn-group">
            {['10m', '1h', '24h'].map((window) => (
              <button
                key={window}
                onClick={() => setSelectedWindow(window as any)}
                className={`btn-toggle ${selectedWindow === window ? 'active' : ''}`}
              >
                {window}
              </button>
            ))}
          </div>

          {/* Count Selector */}
          <div className="btn-group">
            {[10, 20, 50].map((count) => (
              <button
                key={count}
                onClick={() => setShowCount(count)}
                className={`btn-toggle ${showCount === count ? 'active purple' : ''}`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="trading-pairs-table">
        {/* Table Header */}
        <div className="trading-pairs-table-header">
          <div>Pair</div>
          <div className="col-2">Price</div>
          <div className="col-3">24h Change</div>
          <div className="col-4">Volume</div>
          <div className="col-5">Trades</div>
          <div className="col-6">Bid/Ask</div>
          <div className="col-7">Last Trade</div>
        </div>

        {/* Table Rows */}
        <div className="trading-pairs-table-body">
          {topPairs?.pairs?.map((pair, index) => {
            const priceChange = calculatePriceChange(pair.priceHistory);
            const isPositive = priceChange.percentage >= 0;
            const bidAskRatio = pair.askVolume > 0 ? pair.bidVolume / pair.askVolume : 0;

            return (
              <motion.div
                key={pair.pairKey}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.02 }}
                className="trading-pair-row"
              >
                {/* Pair Name & Rank */}
                <div className="trading-pair-name">
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'linear-gradient(45deg, #3b82f6, #9333ea)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    flexShrink: 0,
                    marginRight: '12px'
                  }}>
                    {index + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', color: '#ffffff', fontSize: '14px' }}>
                      {formatPairName(pair)}
                    </div>
                    {pair.isXRPPair && (
                      <div style={{ fontSize: '12px', color: '#f59e0b' }}>XRP</div>
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="trading-pair-cell price col-2">
                  {pair.lastPrice.toFixed(6)}
                </div>

                {/* 24h Change */}
                <div className={`trading-pair-cell col-3 ${isPositive ? 'bid' : 'ask'}`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    {isPositive ? <TrendingUp style={{ width: '14px', height: '14px' }} /> : <TrendingDown style={{ width: '14px', height: '14px' }} />}
                    <span>{isPositive ? '+' : ''}{priceChange.percentage.toFixed(2)}%</span>
                  </div>
                </div>

                {/* Volume */}
                <div className="trading-pair-cell volume col-4">
                  <div>{formatVolume(pair.volume)}</div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {pair.takerGets.currency}
                  </div>
                </div>

                {/* Trades */}
                <div className="trading-pair-cell count col-5">
                  <div>{pair.count}</div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {pair.bidCount}B/{pair.askCount}A
                  </div>
                </div>

                {/* Bid/Ask */}
                <div className="trading-pair-cell col-6">
                  <div style={{ fontSize: '14px', marginBottom: '2px' }}>
                    <span className="trading-pair-cell bid">{formatVolume(pair.bidVolume)}</span>
                    {' / '}
                    <span className="trading-pair-cell ask">{formatVolume(pair.askVolume)}</span>
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {bidAskRatio.toFixed(2)}
                  </div>
                </div>

                {/* Last Trade */}
                <div className="trading-pair-cell col-7">
                  <div style={{ color: '#e2e8f0', fontSize: '14px', marginBottom: '2px' }}>
                    {formatTime(pair.lastUpdate)}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'flex-end', 
                    gap: '4px', 
                    color: '#94a3b8', 
                    fontSize: '12px' 
                  }}>
                    <Activity style={{ width: '12px', height: '12px' }} />
                    <span>Live</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="stats-grid cols-4" style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(71, 85, 105, 0.5)' }}>
        <div className="stat-item">
          <div className="stat-label">Total Pairs</div>
          <div className="stat-value">{topPairs?.pairs?.length || 0}</div>
        </div>
        <div className="stat-item">
          <div className="stat-label">XRP Pairs</div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            {topPairs?.pairs?.filter(p => p.isXRPPair).length || 0}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Total Volume</div>
          <div className="stat-value blue">
            {formatVolume(topPairs?.pairs?.reduce((sum, pair) => sum + pair.volume, 0) || 0)}
          </div>
        </div>
        <div className="stat-item">
          <div className="stat-label">Active Trades</div>
          <div className="stat-value">
            {topPairs?.pairs?.reduce((sum, pair) => sum + pair.count, 0) || 0}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TopTradingPairs; 