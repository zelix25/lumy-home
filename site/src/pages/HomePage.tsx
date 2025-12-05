import {
  Box,
  Typography,
  Button,
  Grid,
  Stack,
  Container,
  useTheme,
  Divider,
} from '@mui/material';
import { Link } from 'react-router-dom';
import { ScandiCard } from '../components/ScandiCard';
import {
  SmartToy,
  Home,
  AutoAwesome,
  Security,
  Speed,
  Psychology,
  ArrowForward,
} from '@mui/icons-material';

export const HomePage = () => {
  const theme = useTheme();

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Hero Section - Composition asymétrique */}
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: '70vh', md: '85vh' },
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '-50%',
            right: '-20%',
            width: '800px',
            height: '800px',
            background: 'radial-gradient(circle, rgba(155, 190, 183, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(60px)',
            zIndex: 0,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            bottom: '-30%',
            left: '-10%',
            width: '600px',
            height: '600px',
            background: 'radial-gradient(circle, rgba(155, 190, 183, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(80px)',
            zIndex: 0,
          },
        }}
      >
        <Container maxWidth={1600} sx={{ position: 'relative', zIndex: 1 }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Box
                sx={{
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    left: '-20px',
                    top: '20%',
                    width: '4px',
                    height: '60%',
                    background: 'linear-gradient(180deg, transparent, primary.main, transparent)',
                    borderRadius: '2px',
                  },
                }}
              >
                <Typography
                  variant="h1"
                  sx={{
                    mb: 3,
                    fontWeight: 700,
                    fontSize: { xs: '2.5rem', md: '4rem' },
                    color: 'text.primary',
                    lineHeight: 1.1,
                    letterSpacing: '-0.03em',
                  }}
                >
                  Votre maison devient{' '}
                  <Box
                    component="span"
                    sx={{
                      background: 'linear-gradient(135deg, primary.main 0%, primary.light 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    vraiment intelligente.
                  </Box>
                </Typography>
                <Typography
                  variant="h2"
                  sx={{
                    mb: 5,
                    fontWeight: 400,
                    fontSize: { xs: '1.1rem', md: '1.35rem' },
                    color: 'text.secondary',
                    lineHeight: 1.6,
                    maxWidth: '90%',
                  }}
                >
                  Exo Home rend la domotique simple, intuitive et accessible à tous.
                  Sans jargon technique, sans complexité inutile.
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ mb: 4 }}
                >
                  <Button
                    variant="contained"
                    size="large"
                    component={Link}
                    to="/features"
                    endIcon={<ArrowForward />}
                    sx={{
                      px: 4,
                      py: 1.75,
                      fontSize: '1.1rem',
                      backgroundColor: 'primary.main',
                      color: 'background.default',
                      fontWeight: 600,
                      boxShadow: '0 4px 20px rgba(155, 190, 183, 0.3)',
                      '&:hover': {
                        backgroundColor: 'primary.dark',
                        boxShadow: '0 6px 30px rgba(155, 190, 183, 0.4)',
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 200ms ease-out',
                    }}
                  >
                    Commencez votre maison intelligente en 2 minutes
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    component={Link}
                    to="/about"
                    sx={{
                      px: 4,
                      py: 1.75,
                      fontSize: '1.1rem',
                      borderColor: 'divider',
                      borderWidth: '1.5px',
                      color: 'text.primary',
                      fontWeight: 500,
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: 'rgba(155, 190, 183, 0.08)',
                        borderWidth: '1.5px',
                      },
                      transition: 'all 200ms ease-out',
                    }}
                  >
                    Voir comment ça marche
                  </Button>
                </Stack>
              </Box>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  position: 'relative',
                  display: { xs: 'none', md: 'block' },
                }}
              >
                <Box
                  sx={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, rgba(155, 190, 183, 0.1) 0%, rgba(155, 190, 183, 0.05) 100%)',
                    border: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: 0,
                      background: 'radial-gradient(circle at 50% 50%, rgba(155, 190, 183, 0.2) 0%, transparent 70%)',
                      opacity: 0.5,
                    },
                  }}
                >
                  <SmartToy
                    sx={{
                      fontSize: 120,
                      color: 'primary.main',
                      opacity: 0.6,
                      filter: 'drop-shadow(0 0 20px rgba(155, 190, 183, 0.3))',
                    }}
                  />
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Le Problème - Section avec bordure accent */}
      <Container maxWidth={1600} sx={{ mb: 12 }}>
        <Box
          sx={{
            position: 'relative',
            p: { xs: 4, md: 6 },
            borderRadius: '16px',
            border: '1px solid',
            borderColor: 'divider',
            background: 'linear-gradient(135deg, rgba(155, 190, 183, 0.03) 0%, transparent 100%)',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '4px',
              background: 'linear-gradient(180deg, primary.main, primary.light)',
              borderRadius: '16px 0 0 16px',
            },
          }}
        >
          <Typography
            variant="h3"
            sx={{
              mb: 3,
              color: 'text.primary',
              fontWeight: 600,
              fontSize: { xs: '1.75rem', md: '2rem' },
            }}
          >
            La domotique est compliquée. Elle ne devrait pas l'être.
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: '1rem', md: '1.1rem' },
              lineHeight: 1.8,
              color: 'text.secondary',
              maxWidth: '800px',
            }}
          >
            Vous voulez une maison intelligente, mais vous ne voulez pas devenir ingénieur. Les systèmes existants sont fragmentés, techniques et intimidants. La technologie devrait simplifier votre vie, pas la compliquer. Vous avez essayé, vous avez abandonné. C'est normal. La domotique n'a pas été pensée pour vous.
          </Typography>
        </Box>
      </Container>

      {/* Le Guide : Exo Home - Composition en grille asymétrique */}
      <Container maxWidth={1600} sx={{ mb: 12 }}>
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h2"
            sx={{
              mb: 3,
              color: 'text.primary',
              fontWeight: 600,
              fontSize: { xs: '1.75rem', md: '2.5rem' },
            }}
          >
            Voici comment Exo Home simplifie votre maison
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: '1rem', md: '1.1rem' },
              lineHeight: 1.8,
              color: 'text.secondary',
              maxWidth: '700px',
            }}
          >
            Exo Home est votre compagnon intelligent. Il comprend ce dont vous avez besoin, vous guide à chaque étape, et transforme votre maison en un espace fluide et automatisé. Sans effort de votre part.
          </Typography>
        </Box>

        {/* Plan en 3 étapes - Layout vertical avec connecteurs */}
        <Box sx={{ position: 'relative' }}>
          <Grid container spacing={4}>
            {[
              {
                step: 1,
                title: 'Installez la box',
                description:
                  'Connectez simplement la box Exo Home à votre réseau. Aucune configuration complexe nécessaire. En quelques minutes, elle est prête.',
              },
              {
                step: 2,
                title: 'Connectez vos appareils',
                description:
                  'Découvrez automatiquement vos équipements Zigbee. Exo Home les reconnaît et les configure pour vous. Plus besoin de chercher des tutoriels ou de bidouiller des paramètres.',
              },
              {
                step: 3,
                title: 'Laissez Exo Home automatiser',
                description:
                  "L'IA propose des automatisations intelligentes. Vous choisissez, Exo Home s'occupe du reste. Votre maison devient intelligente, naturellement.",
              },
            ].map((item, index) => (
              <Grid item xs={12} md={4} key={item.step}>
                <Box
                  sx={{
                    position: 'relative',
                    height: '100%',
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: '40px',
                      right: '-32px',
                      width: '32px',
                      height: '2px',
                      background: 'linear-gradient(90deg, primary.main, transparent)',
                      display: { xs: 'none', md: index < 2 ? 'block' : 'none' },
                    },
                  }}
                >
                  <ScandiCard
                    sx={{
                      height: '100%',
                      border: '1px solid',
                      borderColor: 'divider',
                      background: 'linear-gradient(135deg, rgba(155, 190, 183, 0.05) 0%, transparent 100%)',
                      transition: 'all 300ms ease-out',
                      '&:hover': {
                        transform: 'translateY(-8px)',
                        borderColor: 'primary.main',
                        boxShadow: '0 8px 32px rgba(155, 190, 183, 0.2)',
                      },
                    }}
                  >
                    <Box sx={{ textAlign: 'left' }}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 56,
                          height: 56,
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, primary.main 0%, primary.light 100%)',
                          mb: 3,
                          boxShadow: '0 4px 16px rgba(155, 190, 183, 0.3)',
                        }}
                      >
                        <Typography
                          variant="h4"
                          sx={{ color: 'background.default', fontWeight: 700 }}
                        >
                          {item.step}
                        </Typography>
                      </Box>
                      <Typography
                        variant="h5"
                        sx={{
                          mb: 2,
                          fontWeight: 600,
                          fontSize: { xs: '1.25rem', md: '1.5rem' },
                          color: 'text.primary',
                        }}
                      >
                        {item.title}
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{
                          color: 'text.secondary',
                          lineHeight: 1.7,
                          fontSize: { xs: '0.95rem', md: '1rem' },
                        }}
                      >
                        {item.description}
                      </Typography>
                    </Box>
                  </ScandiCard>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>

      {/* Section Résultat (Le Succès) - Full width avec gradient */}
      <Box
        sx={{
          position: 'relative',
          py: { xs: 8, md: 12 },
          mb: 12,
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, rgba(155, 190, 183, 0.15) 0%, rgba(155, 190, 183, 0.05) 100%)',
            zIndex: 0,
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            top: '-50%',
            right: '-20%',
            width: '1000px',
            height: '1000px',
            background: 'radial-gradient(circle, rgba(155, 190, 183, 0.2) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(100px)',
            zIndex: 0,
          },
        }}
      >
        <Container maxWidth={1600} sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              textAlign: 'center',
              maxWidth: '800px',
              mx: 'auto',
            }}
          >
            <Typography
              variant="h2"
              sx={{
                mb: 4,
                color: 'text.primary',
                fontWeight: 600,
                fontSize: { xs: '1.75rem', md: '2.5rem' },
              }}
            >
              Une maison fluide, intelligente et automatisée
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1rem', md: '1.1rem' },
                lineHeight: 1.8,
                color: 'text.secondary',
                mb: 3,
              }}
            >
              Avec Exo Home, vous contrôlez votre maison sans effort. L'IA propose, vous choisissez. Tout est simple, visuel et apaisant. Vous retrouvez le sentiment de contrôle sans la complexité.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1rem', md: '1.1rem' },
                lineHeight: 1.8,
                color: 'text.secondary',
                mb: 5,
              }}
            >
              Votre maison s'adapte à vos habitudes. Les lumières s'allument quand vous rentrez. La température s'ajuste selon vos préférences. Les scénarios se créent tout seuls. Vous vivez dans une maison intelligente, sans y penser.
            </Typography>
            <Button
              variant="contained"
              size="large"
              component={Link}
              to="/features"
              endIcon={<ArrowForward />}
              sx={{
                px: 5,
                py: 1.75,
                fontSize: '1.1rem',
                backgroundColor: 'primary.main',
                color: 'background.default',
                fontWeight: 600,
                boxShadow: '0 4px 20px rgba(155, 190, 183, 0.3)',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                  boxShadow: '0 6px 30px rgba(155, 190, 183, 0.4)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 200ms ease-out',
              }}
            >
              Découvrir les fonctionnalités
            </Button>
          </Box>
        </Container>
      </Box>

      {/* Section IA - Card avec effet glow */}
      <Container maxWidth={1600} sx={{ mb: 12 }}>
        <ScandiCard
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            background: 'linear-gradient(135deg, rgba(155, 190, 183, 0.08) 0%, rgba(155, 190, 183, 0.02) 100%)',
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: '-50%',
              right: '-20%',
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(155, 190, 183, 0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(60px)',
            },
          }}
        >
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={4}>
              <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                <SmartToy
                  sx={{
                    fontSize: 80,
                    color: 'primary.main',
                    mb: 3,
                    filter: 'drop-shadow(0 0 20px rgba(155, 190, 183, 0.4))',
                  }}
                />
              </Box>
            </Grid>
            <Grid item xs={12} md={8}>
              <Typography
                variant="h2"
                sx={{
                  mb: 3,
                  color: 'text.primary',
                  fontWeight: 600,
                  fontSize: { xs: '1.75rem', md: '2.25rem' },
                }}
              >
                Une intelligence qui vous comprend
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  lineHeight: 1.8,
                  color: 'text.secondary',
                  mb: 3,
                }}
              >
                Exo Home utilise Gemma 3, une intelligence artificielle qui apprend vos habitudes et propose des automatisations adaptées. Elle observe, suggère, vous validez. C'est tout.
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  lineHeight: 1.8,
                  color: 'text.secondary',
                }}
              >
                Vous n'avez pas besoin de comprendre comment ça marche. L'IA analyse vos routines, détecte vos besoins, et vous propose des solutions. Vous gardez le contrôle, elle fait le travail. Simple, efficace, humain.
              </Typography>
            </Grid>
          </Grid>
        </ScandiCard>
      </Container>

      {/* Section Sécurité & Confidentialité - Split layout */}
      <Container maxWidth={1600} sx={{ mb: 12 }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={7}>
            <Typography
              variant="h2"
              sx={{
                mb: 3,
                color: 'text.primary',
                fontWeight: 600,
                fontSize: { xs: '1.75rem', md: '2.25rem' },
              }}
            >
              Vos données restent chez vous
            </Typography>
            <Typography
              variant="h3"
              sx={{
                mb: 4,
                color: 'text.secondary',
                fontWeight: 500,
                fontSize: { xs: '1.1rem', md: '1.25rem' },
              }}
            >
              C'est notre priorité.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1rem', md: '1.1rem' },
                lineHeight: 1.8,
                color: 'text.secondary',
                mb: 3,
              }}
            >
              Exo Home fonctionne entièrement en local si vous le souhaitez. L'IA Gemma 3 peut tourner directement sur votre box, sans envoyer aucune donnée au cloud. Vous choisissez : cloud pour plus de puissance, ou local pour plus de confidentialité.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1rem', md: '1.1rem' },
                lineHeight: 1.8,
                color: 'text.secondary',
                fontWeight: 500,
              }}
            >
              Votre vie privée est respectée. Toujours.
            </Typography>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '300px',
              }}
            >
              <Box
                sx={{
                  width: '200px',
                  height: '200px',
                  borderRadius: '24px',
                  background: 'linear-gradient(135deg, rgba(155, 190, 183, 0.1) 0%, rgba(155, 190, 183, 0.05) 100%)',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(circle at 50% 50%, rgba(155, 190, 183, 0.2) 0%, transparent 70%)',
                    opacity: 0.5,
                    borderRadius: '24px',
                  },
                }}
              >
                <Security
                  sx={{
                    fontSize: 80,
                    color: 'primary.main',
                    opacity: 0.7,
                    position: 'relative',
                    zIndex: 1,
                    filter: 'drop-shadow(0 0 20px rgba(155, 190, 183, 0.3))',
                  }}
                />
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Container>

      {/* Section "Pourquoi Exo Home ?" - Centered card */}
      <Container maxWidth={1600} sx={{ mb: 12 }}>
        <ScandiCard
          sx={{
            textAlign: 'center',
            border: '1px solid',
            borderColor: 'divider',
            background: 'linear-gradient(135deg, rgba(155, 190, 183, 0.05) 0%, transparent 100%)',
            p: { xs: 4, md: 6 },
          }}
        >
          <Typography
            variant="h2"
            sx={{
              mb: 4,
              color: 'text.primary',
              fontWeight: 600,
              fontSize: { xs: '1.75rem', md: '2.25rem' },
            }}
          >
            Pourquoi Exo Home ?
          </Typography>
          <Typography
            variant="h3"
            sx={{
              mb: 4,
              color: 'text.primary',
              fontWeight: 600,
              fontSize: { xs: '1.25rem', md: '1.5rem' },
              lineHeight: 1.4,
            }}
          >
            Exo Home est la seule solution de domotique pensée pour les novices, sans sacrifier la puissance.
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: '1rem', md: '1.1rem' },
              lineHeight: 1.8,
              color: 'text.secondary',
              mb: 4,
            }}
          >
            La plupart des systèmes sont conçus pour les technophiles. Exo Home est différent : nous avons pensé chaque interface, chaque fonctionnalité, chaque mot pour être compris par un novice. L'IA vous guide, vous n'avez qu'à choisir.
          </Typography>
          <Typography
            variant="h4"
            sx={{
              color: 'primary.main',
              fontWeight: 600,
              fontSize: { xs: '1.1rem', md: '1.25rem' },
              letterSpacing: '0.05em',
            }}
          >
            Simple. Intelligent. Accessible. C'est Exo Home.
          </Typography>
        </ScandiCard>
      </Container>

      {/* Fonctionnalités clés - Grid moderne */}
      <Container maxWidth={1600} sx={{ mb: 12 }}>
        <Typography
          variant="h2"
          sx={{
            mb: 6,
            textAlign: 'center',
            color: 'text.primary',
            fontWeight: 600,
            fontSize: { xs: '1.75rem', md: '2.5rem' },
          }}
        >
          Tout ce dont vous avez besoin, simplement
        </Typography>
        <Grid container spacing={3}>
          {[
            {
              icon: <SmartToy sx={{ fontSize: 40, color: 'primary.main' }} />,
              title: 'Assistant IA intégré',
              description:
                'Des suggestions intelligentes pour automatiser votre maison, adaptées à vos habitudes.',
            },
            {
              icon: <Home sx={{ fontSize: 40, color: 'primary.main' }} />,
              title: 'Interface épurée',
              description:
                'Une interface scandinave minimaliste, claire et intuitive. Pas de jargon technique.',
            },
            {
              icon: <AutoAwesome sx={{ fontSize: 40, color: 'primary.main' }} />,
              title: 'Automatisations intelligentes',
              description:
                'Créez des scénarios complexes en quelques clics. L\'IA vous guide à chaque étape.',
            },
            {
              icon: <Security sx={{ fontSize: 40, color: 'primary.main' }} />,
              title: 'Sécurité & confidentialité',
              description:
                'Vos données restent chez vous. IA locale optionnelle avec Gemma 3.',
            },
            {
              icon: <Speed sx={{ fontSize: 40, color: 'primary.main' }} />,
              title: 'Détection automatique',
              description:
                'Compatible avec plus de 1000 appareils Zigbee. Détection et configuration automatiques.',
            },
            {
              icon: <Psychology sx={{ fontSize: 40, color: 'primary.main' }} />,
              title: 'Accessible à tous',
              description:
                'Conçu pour les novices. Chaque terme est expliqué, chaque action est claire.',
            },
          ].map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <ScandiCard
                sx={{
                  height: '100%',
                  border: '1px solid',
                  borderColor: 'divider',
                  background: 'linear-gradient(135deg, rgba(155, 190, 183, 0.03) 0%, transparent 100%)',
                  transition: 'all 300ms ease-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: 'primary.main',
                    boxShadow: '0 8px 24px rgba(155, 190, 183, 0.15)',
                  },
                }}
              >
                <Stack spacing={2}>
                  {feature.icon}
                  <Typography variant="h5" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                    {feature.description}
                  </Typography>
                </Stack>
              </ScandiCard>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* CTA Final - Section avec accent */}
      <Container maxWidth={1600} sx={{ mb: 8 }}>
        <Box
          sx={{
            textAlign: 'center',
            py: { xs: 8, md: 10 },
            position: 'relative',
            borderRadius: '16px',
            border: '1px solid',
            borderColor: 'divider',
            background: 'linear-gradient(135deg, rgba(155, 190, 183, 0.05) 0%, transparent 100%)',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: '200px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, primary.main, transparent)',
              borderRadius: '2px',
            },
          }}
        >
          <Typography
            variant="h3"
            sx={{
              mb: 3,
              color: 'text.primary',
              fontWeight: 600,
              fontSize: { xs: '1.75rem', md: '2rem' },
            }}
          >
            Prêt à commencer ?
          </Typography>
          <Typography
            variant="body1"
            sx={{
              mb: 5,
              color: 'text.secondary',
              fontSize: { xs: '1rem', md: '1.1rem' },
              maxWidth: '600px',
              mx: 'auto',
            }}
          >
            Rejoignez les utilisateurs qui ont simplifié leur maison intelligente.
          </Typography>
          <Button
            variant="contained"
            size="large"
            component={Link}
            to="/features"
            endIcon={<ArrowForward />}
            sx={{
              px: 6,
              py: 2,
              fontSize: { xs: '1.1rem', md: '1.2rem' },
              backgroundColor: 'primary.main',
              color: 'background.default',
              fontWeight: 600,
              boxShadow: '0 4px 20px rgba(155, 190, 183, 0.3)',
              '&:hover': {
                backgroundColor: 'primary.dark',
                boxShadow: '0 6px 30px rgba(155, 190, 183, 0.4)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 200ms ease-out',
            }}
          >
            Commencez votre maison intelligente
          </Button>
        </Box>
      </Container>
    </Box>
  );
};
