import React from 'react';
import { motion, Variants } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Users } from 'lucide-react';
import { Card, CardContent, Typography, Chip, Skeleton, Box } from '@mui/material';

interface TradingPair {
  volume: number;
  count: number;
  lastPrice: number | null;
  priceHistory: Array<{ price: number; timestamp: number }>;
  takerGets: { currency: string };
  takerPays: { currency: string };
  isXRPPair: boolean;
  bidCount: number;
  askCount: number;
}

const StatsCards: React.FC = () => {
  const { data: topPairsResponse, isLoading } = useQuery({
    queryKey: ['top-trading-pairs', '24h', 20],
    queryFn: async () => {
      const response = await fetch('http://localhost:3001/top-trading-pairs?window=24h&k=20');
      if (!response.ok) throw new Error('Failed to fetch top pairs');
      return response.json();
    },
    refetchInterval: 10000,
  });

  // Extract pairs array - handles both raw array and {pairs: [...]} response shapes
  // (shared React Query cache with TopTradingPairs returns the full response object)
  const topPairs: TradingPair[] = Array.isArray(topPairsResponse)
    ? topPairsResponse
    : Array.isArray(topPairsResponse?.pairs)
      ? topPairsResponse.pairs
      : [];

  // Derive stats from trading pairs data
  const totalVolume = topPairs.reduce((sum, p) => sum + p.volume, 0);
  const totalTrades = topPairs.reduce((sum, p) => sum + p.count, 0);
  const activePairs = topPairs.length;
  const uniqueAccounts = topPairs.reduce((sum, p) => sum + p.bidCount + p.askCount, 0);

  // Calculate price change from top pair's price history
  const topPair = topPairs[0];
  const priceChange = (() => {
    if (!topPair?.priceHistory || topPair.priceHistory.length < 2) return null;
    const first = topPair.priceHistory[0].price;
    const last = topPair.priceHistory[topPair.priceHistory.length - 1].price;
    return first > 0 ? ((last - first) / first) * 100 : null;
  })();

  const topPairsString = topPairs && topPairs.length > 0
    ? topPairs.slice(0, 3).map(p => `${p.takerGets.currency}/${p.takerPays.currency}`).join(', ')
    : '--';

  const formatVolume = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.5,
        type: "spring",
        stiffness: 100,
      },
    },
  };

  const statsCards = [
    {
      title: 'Top Pairs (24h)',
      value: topPairsString,
      icon: BarChart3,
      chip: `${activePairs} pairs`,
    },
    {
      title: 'Total Trades (24h)',
      value: totalTrades > 0 ? totalTrades.toLocaleString() : '--',
      icon: BarChart3,
      chip: '24h',
    },
    {
      title: '24h Volume',
      value: totalVolume > 0 ? formatVolume(totalVolume) : '--',
      icon: DollarSign,
      chip: '24h',
    },
    {
      title: 'Top Pair Change',
      value: priceChange !== null ? `${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%` : '--',
      icon: priceChange !== null && priceChange >= 0 ? TrendingUp : TrendingDown,
      chip: topPair ? `${topPair.takerGets.currency}/${topPair.takerPays.currency}` : '24h',
      direction: priceChange !== null ? (priceChange >= 0 ? 'up' : 'down') : 'up',
    },
    {
      title: 'Bid+Ask Count',
      value: uniqueAccounts > 0 ? uniqueAccounts.toLocaleString() : '--',
      icon: Users,
      chip: '24h',
    },
    {
      title: 'Active Pairs',
      value: activePairs > 0 ? activePairs.toString() : '--',
      icon: Activity,
      chip: '24h',
    },
    {
      title: 'Top Pair Price',
      value: topPair?.lastPrice != null && Number.isFinite(topPair.lastPrice)
        ? topPair.lastPrice.toFixed(6)
        : '--',
      icon: TrendingUp,
      chip: topPair ? `${topPair.takerGets.currency}/${topPair.takerPays.currency}` : '--',
    },
  ];

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
            xl: 'repeat(6, 1fr)',
          },
        }}
      >
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent>
              <Skeleton variant="text" width={80} height={20} sx={{ mb: 1 }} />
              <Skeleton variant="text" width={120} height={32} sx={{ mb: 1 }} />
              <Skeleton variant="text" width={60} height={16} />
            </CardContent>
          </Card>
        ))}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 2,
        gridTemplateColumns: {
          xs: '1fr',
          md: 'repeat(2, 1fr)',
          lg: 'repeat(3, 1fr)',
          xl: 'repeat(6, 1fr)',
        },
      }}
    >
      {statsCards.map((card) => {
        const IconComponent = card.icon;
        const dir = (card as any).direction;
        const up = dir !== 'down';
        return (
          <motion.div
            key={card.title}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ scale: 1.02 }}
          >
            <Card sx={{ position: 'relative', overflow: 'hidden' }}>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={1.5}>
                  <Box sx={{ color: 'text.secondary' }}>
                    <IconComponent size={18} />
                  </Box>
                  <Chip
                    size="small"
                    label={card.chip}
                    color={dir ? (up ? 'success' : 'error') : 'default'}
                    variant="outlined"
                  />
                </Box>
                <Typography variant="caption" color="text.secondary">{card.title}</Typography>
                <Typography variant="h6" component="div">{card.value}</Typography>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </Box>
  );
};

export default StatsCards;
