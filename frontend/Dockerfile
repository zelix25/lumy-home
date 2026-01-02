# Stage de build
FROM node:20-alpine AS builder

WORKDIR /app

# Les variables VITE_API_URL et VITE_WS_URL ne sont plus nécessaires
# Le frontend utilise maintenant des chemins relatifs (/api et /socket.io)
# qui sont proxifiés par nginx vers le backend
# Pour le développement local, vous pouvez toujours définir ces variables dans .env

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY env.example.prod ./env

# Copier le fichier .env s'il existe (optionnel, les ENV prennent priorité)
# Le .dockerignore exclut déjà .env, donc on le copie explicitement si nécessaire
# COPY .env* ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY src ./src

# Builder l'application
# Les variables VITE_* dans ENV seront automatiquement disponibles pour Vite
RUN npm run build

# Stage de production avec nginx
FROM nginx:alpine

# Copier les fichiers buildés
COPY --from=builder /app/dist /usr/share/nginx/html

# Copier la configuration nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exposer le port
EXPOSE 80

# Démarrer nginx
CMD ["nginx", "-g", "daemon off;"]

