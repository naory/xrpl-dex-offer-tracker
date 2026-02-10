import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardContent, Typography, Skeleton, Box, Divider } from '@mui/material';

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
      <Card>
        <CardHeader title="Recent Offers" subheader="Live Feed" />
        <CardContent>
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height={40} sx={{ mb: 1 }} />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title="Recent Offers" subheader={`(${offers.length} offers)`} />
      <CardContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 3fr 2fr 3fr 2fr', gap: 2, fontSize: 12, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, mb: 1 }}>
          <Box>Account</Box>
          <Box>Pair</Box>
          <Box textAlign="right">Price</Box>
          <Box textAlign="right">Amount</Box>
          <Box textAlign="right">Time</Box>
        </Box>
        <Divider />
        <Box mt={1}>
          {offers.length > 0 ? (
            offers.map((offer) => (
              <Box key={offer.id} sx={{ display: 'grid', gridTemplateColumns: '2fr 3fr 2fr 3fr 2fr', gap: 2, alignItems: 'center', py: 1.2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ fontFamily: 'Monaco, Menlo, monospace', color: 'info.main' }}>{formatAddress(offer.account)}</Typography>
                <Typography variant="body2" fontWeight={600}>{offer.taker_gets_currency}/{offer.taker_pays_currency}</Typography>
                <Typography variant="body2" textAlign="right" color="success.main" sx={{ fontFamily: 'Monaco, Menlo, monospace' }}>{parseFloat(offer.price).toFixed(6)}</Typography>
                <Box textAlign="right">
                  <Typography variant="body2" sx={{ fontFamily: 'Monaco, Menlo, monospace' }}>{parseFloat(offer.taker_gets_value).toFixed(2)}</Typography>
                  <Typography variant="caption" color="text.secondary">{offer.taker_gets_currency}</Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" textAlign="right">{formatTime(offer.updated_at)}</Typography>
              </Box>
            ))
          ) : (
            <Box textAlign="center" py={4}>
              <Typography variant="h6">No recent offers available</Typography>
              <Typography variant="body2" color="text.secondary">Waiting for new offer data...</Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default RecentOffers; 