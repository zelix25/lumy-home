FROM node:20-alpine AS builder

WORKDIR /app

# Déps build (node-gyp, sqlite3, bcrypt)
# + py3-setuptools: fournit la compat distutils (Python 3.12 / Alpine récent)
RUN apk add --no-cache \
    openssl \
    python3 \
    py3-setuptools \
    make \
    g++ \
    sqlite-dev \
    libc-dev \
    linux-headers \
  && ln -sf python3 /usr/bin/python

# Copier les manifests en premier (cache docker)
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./
#COPY env.example.prod ./env.production

# ⚠️ Note sécurité: générer un JWT secret au build rend l'image non-déterministe
# et complique les déploiements (toutes les replicas n'auront pas le même secret).
# Idéalement: injecter via secret/env au runtime.
#RUN JWT_SECRET="$(openssl rand -hex 32)" && \
#    sed -i "s/JWT_SECRET=lumy-home-secret-key-change-in-production/JWT_SECRET=${JWT_SECRET}/" ./env.production

# Forcer compilation depuis les sources (utile sur musl/multi-arch)
ENV npm_config_build_from_source=true
ENV npm_config_sqlite3_binary_host_mirror=""
ENV npm_config_bcrypt_build_from_source=true

# Installer les deps sans scripts puis rebuild ciblé
RUN npm ci --no-audit --no-fund --ignore-scripts

RUN npm rebuild sqlite3 --build-from-source || \
    (cd node_modules/sqlite3 && npm install --build-from-source)

RUN npm rebuild bcrypt --build-from-source || \
    (cd node_modules/bcrypt && npm install --build-from-source)

# Copier le code après les deps (cache)
COPY src ./src

RUN npm run build

# ==========================
# Runtime image
# ==========================
FROM node:20-alpine

WORKDIR /app

# Dépendances runtime uniquement
RUN apk add --no-cache sqlite-libs

COPY package*.json ./
COPY --from=builder /app/dist ./dist
#COPY --from=builder /app/env.production ./.env
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p data logs

EXPOSE 3000
CMD ["node", "dist/main"]
