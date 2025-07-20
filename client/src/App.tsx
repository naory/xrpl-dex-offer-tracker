import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './App.css';

// Components
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import OfferChart from './components/OfferChart';
import OrderBook from './components/OrderBook';
import RecentOffers from './components/RecentOffers';

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
      staleTime: 2000,
    },
  },
});

function App() {
  const [selectedPair, setSelectedPair] = useState('XRP/USDC');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Simulate connection to backend
    const timer = setTimeout(() => setIsConnected(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        {/* Background Effects */}
        <div className="fixed inset-0 opacity-50" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
        
        <div className="relative z-10">
          <Header 
            selectedPair={selectedPair} 
            onPairChange={setSelectedPair}
            isConnected={isConnected}
          />
          
          <main className="container mx-auto px-4 py-6 space-y-6">
            {/* Stats Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <StatsCards />
            </motion.div>

            {/* Main Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Chart */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="lg:col-span-2"
              >
                <OfferChart selectedPair={selectedPair} />
              </motion.div>

              {/* Right Column - Order Book */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                <OrderBook selectedPair={selectedPair} />
              </motion.div>
            </div>

            {/* Recent Offers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <RecentOffers selectedPair={selectedPair} />
            </motion.div>
          </main>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;
