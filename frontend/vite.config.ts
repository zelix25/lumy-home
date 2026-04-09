import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  // Charger les variables d'environnement depuis les fichiers .env
  // loadEnv charge automatiquement les fichiers .env, .env.local, .env.[mode], etc.
  // Le troisième paramètre 'VITE_' filtre uniquement les variables VITE_*
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  
  // Note: Vite remplace automatiquement import.meta.env.VITE_* au build
  // Les variables doivent être disponibles comme variables d'environnement au moment du build
  // Dans Docker, elles sont passées via ARG/ENV dans le Dockerfile
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: '0.0.0.0',
      allowedHosts: true,
      proxy: {
        '/api': {
          // Utiliser la variable chargée depuis .env ou la valeur par défaut
          target: env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  };
});

