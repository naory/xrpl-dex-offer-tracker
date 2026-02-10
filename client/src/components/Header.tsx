import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Settings, Bell, User, X, Server, Wifi, ChevronDown } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Typography, IconButton, Button, Menu, MenuItem, Box, Paper } from '@mui/material';
import { popupPaperSx, statusRowSx, labelCaptionSx, valueCaptionSx } from '../styles/sx';

interface HeaderProps {
  selectedPair: string;
  onPairChange: (pair: string) => void;
  isConnected: boolean;
}

// Types centralized in store; local copies removed

const Header: React.FC<HeaderProps> = ({ selectedPair, onPairChange, isConnected }) => {
  const showConnectionPopup = useAppStore((s) => s.showConnectionPopup);
  const setShowConnectionPopup = useAppStore((s) => s.setShowConnectionPopup);
  const rippledStatus = useAppStore((s) => s.rippledStatus);
  const loadingStatus = useAppStore((s) => s.loadingStatus);
  const trackedPairs = useAppStore((s) => s.trackedPairs);
  const loadingPairs = useAppStore((s) => s.loadingPairs);
  const fetchTrackedPairs = useAppStore((s) => s.fetchTrackedPairs);
  const fetchRippledStatus = useAppStore((s) => s.fetchRippledStatus);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  useEffect(() => {
    fetchTrackedPairs();
  }, [fetchTrackedPairs]);

  useEffect(() => {
    if (showConnectionPopup) {
      fetchRippledStatus();
      const interval = setInterval(fetchRippledStatus, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [showConnectionPopup, fetchRippledStatus]);

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
      <Box sx={{ maxWidth: 1200, mx: 'auto', px: 3, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Logo and Brand */}
        <Box display="flex" alignItems="center" gap={1.5}>
          <Paper elevation={0} sx={{ width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #3b82f6 0%, #9333ea 100%)' }}>
            <Zap style={{ width: 24, height: 24, color: 'white' }} />
          </Paper>
          <Box>
            <Typography variant="h6" sx={{ m: 0, background: 'linear-gradient(135deg, #60a5fa 0%, #a855f7 100%)', backgroundClip: 'text', WebkitBackgroundClip: 'text', color: 'transparent' }}>XRPL DEX</Typography>
            <Typography variant="caption" color="text.secondary">Offer Tracker</Typography>
          </Box>
        </Box>

        {/* Trading Pair Selector & Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Trading Pair Selector */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={500}>Pair:</Typography>
            <Box>
              <Button
                variant="outlined"
                color="info"
                size="small"
                endIcon={<ChevronDown size={16} />}
                onClick={(e) => setAnchorEl(e.currentTarget)}
              >
                {loadingPairs ? 'Loading...' : (selectedPair || 'Select Pair')}
              </Button>
              <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={() => setAnchorEl(null)}
                PaperProps={{ sx: { maxHeight: 320 } }}
              >
                {trackedPairs.map((pair) => (
                  <MenuItem
                    key={pair.value}
                    selected={selectedPair === pair.value}
                    onClick={() => {
                      onPairChange(pair.value);
                      setAnchorEl(null);
                    }}
                  >
                    {pair.label}
                  </MenuItem>
                ))}
              </Menu>
            </Box>
          </Box>

          {/* Connection Status */}
          <Button variant="contained" color={isConnected ? 'success' : 'error'} size="small" onClick={() => setShowConnectionPopup(!showConnectionPopup)}>
            {isConnected ? 'Live' : 'Connecting...'}
          </Button>

          {/* Action Buttons */}
          <Box display="flex" gap={1}>
            <IconButton size="small" color="default" title="Notifications"><Bell style={{ width: 18, height: 18 }} /></IconButton>
            <IconButton size="small" color="default" title="Settings"><Settings style={{ width: 18, height: 18 }} /></IconButton>
            <IconButton size="small" color="default" title="Profile"><User style={{ width: 18, height: 18 }} /></IconButton>
          </Box>
        </Box>

        {/* Connection Status Popup */}
        <AnimatePresence>
          {showConnectionPopup && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ position: 'absolute', top: '100%', right: 24, zIndex: 100 }}
            >
              <Paper sx={popupPaperSx}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Server style={{ width: 16, height: 16, color: '#60a5fa' }} />
                    <Typography variant="subtitle2" sx={{ color: '#e2e8f0' }}>Connection Status</Typography>
                  </Box>
                  <IconButton size="small" onClick={() => setShowConnectionPopup(false)} sx={{ color: '#94a3b8' }}>
                    <X style={{ width: 14, height: 14 }} />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  <Box sx={statusRowSx}>
                    <Typography variant="caption" sx={labelCaptionSx}>Mainnet Ledger:</Typography>
                    <Typography variant="caption" sx={valueCaptionSx}>
                      {!rippledStatus ? 'Loading...' : rippledStatus.mainnetLedger ? rippledStatus.mainnetLedger.toLocaleString() : 'Unknown'}
                    </Typography>
                  </Box>

                  <Box sx={statusRowSx}>
                    <Typography variant="caption" sx={labelCaptionSx}>Connection:</Typography>
                    <Typography variant="caption" fontWeight={500} sx={{ color: !rippledStatus ? 'text.secondary' : rippledStatus.connected ? 'success.main' : 'error.main' }}>
                      {!rippledStatus ? 'Loading...' : rippledStatus.connected ? 'Connected' : 'Disconnected'}
                    </Typography>
                  </Box>

                  <Box sx={statusRowSx}>
                    <Typography variant="caption" sx={labelCaptionSx}>Server State:</Typography>
                    <Typography variant="caption" fontWeight={500} sx={{ color: !rippledStatus ? 'text.secondary' : rippledStatus.serverState === 'connected' ? 'success.main' : rippledStatus.serverState === 'full' ? 'info.main' : 'warning.main' }}>
                      {!rippledStatus ? 'Loading...' : rippledStatus.serverState || 'Unknown'}
                    </Typography>
                  </Box>

                  {rippledStatus && rippledStatus.connectionIssue && (
                    <Box sx={statusRowSx}>
                      <Typography variant="caption" sx={labelCaptionSx}>Issue:</Typography>
                      <Typography variant="caption" fontWeight={500} sx={{ color: rippledStatus.connectionIssue === 'rate_limited' ? 'error.main' : rippledStatus.connectionIssue === 'websocket_error' ? 'warning.main' : rippledStatus.connectionIssue === 'disconnected' ? 'warning.main' : 'text.secondary' }}>
                        {rippledStatus.connectionIssue === 'rate_limited' ? 'Rate Limited' : rippledStatus.connectionIssue === 'websocket_error' ? 'WebSocket Error' : rippledStatus.connectionIssue === 'disconnected' ? 'Disconnected' : rippledStatus.connectionIssue}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={statusRowSx}>
                    <Typography variant="caption" sx={labelCaptionSx}>Rate Limit:</Typography>
                    <Typography variant="caption" fontWeight={500} sx={{ color: !rippledStatus ? 'text.secondary' : rippledStatus.rateLimitStatus === 'rate_limited' ? 'error.main' : 'success.main' }}>
                      {!rippledStatus ? 'Loading...' : rippledStatus.rateLimitStatus === 'rate_limited' ? 'Limited' : 'Normal'}
                    </Typography>
                  </Box>

                  <Box sx={statusRowSx}>
                    <Typography variant="caption" sx={labelCaptionSx}>Recent Activity:</Typography>
                    <Typography variant="caption" fontWeight={500} sx={{ color: !rippledStatus ? 'text.secondary' : rippledStatus.hasRecentActivity ? 'success.main' : 'warning.main' }}>
                      {!rippledStatus ? 'Loading...' : rippledStatus.hasRecentActivity ? 'Active' : 'Inactive'}
                    </Typography>
                  </Box>

                  <Box sx={statusRowSx}>
                    <Typography variant="caption" sx={labelCaptionSx}>Peer Count:</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Wifi style={{ width: 12, height: 12, color: '#60a5fa' }} />
                      <Typography variant="caption" sx={valueCaptionSx}>
                        {!rippledStatus ? 0 : rippledStatus.peers || 0}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={statusRowSx}>
                    <Typography variant="caption" sx={labelCaptionSx}>Validated Ledger:</Typography>
                    <Typography variant="caption" sx={valueCaptionSx}>
                      {!rippledStatus ? 'None' : rippledStatus.validatedLedger ? rippledStatus.validatedLedger.toLocaleString() : 'None'}
                    </Typography>
                  </Box>
                </Box>

                {rippledStatus && rippledStatus.error && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5, p: 1, background: 'rgba(239,68,68,0.1)', borderRadius: 1, border: '1px solid rgba(239,68,68,0.2)' }}>
                    <Typography variant="caption" sx={{ color: 'error.main' }}>⚠️ {rippledStatus.error}</Typography>
                  </Box>
                )}

                {loadingStatus && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1.5, p: 1, background: 'rgba(59,130,246,0.1)', borderRadius: 1 }}>
                    <Box sx={{ width: 12, height: 12, border: '2px solid rgba(59,130,246,0.3)', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <Typography variant="caption" sx={{ color: 'info.main' }}>Updating...</Typography>
                  </Box>
                )}
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </motion.header>
  );
};

export default Header; 