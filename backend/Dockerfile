FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY src ./src

# Builder l'application
RUN npm run build

# Stage de production
FROM node:20-alpine

WORKDIR /app

# Copier les fichiers nécessaires
COPY package*.json ./
COPY --from=builder /app/dist ./dist
# Copier le fichier d'environnement de production et le renommer en .env
COPY --from=builder /app/env.production ./.env

# Installer uniquement les dépendances de production
RUN npm ci --only=production

# Créer les dossiers nécessaires
RUN mkdir -p data logs

# Exposer le port
EXPOSE 3000

# Commande de démarrage
CMD ["node", "dist/main"]

