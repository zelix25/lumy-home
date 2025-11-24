import { Box, Typography, Card, CardContent } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';

export default function AssistantPage() {
  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, mb: 1 }}>
          Assistant IA
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Créez des automatisations en langage naturel avec l'aide de l'intelligence artificielle.
        </Typography>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <SmartToyIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Assistant IA
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Dites-moi ce que vous voulez automatiser et je m'en occupe.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

