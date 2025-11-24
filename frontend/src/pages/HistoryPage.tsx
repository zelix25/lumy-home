import { Box, Typography, Card, CardContent } from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';

export default function HistoryPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
          Historique
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Consultez l'historique des événements et actions de votre maison.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <HistoryIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Aucun historique disponible
            </Typography>
            <Typography variant="body2" color="text.secondary">
              L'historique des événements apparaîtra ici.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

