FROM node:20-alpine AS builder

WORKDIR /app

# Installer les dépendances système nécessaires pour compiler sqlite3
RUN apk add --no-cache \
    openssl \
    python3 \
    make \
    g++ \
    sqlite-dev \
    && ln -sf python3 /usr/bin/python

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY env.example.prod ./env.production

# Generate JWT_SECRET and replace it in .env file
RUN JWT_SECRET=$(openssl rand -hex 32) && \
    sed -i "s/JWT_SECRET=lumy-home-secret-key-change-in-production/JWT_SECRET=${JWT_SECRET}/" ./env.production

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY src ./src

# Builder l'application
RUN npm run build

# Stage de production
FROM node:20-alpine

WORKDIR /app

# Installer les dépendances runtime pour sqlite3
RUN apk add --no-cache sqlite-libs

# Copier les fichiers nécessaires
COPY package*.json ./
COPY --from=builder /app/dist ./dist
# Copier le fichier d'environnement de production et le renommer en .env
COPY --from=builder /app/env.production ./.env
# Copier node_modules compilés depuis le builder (inclut sqlite3 compilé)
COPY --from=builder /app/node_modules ./node_modules

# Installer uniquement les dépendances de production (sans rebuild, on utilise celles du builder)
RUN npm ci --only=production --ignore-scripts

# Créer les dossiers nécessaires
RUN mkdir -p data logs

# Exposer le port
EXPOSE 3000

# Commande de démarrage
CMD ["node", "dist/main"]

