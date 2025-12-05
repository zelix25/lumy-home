import { Card, CardContent, Box, SxProps, Theme } from '@mui/material';
import { ReactNode } from 'react';

interface ScandiCardProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
  onClick?: () => void;
  hover?: boolean;
}

export const ScandiCard = ({ children, sx, onClick, hover = true }: ScandiCardProps) => {
  return (
    <Card
      sx={{
        borderRadius: '12px',
        boxShadow: (theme) => 
          theme.palette.mode === 'dark'
            ? '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)'
            : '0 2px 6px rgba(0,0,0,0.05)',
        transition: 'all 200ms ease-out',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: 'background.paper',
        '&:hover': hover
          ? {
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(155,190,183,0.2)'
                  : '0 4px 12px rgba(0,0,0,0.08)',
              transform: 'translateY(-4px)',
            }
          : {},
        ...sx,
      }}
      onClick={onClick}
    >
      <CardContent sx={{ p: 3 }}>{children}</CardContent>
    </Card>
  );
};

