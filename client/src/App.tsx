import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import OrderBook from './components/OrderBook';
import MarketDepth from './components/MarketDepth';
import OfferChart from './components/OfferChart';
import RecentOffers from './components/RecentOffers';
import './App.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000, // 30 seconds
    },
  },
});

function App() {
  const [selectedPair, setSelectedPair] = useState('XRP/USDC');
  const [isConnected, setIsConnected] = useState(false);

  // Simulate connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('http://localhost:3001/offers?limit=1');
        setIsConnected(response.ok);
      } catch (error) {
        setIsConnected(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const handlePairChange = (pair: string) => {
    setSelectedPair(pair);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <div className="App min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Header 
          selectedPair={selectedPair}
          onPairChange={handlePairChange}
          isConnected={isConnected}
        />
        
        <main className="container mx-auto px-4 py-6 space-y-6">
          {/* Stats Cards Section - Includes Top-k Trades Panel */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <StatsCards />
          </motion.div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <OrderBook selectedPair={selectedPair} />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <MarketDepth selectedPair={selectedPair} />
              </motion.div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <OfferChart selectedPair={selectedPair} />
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <RecentOffers selectedPair={selectedPair} />
              </motion.div>
            </div>
          </div>

          {/* Footer */}
          <motion.footer
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="text-center py-6 text-slate-400 text-sm border-t border-slate-700/50"
          >
            <p>XRPL DEX Offer Tracker - Real-time XRPL trading data</p>
            <p className="mt-1">
              {isConnected ? (
                <span className="text-green-400">🟢 Connected to XRPL</span>
              ) : (
                <span className="text-red-400">🔴 Connection lost</span>
              )}
            </p>
          </motion.footer>
        </main>
      </div>
    </QueryClientProvider>
  );
}

export default App;
