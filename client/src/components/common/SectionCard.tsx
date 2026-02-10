import React from 'react';
import { Card, CardHeader, CardContent, CardProps } from '@mui/material';

interface SectionCardProps extends Omit<CardProps, 'title'> {
  title: React.ReactNode;
  subheader?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, subheader, action, children, ...cardProps }) => {
  return (
    <Card {...cardProps}>
      <CardHeader title={title} subheader={subheader} action={action} />
      <CardContent>{children}</CardContent>
    </Card>
  );
};

export default SectionCard;


