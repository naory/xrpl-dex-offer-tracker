import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#60a5fa' },
    secondary: { main: '#a855f7' },
    success: { main: '#10b981' },
    error: { main: '#ef4444' },
    info: { main: '#3b82f6' },
    background: {
      default: '#0f172a',
      paper: 'rgba(15, 23, 42, 0.95)',
    },
  },
  shape: { borderRadius: 8 },
});

export default theme;


