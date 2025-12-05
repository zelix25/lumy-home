import { AppBar, Toolbar, Typography, Box, Button } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import SmartToyIcon from '@mui/icons-material/SmartToy';

export const Header = () => {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        backgroundColor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', py: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SmartToyIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography
            variant="h5"
            component={Link}
            to="/"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              textDecoration: 'none',
              letterSpacing: '-0.02em',
            }}
          >
            Exo Home
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <Button
            component={Link}
            to="/features"
            sx={{
              color: 'text.primary',
              fontWeight: 500,
              '&:hover': { color: 'primary.main' },
            }}
          >
            Fonctionnalités
          </Button>
          <Button
            component={Link}
            to="/about"
            sx={{
              color: 'text.primary',
              fontWeight: 500,
              '&:hover': { color: 'primary.main' },
            }}
          >
            À propos
          </Button>
          {!isHome && (
            <Button
              variant="contained"
              component={Link}
              to="/"
              sx={{
                backgroundColor: 'primary.main',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                },
              }}
            >
              Commencer
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

