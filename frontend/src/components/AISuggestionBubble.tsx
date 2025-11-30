import { Box, Typography, Button, Card, Stack } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CloseIcon from '@mui/icons-material/Close';
import i18n from '@/i18n';
import { useState } from 'react';

interface AISuggestionBubbleProps {
  room?: string;
  scene?: string;
  onActivate?: () => void;
  onDismiss?: () => void;
}

export default function AISuggestionBubble({
  room = 'bureau',
  scene = 'Confort',
  onActivate,
  onDismiss,
}: AISuggestionBubbleProps) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const handleActivate = () => {
    onActivate?.();
  };

  if (dismissed) return null;

  return (
    <Card
      sx={{
        backgroundColor: '#F5F5F5',
        border: '1px solid #E0E0E0',
        borderRadius: 2,
        p: 2,
        position: 'relative',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Box
          sx={{
            color: 'primary.main',
            mt: 0.5,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography
            variant="body2"
            sx={{
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'text.primary',
            }}
          >
            {i18n.t('home.aiSuggestion', { room, scene })}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button
              variant="contained"
              size="small"
              onClick={handleActivate}
              sx={{
                textTransform: 'none',
                fontSize: '12px',
                px: 2,
                py: 0.5,
                minWidth: 'auto',
              }}
            >
              {i18n.t('home.activateScene')}
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={handleDismiss}
              sx={{
                textTransform: 'none',
                fontSize: '12px',
                px: 1,
                py: 0.5,
                minWidth: 'auto',
                color: 'text.secondary',
              }}
            >
              {i18n.t('home.dismiss')}
            </Button>
          </Stack>
        </Box>
        <Button
          onClick={handleDismiss}
          sx={{
            minWidth: 'auto',
            width: 24,
            height: 24,
            p: 0,
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'transparent',
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </Button>
      </Box>
    </Card>
  );
}

