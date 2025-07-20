import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Clock, ArrowUpDown, ExternalLink } from 'lucide-react';

interface Offer {
  id: number;
  offer_id: string;
  account: string;
  taker_gets_currency: string;
  taker_gets_value: string;
  taker_pays_currency: string;
  taker_pays_value: string;
  price: string;
  updated_at: string;
}

interface RecentOffersProps {
  selectedPair: string;
}

const RecentOffers: React.FC<RecentOffersProps> = ({ selectedPair }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof Offer>('updated_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 10;

  // Fetch offers data
  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['recent-offers', selectedPair, currentPage],
    queryFn: async (): Promise<Offer[]> => {
      const response = await fetch(`http://localhost:3001/offers?limit=${itemsPerPage}&offset=${(currentPage - 1) * itemsPerPage}`);
      if (!response.ok) {
        throw new Error('Failed to fetch offers');
      }
      return response.json();
    },
  });

  // Sort offers
  const sortedOffers = [...offers].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc' 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }
    
    return sortDirection === 'asc' 
      ? Number(aValue) - Number(bValue)
      : Number(bValue) - Number(aValue);
  });

  const handleSort = (field: keyof Offer) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatCurrency = (currency: string) => {
    // Convert hex currency codes to human readable
    if (currency.length === 40) {
      // This is a hex-encoded currency, you'd normally decode it
      return currency.slice(0, 8) + '...';
    }
    return currency;
  };

  const SortableHeader: React.FC<{ field: keyof Offer; children: React.ReactNode }> = ({ field, children }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-300 transition-colors group"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
        {sortField === field && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`text-blue-400 ${sortDirection === 'asc' ? 'rotate-180' : ''}`}
          >
            ↓
          </motion.div>
        )}
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <div className="chart-container">
        <div className="flex items-center space-x-2 mb-6">
          <Clock className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Recent Offers</h3>
        </div>
        
        <div className="space-y-2">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="loading-shimmer h-12 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="chart-container"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Recent Offers</h3>
          <span className="text-sm text-slate-400">({offers.length} results)</span>
        </div>

        {/* Pagination */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-sm text-slate-300 px-3">
            Page {currentPage}
          </span>
          
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={offers.length < itemsPerPage}
            className="p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <SortableHeader field="updated_at">Time</SortableHeader>
              <SortableHeader field="account">Account</SortableHeader>
              <SortableHeader field="taker_gets_currency">Pair</SortableHeader>
              <SortableHeader field="price">Price</SortableHeader>
              <SortableHeader field="taker_gets_value">Amount</SortableHeader>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {sortedOffers.map((offer, index) => (
                <motion.tr
                  key={offer.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors group"
                >
                  <td className="px-4 py-4 text-sm text-slate-300">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                      <span>{formatTime(offer.updated_at)}</span>
                    </div>
                  </td>
                  
                  <td className="px-4 py-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-blue-400">
                        {formatAddress(offer.account)}
                      </span>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-3 h-3 text-slate-400 hover:text-white" />
                      </button>
                    </div>
                  </td>
                  
                  <td className="px-4 py-4 text-sm text-white font-semibold">
                    {formatCurrency(offer.taker_gets_currency)}/{formatCurrency(offer.taker_pays_currency)}
                  </td>
                  
                  <td className="px-4 py-4 text-sm">
                    <span className="font-mono text-green-400 font-semibold">
                      ${parseFloat(offer.price).toFixed(4)}
                    </span>
                  </td>
                  
                  <td className="px-4 py-4 text-sm text-slate-300">
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {parseFloat(offer.taker_gets_value).toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400">
                        {formatCurrency(offer.taker_gets_currency)}
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-4 py-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        Active
                      </span>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-700/50">
        <div className="text-sm text-slate-400">
          Showing {offers.length} of many offers
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Live updates</span>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Refresh Data
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default RecentOffers; 