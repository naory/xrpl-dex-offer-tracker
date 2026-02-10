import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline, Container, Box, Divider } from '@mui/material';
import theme from './theme';
import { motion } from 'framer-motion';
import Header from './components/Header';
import { useAppStore } from './store/useAppStore';
import StatsCards from './components/StatsCards';
import TopTradingPairs from './components/TopTradingPairs';
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
  const selectedPair = useAppStore((s) => s.selectedPair);
  const setSelectedPair = useAppStore((s) => s.setSelectedPair);
  const isConnected = useAppStore((s) => s.isConnected);
  const setIsConnected = useAppStore((s) => s.setIsConnected);

  // Check backend and XRPL WebSocket connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const response = await fetch('http://localhost:3001/health');
        if (response.ok) {
          const healthData = await response.json();
          // Consider connection "live" only if both API and XRPL WebSocket are working
          const isFullyConnected = healthData.status === 'ok' && 
                                  healthData.checks?.xrplWebSocket?.status === 'ok' &&
                                  healthData.checks?.database?.status === 'ok';
          setIsConnected(isFullyConnected);
        } else {
          setIsConnected(false);
        }
      } catch (error) {
        console.warn('Health check failed, falling back to basic API check:', error);
        // Fallback to basic API check if health endpoint is not available
        try {
          const response = await fetch('http://localhost:3001/offers?limit=1');
          setIsConnected(response.ok);
        } catch (fallbackError) {
          setIsConnected(false);
        }
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [setIsConnected]);

  const handlePairChange = (pair: string) => {
    setSelectedPair(pair);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #111827 50%, #0f172a 100%)',
          }}
        >
          <Header selectedPair={selectedPair} onPairChange={handlePairChange} isConnected={isConnected} />
          <Container maxWidth="lg" sx={{ py: 3 }}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <StatsCards />
            </motion.div>

            <Box sx={{ mt: 3 }}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
                <TopTradingPairs />
              </motion.div>
            </Box>

            <Box
              sx={{
                mt: 3,
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' },
                alignItems: 'start',
              }}
            >
              <Box sx={{ display: 'grid', gap: 2 }}>
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.2 }}>
                  <OrderBook selectedPair={selectedPair} />
                </motion.div>
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.4 }}>
                  <MarketDepth selectedPair={selectedPair} />
                </motion.div>
              </Box>
              <Box sx={{ display: 'grid', gap: 2 }}>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
                  <OfferChart selectedPair={selectedPair} />
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, delay: 0.5 }}>
                  <RecentOffers selectedPair={selectedPair} />
                </motion.div>
              </Box>
            </Box>

            <motion.footer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.8 }}>
              <Divider sx={{ my: 3 }} />
              <Box sx={{ textAlign: 'center', color: 'text.secondary', fontSize: 14, py: 2 }}>
                <Box>XRPL DEX Offer Tracker - Real-time XRPL trading data</Box>
                <Box sx={{ mt: 0.5 }}>
                  {isConnected ? (
                    <Box component="span" sx={{ color: 'success.main' }}>🟢 Connected to XRPL</Box>
                  ) : (
                    <Box component="span" sx={{ color: 'error.main' }}>🔴 Connection lost</Box>
                  )}
                </Box>
              </Box>
            </motion.footer>
          </Container>
        </Box>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
