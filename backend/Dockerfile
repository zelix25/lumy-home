FROM node:20-alpine AS builder
WORKDIR /app

# Dépendances build pour modules natifs (sqlite3/bcrypt)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite-dev \
    libc-dev \
    linux-headers \
    && ln -sf python3 /usr/bin/python

# Copier dépendances en premier (cache)
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

COPY env.example.prod ./env.production

# Generate JWT_SECRET and replace it in .env file
#
#    sed -i "s/JWT_SECRET=lumy-home-secret-key-change-in-production/JWT_SECRET=${JWT_SECRET}/" ./env.production

# Variables pour forcer compilation (multi-arch ok)
ENV npm_config_build_from_source=true
ENV npm_config_sqlite3_binary_host_mirror=""
ENV npm_config_bcrypt_build_from_source=true

# Installer node-gyp (utile sur armv7)
RUN npm install -g node-gyp@latest

# Install deps (incl. dev) nécessaires au build
RUN npm ci --no-audit --no-fund

# Copier le code source
COPY src ./src

# Build NestJS
RUN npm run build

# Nettoyage: ne garder que deps prod dans node_modules
RUN npm prune --omit=dev

# ==========================
# Stage production
# ==========================
FROM node:20-alpine
WORKDIR /app

# Runtime deps pour sqlite3
RUN apk add --no-cache sqlite-libs

# Copier artefacts build + deps prod
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
#COPY --from=builder /app/env.production ./.env
COPY --from=builder /app/package*.json ./

# (Optionnel) Exemple: on copie un fichier env template, mais NE PAS inclure de secrets
# COPY env.production ./.env

RUN mkdir -p data logs

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main"]
