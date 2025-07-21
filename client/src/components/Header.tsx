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
      style={{
        background: 'rgba(30, 41, 59, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Logo and Brand */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #9333ea 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Zap style={{ width: '24px', height: '24px', color: 'white' }} />
          </div>
          <div>
            <h1 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #60a5fa 0%, #a855f7 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              margin: 0
            }}>
              XRPL DEX
            </h1>
            <p style={{ 
              fontSize: '11px', 
              color: '#94a3b8', 
              margin: 0 
            }}>
              Offer Tracker
            </p>
          </div>
        </motion.div>

        {/* Trading Pair Selector & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Trading Pair Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '500' }}>
              Pair:
            </span>
            <div className="btn-group">
              {tradingPairs.slice(0, 3).map((pair) => (
                <button
                  key={pair}
                  onClick={() => onPairChange(pair)}
                  className={`btn-toggle btn-toggle-sm ${selectedPair === pair ? 'active' : ''}`}
                >
                  {pair}
                </button>
              ))}
            </div>
          </div>

          {/* Connection Status */}
          <motion.div
            animate={isConnected ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(51, 65, 85, 0.4)',
              border: '1px solid rgba(71, 85, 105, 0.3)',
              borderRadius: '8px',
              padding: '6px 12px'
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? '#10b981' : '#ef4444',
              boxShadow: isConnected 
                ? '0 0 8px rgba(16, 185, 129, 0.5)' 
                : '0 0 8px rgba(239, 68, 68, 0.5)'
            }}></div>
            <span style={{ 
              fontSize: '12px', 
              color: '#e2e8f0',
              fontWeight: '500'
            }}>
              {isConnected ? 'Live' : 'Connecting...'}
            </span>
          </motion.div>

          {/* Action Buttons */}
          <div className="btn-group">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-toggle btn-toggle-sm"
              title="Notifications"
            >
              <Bell style={{ width: '14px', height: '14px' }} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-toggle btn-toggle-sm"
              title="Settings"
            >
              <Settings style={{ width: '14px', height: '14px' }} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-toggle btn-toggle-sm"
              title="Profile"
            >
              <User style={{ width: '14px', height: '14px' }} />
            </motion.button>
          </div>
        </div>
      </div>
    </motion.header>
  );
};

export default Header; 