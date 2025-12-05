import { createTheme } from '@mui/material/styles';

// Palette Mode Clair (Scandinave)
const lightPalette = {
  background: {
    main: '#F7F7F5', // beige/gris clair scandinave
    paper: '#FFFFFF', // surfaces (cards)
  },
  text: {
    primary: '#1E1E1E',
    secondary: 'rgba(30, 30, 30, 0.6)',
  },
  divider: 'rgba(0, 0, 0, 0.08)',
  accent: {
    main: '#86A6A0', // vert-gris nordique
    secondary: '#D0BFAE', // bois clair
  },
};

// Palette Mode Sombre (Scandinave)
const darkPalette = {
  background: {
    main: '#1A1A1A', // anthracite scandinave
    paper: '#222222', // surfaces (cards)
  },
  text: {
    primary: '#EFEFEF',
    secondary: 'rgba(239, 239, 239, 0.6)',
  },
  divider: 'rgba(255, 255, 255, 0.08)',
  accent: {
    main: '#9BBEB7',
    secondary: '#A68C78',
  },
};

export const createScandinavianTheme = (mode: 'light' | 'dark' = 'light') => {
  const palette = mode === 'light' ? lightPalette : darkPalette;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: palette.accent.main,
        light: mode === 'light' ? '#A8C0BA' : '#B8D4CD',
        dark: mode === 'light' ? '#6B8A84' : '#7A9E96',
        contrastText: mode === 'light' ? '#FFFFFF' : '#1E1E1E',
      },
      secondary: {
        main: palette.accent.secondary,
        light: mode === 'light' ? '#E0CFC0' : '#B89A88',
        dark: mode === 'light' ? '#B89A88' : '#8B6F5E',
        contrastText: mode === 'light' ? '#1E1E1E' : '#EFEFEF',
      },
      background: {
        default: palette.background.main,
        paper: palette.background.paper,
      },
      text: {
        primary: palette.text.primary,
        secondary: palette.text.secondary,
      },
      divider: palette.divider,
    },
    typography: {
      fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
      h1: {
        fontWeight: 700,
        fontSize: '2.5rem',
        lineHeight: 1.2,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontWeight: 600,
        fontSize: '2rem',
        lineHeight: 1.3,
        letterSpacing: '-0.01em',
      },
      h3: {
        fontWeight: 500,
        fontSize: '1.5rem',
        lineHeight: 1.4,
      },
      h4: {
        fontWeight: 500,
        fontSize: '1.25rem',
        lineHeight: 1.4,
      },
      body1: {
        fontWeight: 400,
        fontSize: '16px',
        lineHeight: 1.6,
      },
      body2: {
        fontWeight: 400,
        fontSize: '14px',
        lineHeight: 1.5,
      },
      button: {
        fontWeight: 500,
        fontSize: '15px',
        textTransform: 'none',
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: mode === 'dark' 
              ? '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)' 
              : '0 2px 6px rgba(0,0,0,0.05)',
            backgroundColor: palette.background.paper,
            transition: 'all 200ms ease-out',
            '&:hover': {
              boxShadow: mode === 'dark'
                ? '0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px rgba(155,190,183,0.2)'
                : '0 4px 12px rgba(0,0,0,0.08)',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            padding: '10px 24px',
            fontWeight: 500,
            textTransform: 'none',
            transition: 'all 150ms ease-out',
            '&:hover': {
              transform: 'translateY(-1px)',
            },
          },
          contained: {
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 500,
          },
        },
      },
    },
  });
};

