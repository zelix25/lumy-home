import { createTheme } from '@mui/material/styles';

// Style scandinave épuré - Mode clair
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#86A6A0', // Vert-gris nordique (accent)
      light: '#9BBEB7',
      dark: '#6B8A84',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#D0BFAE', // Bois clair (accent secondaire)
      light: '#D9C9BA',
      dark: '#B8A896',
      contrastText: '#1E1E1E',
    },
    background: {
      default: '#F7F7F5', // Beige/gris clair scandinave
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1E1E1E',
      secondary: '#5A5A5A',
    },
    divider: 'rgba(0, 0, 0, 0.08)',
    success: {
      main: '#86A6A0',
      light: '#9BBEB7',
      dark: '#6B8A84',
    },
    warning: {
      main: '#D0BFAE',
      light: '#D9C9BA',
      dark: '#B8A896',
    },
    error: {
      main: '#C4A5A5',
      light: '#D4B5B5',
      dark: '#B49595',
    },
    info: {
      main: '#86A6A0',
      light: '#9BBEB7',
      dark: '#6B8A84',
    },
  },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontWeight: 500,
      fontSize: '2.5rem',
      letterSpacing: '-0.01em',
    },
    h2: {
      fontWeight: 500,
      fontSize: '2rem',
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 500,
      fontSize: '1.75rem',
    },
    h4: {
      fontWeight: 500,
      fontSize: '1.5rem',
    },
    h5: {
      fontWeight: 500,
      fontSize: '1.25rem',
    },
    h6: {
      fontWeight: 500,
      fontSize: '1rem',
    },
    body1: {
      fontSize: '14px',
      fontWeight: 400,
    },
    body2: {
      fontSize: '14px',
      fontWeight: 400,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
      fontSize: '14px',
    },
  },
  shape: {
    borderRadius: 8, // Angles légèrement arrondis style scandinave
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 20px',
          fontSize: '14px',
          fontWeight: 500,
          transition: 'all 0.15s ease-in-out',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          },
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          },
        },
        outlined: {
          borderWidth: '1px',
          '&:hover': {
            borderWidth: '1px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: 'none',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          transition: 'all 0.15s ease-in-out',
          backgroundColor: '#FFFFFF',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          boxShadow: 'none',
          color: '#1E1E1E',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: '1px solid rgba(0,0,0,0.08)',
          boxShadow: 'none',
          backgroundColor: '#FFFFFF',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: 'none',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        },
        elevation1: {
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        },
        elevation2: {
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        },
        elevation3: {
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: 'none',
          boxShadow: 'none',
          fontWeight: 400,
          backgroundColor: 'rgba(0,0,0,0.04)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            transition: 'all 0.15s ease-in-out',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(0,0,0,0.2)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: '#86A6A0',
              borderWidth: '1px',
            },
          },
        },
      },
    },
    MuiSwitch: {
      styleOverrides: {
        root: {
          '& .MuiSwitch-switchBase': {
            '&.Mui-checked': {
              color: '#86A6A0',
            },
          },
          '& .MuiSwitch-thumb': {
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          },
          '& .MuiSwitch-track': {
            borderRadius: 12,
            border: 'none',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(0,0,0,0.04)',
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(134, 166, 160, 0.1)',
            color: '#1E1E1E',
            '&:hover': {
              backgroundColor: 'rgba(134, 166, 160, 0.15)',
            },
            '& .MuiListItemIcon-root': {
              color: '#86A6A0',
            },
          },
        },
      },
    },
  },
});

