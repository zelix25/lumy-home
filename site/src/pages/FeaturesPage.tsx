import { Box, Typography, Grid, Stack, Container } from '@mui/material';
import { ScandiCard } from '../components/ScandiCard';
import {
  SmartToy,
  Home,
  AutoAwesome,
  Security,
  Speed,
  Psychology,
  Devices,
  Timeline,
  Settings,
} from '@mui/icons-material';

export const FeaturesPage = () => {
  const features = [
    {
      icon: <SmartToy sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Assistant IA intégré',
      description:
        'Gemma 3 analyse vos habitudes et propose des automatisations intelligentes. L\'IA suggère, vous validez. Simple et efficace.',
    },
    {
      icon: <Home sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Interface scandinave épurée',
      description:
        'Design minimaliste inspiré du style scandinave. Beaucoup d\'espace, peu de couleurs, tout est clair et apaisant.',
    },
    {
      icon: <Devices sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Compatible avec 1000+ appareils',
      description:
        'Détection automatique des équipements Zigbee. Plus de 1000 modèles supportés, de Xiaomi à Philips Hue en passant par IKEA.',
    },
    {
      icon: <AutoAwesome sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Automatisations en quelques clics',
      description:
        'Créez des scénarios complexes sans code. "Quand le capteur détecte un mouvement, allumer la lumière pendant 5 minutes".',
    },
    {
      icon: <Timeline sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Historique et graphiques',
      description:
        'Visualisez l\'évolution de la température, de l\'humidité, de la luminosité. Graphiques minimalistes et clairs.',
    },
    {
      icon: <Security sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Sécurité et confidentialité',
      description:
        'Vos données restent chez vous. Option d\'IA locale avec Gemma 3. Aucune donnée envoyée au cloud sans votre consentement.',
    },
    {
      icon: <Speed sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Détection automatique',
      description:
        'Connectez un nouvel appareil Zigbee, Exo Home le détecte automatiquement et le configure pour vous.',
    },
    {
      icon: <Psychology sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Accessible aux novices',
      description:
        'Aucun jargon technique. Chaque terme est expliqué. Chaque action est guidée. La domotique devient accessible à tous.',
    },
    {
      icon: <Settings sx={{ fontSize: 48, color: 'primary.main' }} />,
      title: 'Réglages avancés optionnels',
      description:
        'Mode avancé pour les utilisateurs expérimentés. Accès aux paramètres Zigbee2MQTT pour un contrôle total.',
    },
  ];

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography
          variant="h1"
          sx={{
            mb: 2,
            textAlign: 'center',
            fontWeight: 700,
            fontSize: { xs: '2.5rem', md: '3rem' },
          }}
        >
          Fonctionnalités
        </Typography>
        <Typography
          variant="h2"
          sx={{
            mb: 8,
            textAlign: 'center',
            fontWeight: 400,
            fontSize: '1.25rem',
            color: 'text.secondary',
            maxWidth: '600px',
            mx: 'auto',
          }}
        >
          Tout ce dont vous avez besoin pour une maison intelligente, sans la
          complexité.
        </Typography>

        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <ScandiCard>
                <Stack spacing={2}>
                  {feature.icon}
                  <Typography variant="h5" sx={{ fontWeight: 600 }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {feature.description}
                  </Typography>
                </Stack>
              </ScandiCard>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  );
};

