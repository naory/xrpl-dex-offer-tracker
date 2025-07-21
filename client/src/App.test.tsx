import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders XRPL trader app', () => {
  render(<App />);
  const traderElement = screen.getByText(/XRPL TRADER/i);
  expect(traderElement).toBeTruthy();
});
