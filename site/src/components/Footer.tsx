import { Box, Typography, Container, Grid, Link, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

export const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        py: 6,
        borderTop: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        mt: 'auto',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} sx={{ mb: 4 }}>
          {/* Colonne 1 : À propos */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography
              variant="h6"
              sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}
            >
              Exo Home
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', lineHeight: 1.8, mb: 2 }}
            >
              Votre maison devient vraiment intelligente. Simple, intuitif,
              accessible à tous.
            </Typography>
          </Grid>

          {/* Colonne 2 : Navigation */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography
              variant="h6"
              sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}
            >
              Navigation
            </Typography>
            <Stack spacing={1}>
              <Link
                component={RouterLink}
                to="/"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Accueil
              </Link>
              <Link
                component={RouterLink}
                to="/features"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Fonctionnalités
              </Link>
              <Link
                component={RouterLink}
                to="/about"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                À propos
              </Link>
            </Stack>
          </Grid>

          {/* Colonne 3 : Ressources */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography
              variant="h6"
              sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}
            >
              Ressources
            </Typography>
            <Stack spacing={1}>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Documentation
              </Link>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Support
              </Link>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Guide d'installation
              </Link>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                FAQ
              </Link>
            </Stack>
          </Grid>

          {/* Colonne 4 : Légal */}
          <Grid item xs={12} sm={6} md={3}>
            <Typography
              variant="h6"
              sx={{ mb: 2, fontWeight: 600, color: 'text.primary' }}
            >
              Légal
            </Typography>
            <Stack spacing={1}>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Confidentialité
              </Link>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Conditions d'utilisation
              </Link>
              <Link
                href="#"
                sx={{
                  color: 'text.secondary',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                  '&:hover': { color: 'primary.main' },
                }}
              >
                Mentions légales
              </Link>
            </Stack>
          </Grid>
        </Grid>

        {/* Copyright */}
        <Box
          sx={{
            pt: 4,
            borderTop: '1px solid',
            borderColor: 'divider',
            textAlign: 'center',
          }}
        >
          <Typography
            variant="body2"
            sx={{ color: 'text.secondary' }}
          >
            © 2025 Exo Home. Tous droits réservés.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

