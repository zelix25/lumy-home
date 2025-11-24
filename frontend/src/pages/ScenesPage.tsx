import { Box, Typography, Card, CardContent } from '@mui/material';
import SceneIcon from '@mui/icons-material/AutoAwesome';

export default function ScenesPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
          Scènes & Automatisations
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Créez des scènes et automatisez votre maison en quelques clics.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SceneIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Aucune scène créée
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Créez votre première scène ou automatisation pour commencer.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

