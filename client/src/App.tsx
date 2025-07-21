import React, { useState, useEffect } from 'react';
import './App.css';
// import OrderBook from './components/OrderBook';
// import RecentOffers from './components/RecentOffers';

interface XRPPair {
  rank: number;
  pair: string;
  otherCurrency: string;
  otherIssuer: string;
  totalVolume: number;
  totalCount: number;
  bidVolume: number;
  askVolume: number;
  bidCount: number;
  askCount: number;
  bidPercentage: number;
  askPercentage: number;
  lastPrice: number | null;
  priceChange: number | null;
  trend: 'up' | 'down' | 'neutral';
  heatLevel: number;
  lastUpdate: number;
}

// Simple inline OrderBook component to avoid import issues
const SimpleOrderBook: React.FC<{ selectedPair: string }> = ({ selectedPair }) => {
  const [offers, setOffers] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await fetch('http://localhost:3001/offers?limit=20');
        if (response.ok) {
          const data = await response.json();
          setOffers(data.slice(0, 10));
        }
      } catch (error) {
        console.error('Error fetching offers:', error);
      }
    };

    fetchOffers();
    const interval = setInterval(fetchOffers, 5000);
    return () => clearInterval(interval);
  }, [selectedPair]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-400">Order Book for {selectedPair}</div>
      {offers.length > 0 ? (
        <div className="space-y-2">
          {offers.map((offer, index) => (
            <div key={offer.id} className="flex justify-between text-sm p-2 bg-slate-800/30 rounded">
              <span className="text-green-400 font-mono">
                {parseFloat(offer.taker_gets_value).toFixed(4)} {offer.taker_gets_currency}
              </span>
              <span className="text-slate-300 font-mono">
                {parseFloat(offer.price).toFixed(6)}
              </span>
              <span className="text-red-400 font-mono">
                {parseFloat(offer.taker_pays_value).toFixed(4)} {offer.taker_pays_currency}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-slate-400 py-8">Loading offers...</div>
      )}
    </div>
  );
};

// Simple inline RecentOffers component
const SimpleRecentOffers: React.FC<{ selectedPair: string }> = ({ selectedPair }) => {
  const [offers, setOffers] = useState<any[]>([]);
  
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        const response = await fetch('http://localhost:3001/offers?limit=10');
        if (response.ok) {
          const data = await response.json();
          setOffers(data);
        }
      } catch (error) {
        console.error('Error fetching recent offers:', error);
      }
    };

    fetchOffers();
    const interval = setInterval(fetchOffers, 5000);
    return () => clearInterval(interval);
  }, [selectedPair]);

  return (
    <div className="space-y-2">
      {offers.length > 0 ? (
        offers.map((offer, index) => (
          <div key={offer.id} className="text-xs p-2 bg-slate-800/30 rounded space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Account:</span>
              <span className="text-blue-400 font-mono">{offer.account.slice(0, 10)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Pair:</span>
              <span className="text-white">{offer.taker_gets_currency}/{offer.taker_pays_currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Price:</span>
              <span className="text-green-400 font-mono">{parseFloat(offer.price).toFixed(6)}</span>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center text-slate-400 py-4">Loading recent offers...</div>
      )}
    </div>
  );
};

function App() {
  const [selectedPair, setSelectedPair] = useState<string>('XRP/USDC');
  const [availablePairs, setAvailablePairs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  
  // Flashy trader's view state
  const [xrpPairs, setXrpPairs] = useState<XRPPair[]>([]);
  const [timeWindow, setTimeWindow] = useState<'24h' | '1h' | '10m'>('24h');
  const [animateBars, setAnimateBars] = useState(false);
  const [priceToggle, setPriceToggle] = useState<'xrp' | 'token'>('xrp');

  useEffect(() => {
    // Simulate connection to backend
    const timer = setTimeout(() => setIsConnected(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Fetch available trading pairs from the backend
  useEffect(() => {
    const fetchTradingPairs = async () => {
      try {
        const response = await fetch('http://localhost:3001/trading-pairs');
        if (response.ok) {
          const data = await response.json();
          setAvailablePairs(data.pairs);
          
          // Set default pair if current selection is not in the list
          if (data.pairs.length > 0 && !data.pairs.includes(selectedPair)) {
            setSelectedPair(data.pairs[0]);
          }
        } else {
          console.error('Failed to fetch trading pairs:', response.status);
          // Use fallback pairs
          const fallbackPairs = ['XRP/USDC', 'XRP/RLUSD', 'XRP/USD', 'XRP/EUR', 'XRP/BTC', 'USDC/USD'];
          setAvailablePairs(fallbackPairs);
        }
      } catch (error) {
        console.error('Error fetching trading pairs:', error);
        // Use fallback pairs
        const fallbackPairs = ['XRP/USDC', 'XRP/RLUSD', 'XRP/USD', 'XRP/EUR', 'XRP/BTC', 'USDC/USD'];
        setAvailablePairs(fallbackPairs);
      }
    };

    fetchTradingPairs();
  }, [selectedPair]);

  // Fetch XRP trading pairs for flashy trader view
  useEffect(() => {
    const fetchXRPPairs = async () => {
      try {
        const response = await fetch(`http://localhost:3001/xrp-pairs/flashy?window=${timeWindow}&k=20`);
        if (response.ok) {
          const data = await response.json();
          setXrpPairs(data.pairs || []);
          // Trigger bar animations after data loads
          setTimeout(() => setAnimateBars(true), 100);
        }
      } catch (error) {
        console.error('Error fetching XRP pairs:', error);
        // Mock data for development
        setXrpPairs([
          {
            rank: 1,
            pair: 'USDC/XRP',
            otherCurrency: 'USDC',
            otherIssuer: 'rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE',
            totalVolume: 1500000,
            totalCount: 45,
            bidVolume: 900000,
            askVolume: 600000,
            bidCount: 25,
            askCount: 20,
            bidPercentage: 60,
            askPercentage: 40,
            lastPrice: 0.52,
            priceChange: 2.5,
            trend: 'up',
            heatLevel: 5,
            lastUpdate: Date.now()
          },
          {
            rank: 2,
            pair: 'RLUSD/XRP',
            otherCurrency: 'RLUSD',
            otherIssuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
            totalVolume: 850000,
            totalCount: 32,
            bidVolume: 600000,
            askVolume: 250000,
            bidCount: 20,
            askCount: 12,
            bidPercentage: 70.6,
            askPercentage: 29.4,
            lastPrice: 2.34,
            priceChange: -1.2,
            trend: 'down',
            heatLevel: 3,
            lastUpdate: Date.now()
          }
        ]);
        setTimeout(() => setAnimateBars(true), 100);
      }
    };

    fetchXRPPairs();
    const interval = setInterval(fetchXRPPairs, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [timeWindow]);

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toFixed(0);
  };

  const formatPrice = (price: number | null, otherCurrency: string) => {
    if (!price) return 'N/A';
    if (priceToggle === 'xrp') {
      return `${price.toFixed(6)} XRP`;
    } else {
      return `${(1/price).toFixed(6)} ${otherCurrency}`;
    }
  };

  const getTrendEmoji = (trend: string) => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      default: return '➡️';
    }
  };

  const getHeatEmojis = (heatLevel: number) => {
    return '🔥'.repeat(heatLevel);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Trading floor grid background */}
      <div className="fixed inset-0" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='0.02'%3E%3Cpath d='M20 20v20h20v-20z'/%3E%3C/g%3E%3C/svg%3E")`,
        opacity: 0.3
      }}></div>
      
      <div className="relative z-10">
        {/* Trader's Header */}
        <header className="bg-slate-900/90 backdrop-blur-sm border-b border-purple-500/30 sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-green-400 to-purple-500 flex items-center justify-center text-2xl">
                  ⚡
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-purple-500 bg-clip-text text-transparent">
                    XRPL TRADER
                  </h1>
                  <p className="text-sm text-slate-400 font-mono">Real-time DEX Analytics</p>
                </div>
              </div>

              <div className="flex items-center space-x-6">
                {/* Time Window Selector */}
                <div className="flex bg-slate-800 rounded-lg p-1">
                  {(['24h', '1h', '10m'] as const).map((window) => (
                    <button
                      key={window}
                      onClick={() => setTimeWindow(window)}
                      className={`px-4 py-2 rounded text-sm font-medium transition-all ${
                        timeWindow === window
                          ? 'bg-purple-600 text-white shadow-lg'
                          : 'text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      {window.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Price Toggle */}
                <div className="flex bg-slate-800 rounded-lg p-1">
                  <button
                    onClick={() => setPriceToggle(priceToggle === 'xrp' ? 'token' : 'xrp')}
                    className="px-4 py-2 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    Price in {priceToggle === 'xrp' ? 'XRP' : 'TOKEN'}
                  </button>
                </div>

                {/* Connection Status */}
                <div className="flex items-center space-x-2 bg-slate-800/80 px-4 py-2 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${
                    isConnected 
                      ? 'bg-green-400 shadow-lg shadow-green-400/50 animate-pulse' 
                      : 'bg-red-400 shadow-lg shadow-red-400/50'
                  }`}></div>
                  <span className="text-sm text-slate-300 font-mono">
                    {isConnected ? 'LIVE FEED' : 'CONNECTING...'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-6">
          {/* Flashy Trader's XRP Pairs Dashboard */}
          <div className="bg-gradient-to-br from-slate-900/95 to-purple-900/95 backdrop-blur-sm rounded-2xl border border-purple-500/30 p-6 mb-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-transparent bg-gradient-to-r from-green-400 via-purple-500 to-pink-500 bg-clip-text flex items-center">
                🚀 XRP TRADING FLOOR
                <span className="ml-3 text-sm text-slate-400 font-mono">({timeWindow} window)</span>
              </h2>
              <div className="text-sm text-slate-400 font-mono">
                {xrpPairs.length} Active Pairs | Last Update: {new Date().toLocaleTimeString()}
              </div>
            </div>
            
            {/* Compact Trading Table */}
            <div className="bg-slate-800/30 rounded-xl overflow-hidden">
              <div className="overflow-y-auto max-h-[75vh] scrollbar-thin scrollbar-thumb-purple-600 scrollbar-track-slate-800">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-900/90 backdrop-blur text-xs text-slate-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-3 text-left font-mono">#</th>
                      <th className="px-3 py-3 text-left font-mono">Pair</th>
                      <th className="px-3 py-3 text-right font-mono">XRP Volume</th>
                      <th className="px-3 py-3 text-center font-mono">Orders</th>
                      <th className="px-3 py-3 text-center font-mono">Bid/Ask Split</th>
                      <th className="px-3 py-3 text-right font-mono">Last Price</th>
                      <th className="px-3 py-3 text-center font-mono">Trend</th>
                      <th className="px-3 py-3 text-center font-mono">Heat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {xrpPairs.map((pair, index) => (
                      <tr 
                        key={`${pair.pair}-${pair.rank}`}
                        className={`border-b border-slate-700/30 hover:bg-slate-700/20 transition-colors ${
                          pair.heatLevel > 3 ? 'bg-purple-900/20' : ''
                        }`}
                      >
                        {/* Rank */}
                        <td className="px-3 py-2">
                          <div className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                            pair.rank <= 3 
                              ? 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-black' 
                              : 'bg-slate-700 text-white'
                          }`}>
                            {pair.rank}
                          </div>
                        </td>

                        {/* Pair Name */}
                        <td className="px-3 py-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white font-mono text-base">{pair.pair}</span>
                            {pair.heatLevel >= 4 && (
                              <span className="text-xs">🔥</span>
                            )}
                          </div>
                        </td>

                        {/* XRP Volume */}
                        <td className="px-3 py-2 text-right">
                          <div className="font-mono text-purple-400 font-bold">
                            {formatVolume(pair.totalVolume)}
                          </div>
                          <div className="text-xs text-slate-500">XRP</div>
                        </td>

                        {/* Orders Count */}
                        <td className="px-3 py-2 text-center">
                          <div className="font-mono text-slate-300">{pair.totalCount}</div>
                          <div className="text-xs text-slate-500">orders</div>
                        </td>

                        {/* Bid/Ask Split with Mini Bars */}
                        <td className="px-3 py-2">
                          <div className="space-y-1">
                            {/* Bid Bar */}
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-green-400 w-8">BID</span>
                              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-green-500 transition-all duration-1000 ease-out"
                                  style={{ width: animateBars ? `${pair.bidPercentage}%` : '0%' }}
                                />
                              </div>
                              <span className="text-xs text-green-400 w-10 text-right font-mono">
                                {pair.bidPercentage.toFixed(0)}%
                              </span>
                            </div>
                            {/* Ask Bar */}
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-red-400 w-8">ASK</span>
                              <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-red-500 transition-all duration-1000 ease-out"
                                  style={{ width: animateBars ? `${pair.askPercentage}%` : '0%' }}
                                />
                              </div>
                              <span className="text-xs text-red-400 w-10 text-right font-mono">
                                {pair.askPercentage.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Last Price */}
                        <td className="px-3 py-2 text-right">
                          <div className="font-mono text-white">
                            {formatPrice(pair.lastPrice, pair.otherCurrency)}
                          </div>
                        </td>

                        {/* Trend */}
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <span className="text-lg">{getTrendEmoji(pair.trend)}</span>
                            {pair.priceChange !== null && (
                              <span className={`text-xs font-mono ${
                                pair.priceChange > 0 ? 'text-green-400' : pair.priceChange < 0 ? 'text-red-400' : 'text-slate-400'
                              }`}>
                                {pair.priceChange > 0 ? '+' : ''}{pair.priceChange.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Heat Level */}
                        <td className="px-3 py-2 text-center">
                          <div className="flex justify-center">
                            {Array.from({ length: 5 }, (_, i) => (
                              <span 
                                key={i} 
                                className={`text-xs ${
                                  i < pair.heatLevel ? 'text-orange-500' : 'text-slate-600'
                                }`}
                              >
                                🔥
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {xrpPairs.length === 0 && (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">⚡</div>
                <div className="text-xl text-slate-300 mb-2">Loading Trading Floor...</div>
                <div className="text-sm text-slate-400">Connecting to XRPL live data</div>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="text-center text-slate-400 text-sm">
            <p>🚀 XRPL DEX Offer Tracker - Real-time XRP Trading Analytics</p>
            <p className="mt-1">Backend: {isConnected ? '✅ Connected' : '⏳ Connecting...'} | Updates every 10 seconds</p>
          </div>

          {/* Traditional Order Book Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white flex items-center">
                  📊 Order Book
                </h3>
                <select
                  value={selectedPair}
                  onChange={(e) => setSelectedPair(e.target.value)}
                  className="bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-600 focus:border-purple-500 font-mono"
                >
                  {availablePairs.length > 0 ? (
                    availablePairs.map(pair => (
                      <option key={pair} value={pair}>{pair}</option>
                    ))
                  ) : (
                    <option value={selectedPair}>{selectedPair}</option>
                  )}
                </select>
              </div>
              <SimpleOrderBook selectedPair={selectedPair} />
            </div>

            <div className="bg-slate-900/90 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                📈 Recent Offers
              </h3>
              <SimpleRecentOffers selectedPair={selectedPair} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
