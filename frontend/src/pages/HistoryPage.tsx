import { Box, Typography, Card, CardContent } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import i18n from '@/i18n';

export default function HistoryPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
          {i18n.t('history.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {i18n.t('history.subtitle')}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <HistoryIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {i18n.t('history.noHistoryAvailable')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {i18n.t('history.noHistoryAvailableHint')}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

