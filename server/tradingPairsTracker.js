const { EventEmitter } = require('events');

// Helper to convert XRPL hex currency code to ISO 3-letter code
function hexToIsoCurrency(hex) {
  if (!hex || hex === 'XRP') return 'XRP';
  if (hex.length === 3) return hex; // Already ISO
  try {
    const buf = Buffer.from(hex, 'hex');
    const ascii = buf.toString('ascii').replace(/\0+$/, '');
    // Allow letters, numbers, and some special characters, length 3-20
    if (/^[A-Za-z0-9]{3,20}$/.test(ascii)) return ascii;
    return hex;
  } catch (error) {
    return hex;
  }
}

class TradingPairsTracker extends EventEmitter {
  constructor() {
    super();

    // Time windows in milliseconds
    this.TIME_WINDOWS = {
      '10m': 10 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };

    // Storage for trading data by time window
    this.tradingData = {
      '10m': new Map(),
      '1h': new Map(),
      '24h': new Map()
    };

    // Configuration
    this.TOP_K = 20;
    this.cleanupIntervals = {};

    // Start cleanup processes
    this.startCleanupProcesses();
  }

  /**
   * Generate a unique key for a trading pair
   */
  getPairKey(takerGets, takerPays) {
    if (!takerGets || !takerPays) {
      throw new Error('Invalid takerGets or takerPays');
    }

    if (!takerGets.currency || !takerPays.currency) {
      throw new Error('Missing currency in takerGets or takerPays');
    }

    const normalizeCurrency = (currency) => {
      if (currency === 'XRP') return 'XRP';
      // Convert hex currency codes to human readable strings
      return hexToIsoCurrency(currency).toUpperCase();
    };

    const gets = {
      currency: normalizeCurrency(takerGets.currency),
      issuer: takerGets.issuer || null
    };

    const pays = {
      currency: normalizeCurrency(takerPays.currency),
      issuer: takerPays.issuer || null
    };

    // Create a consistent key regardless of order
    const pair1 = JSON.stringify([gets, pays]);
    const pair2 = JSON.stringify([pays, gets]);

    // Use the lexicographically smaller key for consistency
    return pair1 < pair2 ? pair1 : pair2;
  }

  /**
   * Record a trading activity for a pair
   */
  recordTrade(takerGets, takerPays, volume, timestamp = Date.now()) {
    try {
      // Validate inputs
      if (!takerGets || !takerPays) return;
      if (!takerGets.currency || !takerPays.currency) return;

      // Convert hex currency codes to human readable strings before storing
      const normalizedTakerGets = {
        currency: hexToIsoCurrency(takerGets.currency),
        issuer: takerGets.issuer,
        value: takerGets.value
      };

      const normalizedTakerPays = {
        currency: hexToIsoCurrency(takerPays.currency),
        issuer: takerPays.issuer,
        value: takerPays.value
      };

      if (!normalizedTakerGets || !normalizedTakerPays) return;

      const pairKey = this.getPairKey(normalizedTakerGets, normalizedTakerPays);

      // Determine if this is an XRP pair and whether it's a bid or ask
      const isXRPPair = normalizedTakerGets.currency === 'XRP' || normalizedTakerPays.currency === 'XRP';
      const isBid = normalizedTakerPays.currency === 'XRP'; // Buying XRP (offering other currency for XRP)
      const isAsk = normalizedTakerGets.currency === 'XRP'; // Selling XRP (offering XRP for other currency)

      // Calculate price (always in XRP terms for XRP pairs)
      let price = null;
      if (isXRPPair) {
        if (isBid) {
          price = parseFloat(takerPays.value) / parseFloat(takerGets.value);
        } else if (isAsk) {
          price = parseFloat(takerGets.value) / parseFloat(takerPays.value);
        }
      }

      // Update each time window
      Object.keys(this.TIME_WINDOWS).forEach(window => {
        try {
          const cutoffTime = timestamp - this.TIME_WINDOWS[window];

          if (!this.tradingData[window].has(pairKey)) {
            this.tradingData[window].set(pairKey, {
              takerGets: normalizedTakerGets,
              takerPays: normalizedTakerPays,
              volume: 0,
              count: 0,
              lastUpdate: timestamp,
              isXRPPair,
              bidVolume: 0,
              askVolume: 0,
              bidCount: 0,
              askCount: 0,
              lastPrice: null,
              priceHistory: [],
            });
          }

          const data = this.tradingData[window].get(pairKey);
          data.volume += volume;
          data.count += 1;
          data.lastUpdate = timestamp;

          // Update XRP-specific data
          if (isXRPPair) {
            if (isBid) {
              data.bidVolume += volume;
              data.bidCount += 1;
            } else if (isAsk) {
              data.askVolume += volume;
              data.askCount += 1;
            }

            // Update price and price history
            if (price !== null) {
              data.lastPrice = price;
              data.priceHistory.push({ price, timestamp });

              // Keep only recent price history (last 100 entries)
              if (data.priceHistory.length > 100) {
                data.priceHistory = data.priceHistory.slice(-100);
              }
            }
          }

          // Clean old entries for this window
          if (data.lastUpdate < cutoffTime) {
            this.tradingData[window].delete(pairKey);
          }
        } catch (windowError) {
          console.error(`[TRADING_TRACKER] Error processing window ${window}:`, windowError.message);
        }
      });

      // Emit event for real-time updates
      this.emit('tradeRecorded', {
        pairKey,
        takerGets,
        takerPays,
        volume,
        timestamp,
        isXRPPair,
        isBid,
        isAsk,
        price
      });

    } catch (error) {
      console.error(`[TRADING_TRACKER] Error in recordTrade:`, error.message);
    }
  }

  /**
   * Get top-k trading pairs for a specific time window
   */
  getTopKPairs(window = '24h', k = null) {
    if (!this.tradingData[window]) {
      throw new Error(`Invalid time window: ${window}. Valid windows: ${Object.keys(this.TIME_WINDOWS).join(', ')}`);
    }

    const limit = k || this.TOP_K;
    const cutoffTime = Date.now() - this.TIME_WINDOWS[window];

    // Filter out old entries and sort by volume
    const validPairs = Array.from(this.tradingData[window].entries())
      .filter(([_, data]) => data.lastUpdate >= cutoffTime)
      .map(([pairKey, data]) => ({
        pairKey,
        ...data,
        volume: parseFloat(data.volume),
        count: parseInt(data.count)
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);

    return validPairs;
  }

  /**
   * Get top-k XRP trading pairs with bid/ask breakdown
   */
  getTopKXRPPairs(window = '24h', k = null) {
    if (!this.tradingData[window]) {
      throw new Error(`Invalid time window: ${window}. Valid windows: ${Object.keys(this.TIME_WINDOWS).join(', ')}`);
    }

    const limit = k || this.TOP_K;
    const cutoffTime = Date.now() - this.TIME_WINDOWS[window];

    // Filter for XRP pairs only and calculate price changes
    const validPairs = Array.from(this.tradingData[window].entries())
      .filter(([_, data]) => data.lastUpdate >= cutoffTime && data.isXRPPair)
      .map(([pairKey, data]) => {
        // Calculate price change percentage
        let priceChange = 0;
        if (data.priceHistory.length >= 2) {
          const oldPrice = data.priceHistory[0].price;
          const newPrice = data.lastPrice;
          priceChange = ((newPrice - oldPrice) / oldPrice) * 100;
        }

        // Determine price trend
        let trend = 'neutral';
        if (priceChange > 0.1) trend = 'up';
        else if (priceChange < -0.1) trend = 'down';

        // Calculate activity heat (based on volume and order count)
        const activityScore = (data.volume / 1000000) + (data.count / 10);
        let heatLevel = 1;
        if (activityScore > 100) heatLevel = 5;
        else if (activityScore > 50) heatLevel = 4;
        else if (activityScore > 20) heatLevel = 3;
        else if (activityScore > 5) heatLevel = 2;

        return {
          pairKey,
          ...data,
          volume: parseFloat(data.volume),
          count: parseInt(data.count),
          bidVolume: parseFloat(data.bidVolume),
          askVolume: parseFloat(data.askVolume),
          bidCount: parseInt(data.bidCount),
          askCount: parseInt(data.askCount),
          priceChange: parseFloat(priceChange.toFixed(2)),
          trend,
          heatLevel,
          lastPrice: data.lastPrice ? parseFloat(data.lastPrice) : null
        };
      })
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);

    return validPairs;
  }

  /**
   * Get trading statistics for all time windows
   */
  getAllStats(k = null) {
    const stats = {};

    Object.keys(this.TIME_WINDOWS).forEach(window => {
      stats[window] = {
        pairs: this.getTopKPairs(window, k),
        totalPairs: this.tradingData[window].size,
        windowMs: this.TIME_WINDOWS[window]
      };
    });

    return stats;
  }

  /**
   * Get detailed stats for a specific pair
   */
  getPairStats(takerGets, takerPays) {
    const pairKey = this.getPairKey(takerGets, takerPays);
    const stats = {};

    Object.keys(this.TIME_WINDOWS).forEach(window => {
      const data = this.tradingData[window].get(pairKey);
      if (data) {
        const cutoffTime = Date.now() - this.TIME_WINDOWS[window];
        if (data.lastUpdate >= cutoffTime) {
          stats[window] = {
            volume: parseFloat(data.volume),
            count: parseInt(data.count),
            lastUpdate: data.lastUpdate,
            rank: this.getPairRank(pairKey, window)
          };
        }
      }
    });

    return stats;
  }

  /**
   * Get the rank of a specific pair in a time window
   */
  getPairRank(pairKey, window) {
    const pairs = this.getTopKPairs(window);
    const index = pairs.findIndex(pair => pair.pairKey === pairKey);
    return index >= 0 ? index + 1 : null;
  }

  /**
   * Clean up old entries for a specific time window
   */
  cleanupWindow(window) {
    const cutoffTime = Date.now() - this.TIME_WINDOWS[window];
    const initialSize = this.tradingData[window].size;

    for (const [pairKey, data] of this.tradingData[window].entries()) {
      if (data.lastUpdate < cutoffTime) {
        this.tradingData[window].delete(pairKey);
      }
    }

    const finalSize = this.tradingData[window].size;
    if (initialSize !== finalSize) {
      console.log(`[TRADING_TRACKER] Cleaned up ${initialSize - finalSize} old entries from ${window} window`);
    }
  }

  /**
   * Start cleanup processes for all time windows
   */
  startCleanupProcesses() {
    // Clean up 10m window every 2 minutes
    this.cleanupIntervals['10m'] = setInterval(() => {
      this.cleanupWindow('10m');
    }, 2 * 60 * 1000);

    // Clean up 1h window every 10 minutes
    this.cleanupIntervals['1h'] = setInterval(() => {
      this.cleanupWindow('1h');
    }, 10 * 60 * 1000);

    // Clean up 24h window every hour
    this.cleanupIntervals['24h'] = setInterval(() => {
      this.cleanupWindow('24h');
    }, 60 * 60 * 1000);
  }

  /**
   * Stop all cleanup processes
   */
  stop() {
    Object.values(this.cleanupIntervals).forEach(interval => {
      clearInterval(interval);
    });
    this.cleanupIntervals = {};
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats() {
    const stats = {};

    Object.keys(this.tradingData).forEach(window => {
      stats[window] = {
        entries: this.tradingData[window].size,
        memoryUsage: this.estimateMemoryUsage(window)
      };
    });

    return stats;
  }

  /**
   * Estimate memory usage for a time window
   */
  estimateMemoryUsage(window) {
    const map = this.tradingData[window];
    let totalSize = 0;

    for (const [key, value] of map.entries()) {
      totalSize += key.length;
      totalSize += JSON.stringify(value).length;
    }

    return totalSize;
  }
}

module.exports = TradingPairsTracker;
