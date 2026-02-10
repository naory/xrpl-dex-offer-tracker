import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import SectionCard from './common/SectionCard';
import { ToggleButtonGroup, ToggleButton, Typography, Box, Skeleton } from '@mui/material';

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
  lastPrice: number | null;
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

  const formatMaybeNumber = (value: unknown, digits = 2, fallback = '--') => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value.toFixed(digits);
    }
    return fallback;
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
      <SectionCard title="Top Trading Pairs">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={64} sx={{ mb: 1 }} />
        ))}
      </SectionCard>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
      <SectionCard
        title="Top Trading Pairs"
        subheader={`(${topPairs?.pairs?.length || 0} pairs, ${selectedWindow})`}
        action={
          <Box display="flex" gap={2}>
            <ToggleButtonGroup size="small" exclusive value={selectedWindow} onChange={(_, v) => v && setSelectedWindow(v)}>
              <ToggleButton value="10m">10m</ToggleButton>
              <ToggleButton value="1h">1h</ToggleButton>
              <ToggleButton value="24h">24h</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup size="small" exclusive value={showCount} onChange={(_, v) => v && setShowCount(v)}>
              <ToggleButton value={10}>10</ToggleButton>
              <ToggleButton value={20}>20</ToggleButton>
              <ToggleButton value={50}>50</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        }
      >
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 2, fontSize: 12, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
            <Box>Pair</Box>
            <Box textAlign="right">Price</Box>
            <Box textAlign="right">24h Change</Box>
            <Box textAlign="right">Volume</Box>
            <Box textAlign="right">Trades</Box>
            <Box textAlign="right">Bid/Ask</Box>
            <Box textAlign="right">Last Trade</Box>
          </Box>
          {topPairs?.pairs?.map((pair, index) => {
            const priceChange = calculatePriceChange(pair.priceHistory);
            const isPositive = priceChange.percentage >= 0;
            const bidAskRatio = pair.askVolume > 0 ? pair.bidVolume / pair.askVolume : 0;
            return (
            <Box key={pair.pairKey} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1fr', gap: 2, alignItems: 'center', py: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box display="flex" alignItems="center" gap={1.5}>
                  <Box sx={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(45deg, #3b82f6, #9333ea)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{index + 1}</Box>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{formatPairName(pair)}</Typography>
                    {pair.isXRPPair && <Typography variant="caption" color="warning.main">XRP</Typography>}
                  </Box>
                </Box>
              <Typography variant="body2" textAlign="right">{formatMaybeNumber(pair.lastPrice, 6)}</Typography>
                <Typography variant="body2" textAlign="right" color={isPositive ? 'success.main' : 'error.main'}>
                  {isPositive ? '+' : ''}{formatMaybeNumber(priceChange.percentage, 2, '--')}%
                </Typography>
                <Box textAlign="right">
                <Typography variant="body2">{formatVolume(Number.isFinite(pair.volume) ? pair.volume : 0)}</Typography>
                  <Typography variant="caption" color="text.secondary">{pair.takerGets.currency}</Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="body2">{pair.count}</Typography>
                  <Typography variant="caption" color="text.secondary">{pair.bidCount}B/{pair.askCount}A</Typography>
                </Box>
                <Box textAlign="right">
                <Typography variant="body2">{formatVolume(Number.isFinite(pair.bidVolume) ? pair.bidVolume : 0)} / {formatVolume(Number.isFinite(pair.askVolume) ? pair.askVolume : 0)}</Typography>
                  <Typography variant="caption" color="text.secondary">{bidAskRatio.toFixed(2)}</Typography>
                </Box>
                <Box textAlign="right">
                  <Typography variant="body2">{formatTime(pair.lastUpdate)}</Typography>
                  <Box display="flex" alignItems="center" justifyContent="flex-end" gap={0.5} color="text.secondary">
                    <Activity size={12} />
                    <Typography variant="caption">Live</Typography>
                  </Box>
                </Box>
              </Box>
            );
          })}
          <Box display="grid" gridTemplateColumns="repeat(4,1fr)" gap={2} mt={3} pt={2} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Total Pairs</Typography>
              <Typography variant="body2">{topPairs?.pairs?.length || 0}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">XRP Pairs</Typography>
              <Typography variant="body2" color="warning.main">{topPairs?.pairs?.filter(p => p.isXRPPair).length || 0}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Total Volume</Typography>
              <Typography variant="body2" color="info.main">{formatVolume(topPairs?.pairs?.reduce((sum, pair) => sum + pair.volume, 0) || 0)}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Active Trades</Typography>
              <Typography variant="body2">{topPairs?.pairs?.reduce((sum, pair) => sum + pair.count, 0) || 0}</Typography>
            </Box>
          </Box>
      </SectionCard>
    </motion.div>
  );
};

export default TopTradingPairs; 