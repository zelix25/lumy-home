import { Box, keyframes } from '@mui/material';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

const pulse = keyframes`
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
`;

interface StatusIndicatorProps {
  status: 'good' | 'warning' | 'error';
  size?: number;
}

export default function StatusIndicator({ status, size = 16 }: StatusIndicatorProps) {
  const colors = {
    good: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
  };

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <FiberManualRecordIcon
        sx={{
          fontSize: size,
          color: colors[status],
          animation: `${pulse} 2s ease-in-out infinite`,
        }}
      />
    </Box>
  );
}

