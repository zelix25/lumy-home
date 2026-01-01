# Utiliser une image de base différente selon l'architecture
# Pour ARMv7, utiliser Debian (meilleure compatibilité avec sqlite3)
# Pour les autres architectures, utiliser Alpine (plus léger)
ARG TARGETPLATFORM=linux/amd64
ARG BUILDPLATFORM

# Stage builder - utiliser Debian pour ARMv7, Alpine pour les autres
FROM node:20-bullseye AS builder-debian
FROM node:20-alpine AS builder-alpine

# Sélectionner le builder selon TARGETPLATFORM
# Pour ARMv7, utiliser Debian, sinon Alpine
FROM builder-debian AS builder-armv7
FROM builder-alpine AS builder-amd64
FROM builder-alpine AS builder-arm64

# Utiliser le builder par défaut (sera surchargé par Buildx)
FROM builder-alpine AS builder

WORKDIR /app

# Installer les dépendances système pour Alpine (AMD64, ARM64)
# Nécessaires pour compiler sqlite3 et bcrypt
RUN if [ -f /etc/alpine-release ]; then \
        apk add --no-cache \
            openssl \
            python3 \
            make \
            g++ \
            sqlite-dev \
            libc-dev \
            linux-headers \
            && ln -sf python3 /usr/bin/python; \
    fi

# Installer les dépendances système pour Debian (ARMv7)
# Nécessaires pour compiler sqlite3 et bcrypt
RUN if [ -f /etc/debian_version ]; then \
        apt-get update && apt-get install -y \
            openssl \
            python3 \
            python3-setuptools \
            make \
            g++ \
            libsqlite3-dev \
            build-essential \
            && rm -rf /var/lib/apt/lists/*; \
    fi

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY env.example.prod ./env.production

# Generate JWT_SECRET and replace it in .env file
RUN JWT_SECRET=$(openssl rand -hex 32) && \
    sed -i "s/JWT_SECRET=lumy-home-secret-key-change-in-production/JWT_SECRET=${JWT_SECRET}/" ./env.production

# Installer les dépendances
# Forcer la compilation de tous les modules natifs depuis les sources
ENV npm_config_build_from_source=true
ENV npm_config_sqlite3_binary_host_mirror=""
ENV npm_config_bcrypt_build_from_source=true

# Installer node-gyp globalement pour une meilleure compatibilité
RUN npm install -g node-gyp@latest

# Installer les dépendances
# D'abord installer sans les scripts natifs, puis compiler séparément
RUN npm ci --ignore-scripts

# Rebuild les modules natifs séparément avec gestion d'erreur
RUN npm rebuild sqlite3 --build-from-source || \
    (cd node_modules/sqlite3 && npm install --build-from-source)

RUN npm rebuild bcrypt --build-from-source || \
    (cd node_modules/bcrypt && npm install --build-from-source)

# Copier le code source
COPY src ./src

# Builder l'application
RUN npm run build

# Stage de production - utiliser Debian pour ARMv7, Alpine pour les autres
FROM node:20-bullseye AS production-debian
FROM node:20-alpine AS production-alpine

# Sélectionner le stage de production selon TARGETPLATFORM
FROM production-debian AS production-armv7
FROM production-alpine AS production-amd64
FROM production-alpine AS production-arm64

# Utiliser le stage de production par défaut (sera surchargé par Buildx)
FROM production-alpine AS production

WORKDIR /app

# Installer les dépendances runtime pour Alpine (AMD64, ARM64)
RUN if [ -f /etc/alpine-release ]; then \
        apk add --no-cache sqlite-libs; \
    fi

# Installer les dépendances runtime pour Debian (ARMv7)
RUN if [ -f /etc/debian_version ]; then \
        apt-get update && apt-get install -y \
            libsqlite3-0 \
            && rm -rf /var/lib/apt/lists/*; \
    fi

# Copier les fichiers nécessaires
COPY package*.json ./
COPY --from=builder /app/dist ./dist
# Copier le fichier d'environnement de production et le renommer en .env
COPY --from=builder /app/env.production ./.env
# Copier node_modules compilés depuis le builder (inclut sqlite3 compilé)
COPY --from=builder /app/node_modules ./node_modules

# Créer les dossiers nécessaires
RUN mkdir -p data logs

# Exposer le port
EXPOSE 3000

# Commande de démarrage
CMD ["node", "dist/main"]
