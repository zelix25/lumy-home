import { Box, Typography, Card, CardContent } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import i18n from '@/i18n';

export default function AssistantPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
          {i18n.t('assistant.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {i18n.t('assistant.subtitle')}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SmartToyIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {i18n.t('assistant.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {i18n.t('assistant.subtitle')}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

