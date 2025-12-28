FROM node:20-alpine AS builder

WORKDIR /app
RUN apk add --no-cache openssl

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY env.example.prod ./.env

# Generate JWT_SECRET and replace it in .env file
RUN JWT_SECRET=$(openssl rand -hex 32) && \
    sed -i "s/JWT_SECRET=lumy-home-secret-key-change-in-production/JWT_SECRET=${JWT_SECRET}/" ./.env

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

