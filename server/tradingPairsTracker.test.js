const TradingPairsTracker = require('./tradingPairsTracker');

describe('TradingPairsTracker', () => {
  let tracker;
  beforeEach(() => {
    tracker = new TradingPairsTracker();
    jest.useFakeTimers();
  });
  afterEach(() => {
    tracker.stop();
    jest.useRealTimers();
  });

  it('records trades and returns top-k pairs', () => {
    tracker.recordTrade({currency: 'XRP'}, {currency: 'USD', issuer: 'A'}, 100);
    tracker.recordTrade({currency: 'XRP'}, {currency: 'USD', issuer: 'A'}, 50);
    tracker.recordTrade({currency: 'BTC'}, {currency: 'USD', issuer: 'A'}, 200);
    const top = tracker.getTopKPairs('24h', 2);
    expect(top.length).toBe(2);
    expect(top[0].takerGets.currency).toBe('BTC');
    expect(top[0].volume).toBe(200);
    expect(top[1].takerGets.currency).toBe('XRP');
    expect(top[1].volume).toBe(150);
  });

  it('expires trades outside the time window', () => {
    tracker.recordTrade({currency: 'XRP'}, {currency: 'USD'}, 100, Date.now());
    jest.advanceTimersByTime(11 * 60 * 1000); // 11 minutes
    tracker.cleanupWindow('10m');
    const top = tracker.getTopKPairs('10m');
    expect(top.length).toBe(0);
  });

  it('returns correct stats for a specific pair', () => {
    tracker.recordTrade({currency: 'XRP'}, {currency: 'USD'}, 100);
    tracker.recordTrade({currency: 'XRP'}, {currency: 'USD'}, 50);
    const stats = tracker.getPairStats({currency: 'XRP'}, {currency: 'USD'});
    expect(stats['24h'].volume).toBe(150);
    expect(stats['24h'].count).toBe(2);
  });

  it('returns all stats for all windows', () => {
    tracker.recordTrade({currency: 'XRP'}, {currency: 'USD'}, 100);
    const stats = tracker.getAllStats();
    expect(stats['10m'].pairs.length).toBe(1);
    expect(stats['1h'].pairs.length).toBe(1);
    expect(stats['24h'].pairs.length).toBe(1);
  });

  it('estimates memory usage', () => {
    tracker.recordTrade({currency: 'XRP'}, {currency: 'USD'}, 100);
    const mem = tracker.getMemoryStats();
    expect(mem['24h'].entries).toBe(1);
    expect(mem['10m'].entries).toBe(1);
  });
}); 