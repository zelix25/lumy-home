import { Box, Typography, Container, Stack } from '@mui/material';
import { ScandiCard } from '../components/ScandiCard';

export const AboutPage = () => {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 4 }}>
        <Typography
          variant="h1"
          sx={{
            mb: 4,
            textAlign: 'center',
            fontWeight: 700,
            fontSize: { xs: '2.5rem', md: '3rem' },
          }}
        >
          À propos d'Exo Home
        </Typography>

        <Stack spacing={6}>
          <ScandiCard>
            <Typography variant="h3" sx={{ mb: 3, fontWeight: 600 }}>
              Notre mission
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'text.secondary', lineHeight: 1.8, fontSize: '1.1rem' }}
            >
              Exo Home a été créé pour rendre la domotique accessible à tous.
              Nous croyons que la technologie devrait simplifier votre vie, pas
              la compliquer. C'est pourquoi nous avons conçu un système
              intelligent, intuitif et sans jargon technique.
            </Typography>
          </ScandiCard>

          <ScandiCard>
            <Typography variant="h3" sx={{ mb: 3, fontWeight: 600 }}>
              Pourquoi Exo Home ?
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'text.secondary', lineHeight: 1.8, fontSize: '1.1rem' }}
            >
              La plupart des solutions de domotique sont conçues pour les
              technophiles. Exo Home est différent : nous avons pensé chaque
              interface, chaque fonctionnalité, chaque mot pour être compris par
              un novice. L'IA vous guide, vous n'avez qu'à choisir.
            </Typography>
          </ScandiCard>

          <ScandiCard>
            <Typography variant="h3" sx={{ mb: 3, fontWeight: 600 }}>
              Notre approche
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'text.secondary', lineHeight: 1.8, fontSize: '1.1rem' }}
            >
              <strong>Simplicité avant tout :</strong> Une interface épurée,
              inspirée du design scandinave. Beaucoup d'espace, peu de couleurs,
              tout est clair.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                lineHeight: 1.8,
                fontSize: '1.1rem',
                mt: 2,
              }}
            >
              <strong>Intelligence intégrée :</strong> L'IA Gemma 3 analyse vos
              habitudes et propose des automatisations. Vous gardez le contrôle,
              l'IA fait le travail.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
                lineHeight: 1.8,
                fontSize: '1.1rem',
                mt: 2,
              }}
            >
              <strong>Confidentialité respectée :</strong> Vos données restent
              chez vous. Option d'IA locale pour un contrôle total.
            </Typography>
          </ScandiCard>

          <ScandiCard>
            <Typography variant="h3" sx={{ mb: 3, fontWeight: 600 }}>
              La technologie
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: 'text.secondary', lineHeight: 1.8, fontSize: '1.1rem' }}
            >
              Exo Home est construit sur Zigbee2MQTT, une solution open-source
              robuste et compatible avec des milliers d'appareils. Nous avons
              ajouté une couche d'intelligence et de simplicité pour rendre cette
              technologie accessible à tous.
            </Typography>
          </ScandiCard>
        </Stack>
      </Box>
    </Container>
  );
};

