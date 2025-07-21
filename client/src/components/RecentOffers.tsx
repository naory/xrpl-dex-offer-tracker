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
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="loading-shimmer h-16 rounded"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-blue-400">📈</span>
        <span className="text-sm text-slate-400">Recent Offers ({offers.length})</span>
      </div>
      
      {offers.length > 0 ? (
        offers.map((offer) => (
          <div key={offer.id} className="text-xs p-3 bg-slate-800/30 rounded-lg space-y-2 border border-slate-700/30 hover:bg-slate-700/20 transition-colors">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Account:</span>
              <span className="text-blue-400 font-mono">{formatAddress(offer.account)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Pair:</span>
              <span className="text-white font-semibold">{offer.taker_gets_currency}/{offer.taker_pays_currency}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Price:</span>
              <span className="text-green-400 font-mono font-semibold">{parseFloat(offer.price).toFixed(6)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Amount:</span>
              <span className="text-slate-300 font-mono">{parseFloat(offer.taker_gets_value).toFixed(4)} {offer.taker_gets_currency}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Updated:</span>
              <span className="text-slate-400">{formatTime(offer.updated_at)}</span>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center text-slate-400 py-8">
          <div className="text-2xl mb-2">📈</div>
          <div>No recent offers available</div>
        </div>
      )}
    </div>
  );
};

export default RecentOffers; 