import { Box, Typography, Card, CardContent } from '@mui/material';
import SceneIcon from '@mui/icons-material/AutoAwesome';
import i18n from '@/i18n';

export default function ScenesPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 1 }}>
          {i18n.t('scenes.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {i18n.t('scenes.subtitle')}
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SceneIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              {i18n.t('scenes.noScenesCreated')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {i18n.t('scenes.noScenesCreatedHint')}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

