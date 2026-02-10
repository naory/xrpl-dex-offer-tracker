import { SxProps, Theme } from '@mui/material/styles';

export const popupPaperSx: SxProps<Theme> = {
  background: 'rgba(15, 23, 42, 0.95)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(71, 85, 105, 0.3)',
  borderRadius: 2,
  p: 2.5,
  minWidth: 320,
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3), 0 10px 10px -5px rgba(0,0,0,0.2)'
};

export const statusRowSx: SxProps<Theme> = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between'
};

export const labelCaptionSx: SxProps<Theme> = {
  color: 'text.secondary'
};

export const valueCaptionSx: SxProps<Theme> = {
  fontWeight: 500
};

export const chartCanvasSx: SxProps<Theme> = {
  width: '100%',
  height: 400,
  cursor: 'crosshair',
  borderRadius: 1,
  background: 'rgba(15, 23, 42, 0.3)'
};

export const chartSvgSx: SxProps<Theme> = {
  width: '100%',
  height: 384,
  borderRadius: 1,
  background: 'rgba(15, 23, 42, 0.3)'
};

export const overlayFullSx: SxProps<Theme> = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};

export const tooltipBoxSx: SxProps<Theme> = {
  background: 'rgba(0,0,0,0.8)',
  color: '#fff',
  p: 1.5,
  borderRadius: 1,
  fontSize: 12,
  fontFamily: 'Monaco, Menlo, monospace',
  border: '1px solid rgba(71,85,105,0.3)',
  backdropFilter: 'blur(10px)',
  pointerEvents: 'none'
};

export const orderRowBarBaseSx: SxProps<Theme> = {
  position: 'absolute',
  top: 0,
  right: 0,
  height: '100%',
  borderRadius: '6px',
  transition: 'width 0.3s ease',
  zIndex: 1
};


