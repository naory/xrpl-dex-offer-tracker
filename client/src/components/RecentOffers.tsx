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
          {[...Array(5)].map((_, i) => (
            <div key={i} className="loading-shimmer" style={{ height: '96px' }}></div>
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
      
      {offers.length > 0 ? (
        <div className="recent-offers-container">
          {offers.map((offer) => (
            <div key={offer.id} className="offer-card">
              <div className="offer-row">
                <span className="offer-label">Account:</span>
                <span className="offer-value account">{formatAddress(offer.account)}</span>
              </div>
              <div className="offer-row">
                <span className="offer-label">Pair:</span>
                <span className="offer-value pair">{offer.taker_gets_currency}/{offer.taker_pays_currency}</span>
              </div>
              <div className="offer-row">
                <span className="offer-label">Price:</span>
                <span className="offer-value price">{parseFloat(offer.price).toFixed(6)}</span>
              </div>
              <div className="offer-row">
                <span className="offer-label">Amount:</span>
                <span className="offer-value amount">{parseFloat(offer.taker_gets_value).toFixed(4)} {offer.taker_gets_currency}</span>
              </div>
              <div className="offer-row">
                <span className="offer-label">Updated:</span>
                <span className="offer-value time">{formatTime(offer.updated_at)}</span>
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