import React from 'react';
import { motion } from 'framer-motion';
import { Zap, Settings, Bell, User } from 'lucide-react';

interface HeaderProps {
  selectedPair: string;
  onPairChange: (pair: string) => void;
  isConnected: boolean;
}

const Header: React.FC<HeaderProps> = ({ selectedPair, onPairChange, isConnected }) => {
  const tradingPairs = [
    'XRP/USDC',
    'XRP/USD',
    'XRP/EUR',
    'XRP/BTC',
    'USDC/USD',
  ];

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-800/50 backdrop-blur-lg border-b border-slate-700/50 sticky top-0 z-50"
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Brand */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="flex items-center space-x-3"
          >
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                XRPL DEX
              </h1>
              <p className="text-xs text-slate-400">Offer Tracker</p>
            </div>
          </motion.div>

          {/* Trading Pair Selector */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-400">Pair:</span>
              <select
                value={selectedPair}
                onChange={(e) => onPairChange(e.target.value)}
                className="bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {tradingPairs.map((pair) => (
                  <option key={pair} value={pair} className="bg-slate-800">
                    {pair}
                  </option>
                ))}
              </select>
            </div>

            {/* Connection Status */}
            <motion.div
              animate={isConnected ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex items-center space-x-2 bg-slate-700/30 rounded-lg px-3 py-2"
            >
              <div className={`w-2 h-2 rounded-full ${
                isConnected 
                  ? 'bg-green-400 shadow-[0_0_10px_rgba(34,197,94,0.5)]' 
                  : 'bg-red-400 animate-pulse'
              }`}></div>
              <span className="text-sm text-slate-300">
                {isConnected ? 'Live' : 'Connecting...'}
              </span>
            </motion.div>

            {/* Action Buttons */}
            <div className="flex items-center space-x-2">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all"
              >
                <Bell className="w-4 h-4" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all"
              >
                <Settings className="w-4 h-4" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all"
              >
                <User className="w-4 h-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default Header; 