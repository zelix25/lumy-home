import React from 'react';
import * as ReactDOM from 'react-dom';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// 1. Imports supplémentaires pour les plugins
import * as MaterialUI from '@mui/material';
import * as MaterialUIIcons from '@mui/icons-material';
import * as EmotionReact from '@emotion/react';
import * as EmotionStyled from '@emotion/styled';

import App from './App';
import { theme } from './theme';
import { AuthProvider } from './contexts/AuthContext';
import './i18n';
import './index.css';

// 2. Extension de l'interface Window pour TypeScript
declare global {
  interface Window {
    React: typeof React;
    ReactDOM: typeof ReactDOM;
    MaterialUI: typeof MaterialUI;
    MaterialUIIcons: typeof MaterialUIIcons;
    EmotionReact: typeof EmotionReact;
    EmotionStyled: typeof EmotionStyled;
  }
}

// 3. Exposition des dépendances pour les plugins externes
window.React = React;
window.ReactDOM = ReactDOM;
window.MaterialUI = MaterialUI;
window.MaterialUIIcons = MaterialUIIcons;
window.EmotionReact = EmotionReact;
window.EmotionStyled = EmotionStyled;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
