import React from 'react';
import { motion, Variants } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Activity, DollarSign, BarChart3, Users } from 'lucide-react';

interface StatsData {
  totalOffers: number;
  volume24h: number;
  priceChange24h: number;
  activeAccounts: number;
  marketDepth: number;
  avgPrice: number;
}

const StatsCards: React.FC = () => {
  // Fetch stats data
  const { data: stats, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: async (): Promise<StatsData> => {
      try {
        const response = await fetch('http://localhost:3001/analytics/summary');
        if (!response.ok) {
          throw new Error('Failed to fetch stats');
        }
        const data = await response.json();
        
        // Calculate additional metrics from the summary data
        return {
          totalOffers: data.total_offers || 0,
          volume24h: data.total_volume || 0,
          priceChange24h: Math.random() * 10 - 5, // Mock data for now
          activeAccounts: data.unique_accounts || 0,
          marketDepth: data.total_volume * 0.1 || 0, // Mock calculation
          avgPrice: data.avg_price || 0,
        };
      } catch (error) {
        // Return mock data if API is not available
        return {
          totalOffers: 1247,
          volume24h: 156789.45,
          priceChange24h: 2.34,
          activeAccounts: 89,
          marketDepth: 15678.95,
          avgPrice: 0.5234,
        };
      }
    },
  });

  const { data: topPairs, isLoading: isLoadingTopPairs } = useQuery({
    queryKey: ['top-trading-pairs', '24h', 3],
    queryFn: async () => {
      try {
        const response = await fetch('http://localhost:3001/top-trading-pairs?window=24h&k=3');
        if (!response.ok) throw new Error('Failed to fetch top pairs');
        const data = await response.json();
        return data.pairs || [];
      } catch {
        return [];
      }
    },
  });

  const topPairsString = isLoadingTopPairs
    ? '--'
    : (topPairs && topPairs.length > 0
        ? topPairs.map(p => `${p.takerGets.currency}/${p.takerPays.currency}`).join(', ')
        : '--');

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
      color: 'text-yellow-400',
      bgGradient: 'from-yellow-500/10 to-yellow-600/10',
      borderColor: 'border-yellow-500/20',
      change: '24h',
      changeDirection: 'up' as const,
    },
    {
      title: 'Total Offers',
      value: stats?.totalOffers.toLocaleString() || '--',
      icon: BarChart3,
      color: 'text-blue-400',
      bgGradient: 'from-blue-500/10 to-blue-600/10',
      borderColor: 'border-blue-500/20',
      change: '+12.5%',
      changeDirection: 'up' as const,
    },
    {
      title: '24h Volume',
      value: stats ? `$${stats.volume24h.toLocaleString()}` : '--',
      icon: DollarSign,
      color: 'text-green-400',
      bgGradient: 'from-green-500/10 to-green-600/10',
      borderColor: 'border-green-500/20',
      change: '+8.2%',
      changeDirection: 'up' as const,
    },
    {
      title: 'Price Change',
      value: stats ? `${stats.priceChange24h > 0 ? '+' : ''}${stats.priceChange24h.toFixed(2)}%` : '--',
      icon: (stats?.priceChange24h ?? 0) >= 0 ? TrendingUp : TrendingDown,
      color: (stats?.priceChange24h ?? 0) >= 0 ? 'text-green-400' : 'text-red-400',
      bgGradient: (stats?.priceChange24h ?? 0) >= 0 ? 'from-green-500/10 to-green-600/10' : 'from-red-500/10 to-red-600/10',
      borderColor: (stats?.priceChange24h ?? 0) >= 0 ? 'border-green-500/20' : 'border-red-500/20',
      change: '24h',
      changeDirection: (stats?.priceChange24h ?? 0) >= 0 ? 'up' as const : 'down' as const,
    },
    {
      title: 'Active Accounts',
      value: stats?.activeAccounts.toString() || '--',
      icon: Users,
      color: 'text-purple-400',
      bgGradient: 'from-purple-500/10 to-purple-600/10',
      borderColor: 'border-purple-500/20',
      change: '+5.1%',
      changeDirection: 'up' as const,
    },
    {
      title: 'Market Depth',
      value: stats ? `$${stats.marketDepth.toLocaleString()}` : '--',
      icon: Activity,
      color: 'text-orange-400',
      bgGradient: 'from-orange-500/10 to-orange-600/10',
      borderColor: 'border-orange-500/20',
      change: '+3.7%',
      changeDirection: 'up' as const,
    },
    {
      title: 'Avg Price',
      value: stats ? `$${stats.avgPrice.toFixed(4)}` : '--',
      icon: TrendingUp,
      color: 'text-cyan-400',
      bgGradient: 'from-cyan-500/10 to-cyan-600/10',
      borderColor: 'border-cyan-500/20',
      change: '+1.8%',
      changeDirection: 'up' as const,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card p-4">
            <div className="loading-shimmer h-4 w-16 mb-2 rounded"></div>
            <div className="loading-shimmer h-8 w-24 mb-2 rounded"></div>
            <div className="loading-shimmer h-3 w-12 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {statsCards.map((card, index) => {
        const IconComponent = card.icon;
        
        return (
          <motion.div
            key={card.title}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover={{ 
              scale: 1.05,
              transition: { duration: 0.2 }
            }}
            className={`card card-hover p-4 bg-gradient-to-br ${card.bgGradient} border ${card.borderColor} group cursor-pointer`}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between mb-3">
              <div className={`${card.color} group-hover:scale-110 transition-transform duration-200`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div className={`text-xs font-semibold px-2 py-1 rounded-full ${
                card.changeDirection === 'up' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {card.changeDirection === 'up' ? '↗' : '↘'} {card.change}
              </div>
            </div>

            {/* Card Content */}
            <div className="space-y-1">
              <div className="text-xs text-slate-400 font-medium">
                {card.title}
              </div>
              <div className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors duration-200">
                {card.value}
              </div>
            </div>

            {/* Hover Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-blue-500/0 group-hover:from-blue-500/10 group-hover:via-purple-500/10 group-hover:to-blue-500/10 rounded-xl transition-all duration-300"></div>
          </motion.div>
        );
      })}
    </div>
  );
};

export default StatsCards; 