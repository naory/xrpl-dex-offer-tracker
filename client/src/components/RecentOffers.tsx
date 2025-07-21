import React, { useState, useEffect } from 'react';

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
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchOffers = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('http://localhost:3001/offers?limit=10');
        if (response.ok) {
          const data = await response.json();
          setOffers(data);
        }
      } catch (error) {
        console.error('Error fetching recent offers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOffers();
    const interval = setInterval(fetchOffers, 5000);
    return () => clearInterval(interval);
  }, [selectedPair]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="chart-container">
        <div className="component-header">
          <div className="component-title">
            <span>📈</span>
            <h3>Recent Offers</h3>
            <span className="component-subtitle">Live Feed</span>
          </div>
        </div>
        <div className="recent-offers-container">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="loading-shimmer" style={{ height: '40px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="chart-container">
      <div className="component-header">
        <div className="component-title">
          <span>📈</span>
          <h3>Recent Offers</h3>
          <span className="component-subtitle">({offers.length} offers)</span>
        </div>
      </div>
      
      {/* Table Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
        gap: '12px',
        padding: '12px 16px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
        marginBottom: '8px'
      }}>
        <div>Account</div>
        <div>Pair</div>
        <div style={{ textAlign: 'right' }}>Price</div>
        <div style={{ textAlign: 'right' }}>Amount</div>
        <div style={{ textAlign: 'right' }}>Time</div>
      </div>
      
      {offers.length > 0 ? (
        <div className="recent-offers-container">
          {offers.map((offer) => (
            <div 
              key={offer.id} 
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                gap: '12px',
                padding: '12px 16px',
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(71, 85, 105, 0.3)',
                borderRadius: '8px',
                marginBottom: '4px',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                alignItems: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(51, 65, 85, 0.5)';
                e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(30, 41, 59, 0.4)';
                e.currentTarget.style.borderColor = 'rgba(71, 85, 105, 0.3)';
              }}
            >
              {/* Account */}
              <div style={{
                fontFamily: 'Monaco, Menlo, monospace',
                fontSize: '12px',
                color: '#3b82f6',
                fontWeight: '500'
              }}>
                {formatAddress(offer.account)}
              </div>

              {/* Pair */}
              <div style={{
                fontSize: '13px',
                color: '#ffffff',
                fontWeight: '600'
              }}>
                {offer.taker_gets_currency}/{offer.taker_pays_currency}
              </div>

              {/* Price */}
              <div style={{
                fontFamily: 'Monaco, Menlo, monospace',
                fontSize: '13px',
                color: '#10b981',
                fontWeight: '600',
                textAlign: 'right'
              }}>
                {parseFloat(offer.price).toFixed(6)}
              </div>

              {/* Amount */}
              <div style={{
                fontFamily: 'Monaco, Menlo, monospace',
                fontSize: '12px',
                color: '#94a3b8',
                textAlign: 'right'
              }}>
                <div>{parseFloat(offer.taker_gets_value).toFixed(2)}</div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>
                  {offer.taker_gets_currency}
                </div>
              </div>

              {/* Time */}
              <div style={{
                fontSize: '11px',
                color: '#64748b',
                textAlign: 'right'
              }}>
                {formatTime(offer.updated_at)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-data">
          <div className="no-data-icon">📈</div>
          <div className="no-data-title">No recent offers available</div>
          <div className="no-data-subtitle">Waiting for new offer data...</div>
        </div>
      )}
    </div>
  );
};

export default RecentOffers; 