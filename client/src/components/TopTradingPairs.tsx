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
            <BarChart3 className="icon" style={{ color: '#60a5fa' }} />
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
          <BarChart3 className="icon" style={{ color: '#60a5fa' }} />
          <h3>Top Trading Pairs</h3>
          <span>
            ({topPairs?.pairs?.length || 0} pairs, {selectedWindow})
          </span>
        </div>

        {/* Controls */}
        <div className="trading-pairs-controls">
          {/* Time Window Selector */}
          <div className="control-group">
            {['10m', '1h', '24h'].map((window) => (
              <button
                key={window}
                onClick={() => setSelectedWindow(window as any)}
                className={`control-button ${selectedWindow === window ? 'active' : ''}`}
              >
                {window}
              </button>
            ))}
          </div>

          {/* Count Selector */}
          <div className="control-group">
            {[10, 20, 50].map((count) => (
              <button
                key={count}
                onClick={() => setShowCount(count)}
                className={`control-button ${showCount === count ? 'active purple' : ''}`}
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
        <div className="table-header">
          <div>Pair</div>
          <div style={{ textAlign: 'right' }}>Price</div>
          <div style={{ textAlign: 'right' }}>24h Change</div>
          <div style={{ textAlign: 'right' }}>Volume</div>
          <div style={{ textAlign: 'right' }}>Trades</div>
          <div style={{ textAlign: 'right' }}>Bid/Ask</div>
          <div style={{ textAlign: 'right' }}>Last Trade</div>
        </div>

        {/* Table Rows */}
        <div className="table-rows">
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
                <div className="pair-info">
                  <div className="pair-rank">
                    {index + 1}
                  </div>
                  <div className="pair-details">
                    <h4>{formatPairName(pair)}</h4>
                    {pair.isXRPPair && <div className="xrp-badge">XRP</div>}
                  </div>
                </div>

                {/* Price */}
                <div className="price-cell">
                  ${pair.lastPrice.toFixed(6)}
                </div>

                {/* 24h Change */}
                <div className={`change-cell ${isPositive ? 'change-positive' : 'change-negative'}`}>
                  {isPositive ? <TrendingUp className="icon-small" /> : <TrendingDown className="icon-small" />}
                  <span>
                    {isPositive ? '+' : ''}{priceChange.percentage.toFixed(2)}%
                  </span>
                </div>

                {/* Volume */}
                <div className="volume-cell">
                  <div className="main-value">{formatVolume(pair.volume)}</div>
                  <div className="sub-value">vol</div>
                </div>

                {/* Trades */}
                <div className="trades-cell">
                  <div className="main-value">{pair.count}</div>
                  <div className="sub-value">trades</div>
                </div>

                {/* Bid/Ask Ratio */}
                <div className="bidask-cell">
                  <div className="bidask-values">
                    <span className="bid-value">{formatVolume(pair.bidVolume)}</span>
                    <span style={{ color: '#64748b', margin: '0 4px' }}>/</span>
                    <span className="ask-value">{formatVolume(pair.askVolume)}</span>
                  </div>
                  <div className="bidask-ratio">
                    {bidAskRatio.toFixed(1)}:1
                  </div>
                </div>

                {/* Last Trade */}
                <div className="lastrade-cell">
                  <div className="lastrade-time">
                    {formatTime(pair.lastUpdate)}
                  </div>
                  <div className="lastrade-status">
                    <Activity className="icon-small" />
                    <span>live</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer */}
      {topPairs?.pairs && (
        <div className="trading-pairs-summary">
          <div className="summary-item">
            <div className="label">Total Volume</div>
            <div className="value">
              {formatVolume(topPairs.pairs.reduce((sum, pair) => sum + pair.volume, 0))}
            </div>
          </div>
          <div className="summary-item">
            <div className="label">Total Trades</div>
            <div className="value">
              {topPairs.pairs.reduce((sum, pair) => sum + pair.count, 0).toLocaleString()}
            </div>
          </div>
          <div className="summary-item">
            <div className="label">XRP Pairs</div>
            <div className="value orange">
              {topPairs.pairs.filter(pair => pair.isXRPPair).length}
            </div>
          </div>
          <div className="summary-item">
            <div className="label">Last Update</div>
            <div className="value blue">
              {formatTime(topPairs.timestamp)}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default TopTradingPairs; 