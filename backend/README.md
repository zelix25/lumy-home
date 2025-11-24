# HomeHub IA - Backend

Backend NestJS pour HomeHub IA, un serveur de domotique Zigbee boosté par l'intelligence artificielle.

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20+
- npm ou yarn
- SQLite3
- Broker MQTT (Zigbee2MQTT)

### Installation

```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Modifier .env selon votre configuration
```

### Configuration

Éditez le fichier `.env` avec vos paramètres :

- `MQTT_BROKER_URL` : URL du broker MQTT (par défaut: `mqtt://localhost:1883`)
- `DATABASE_PATH` : Chemin vers la base de données SQLite
- `FRONTEND_URL` : URL du frontend pour CORS

### Démarrage

```bash
# Mode développement
npm run start:dev

# Mode production
npm run build
npm run start:prod
```

## 📦 Structure du projet

```
src/
├── config/          # Configuration et validation
├── logger/          # Service de logging
├── mqtt/            # Module MQTT pour Zigbee2MQTT
├── websocket/       # Gateway WebSocket pour le frontend
├── app.module.ts    # Module principal
├── app.controller.ts
├── app.service.ts
└── main.ts          # Point d'entrée
```

## 🔧 Modules

### Configuration
Gestion centralisée de la configuration avec validation Joi.

### Logger
Service de logging avec Winston, rotation des fichiers et niveaux configurables.

### MQTT
Service MQTT pour la communication avec Zigbee2MQTT :
- Connexion automatique au broker
- Abonnement aux topics Zigbee2MQTT
- Publication de commandes
- Observable RxJS pour les messages

### WebSocket
Gateway WebSocket pour la communication temps réel avec le frontend :
- Diffusion des messages MQTT
- Gestion des connexions clients
- Événements personnalisés

## 🐳 Docker

```bash
# Build et démarrage
docker-compose up -d

# Logs
docker-compose logs -f backend
```

## 📝 API

### Endpoints REST

- `GET /` - Informations sur l'API
- `GET /health` - Statut de santé

### WebSocket

- `connected` - Événement de connexion
- `mqtt:message` - Message MQTT reçu
- `ping` / `pong` - Heartbeat

## 🔐 Sécurité

- Validation des entrées avec class-validator
- CORS configuré
- Variables d'environnement pour les secrets

## 📊 Base de données

SQLite pour la simplicité et la portabilité. La base de données est créée automatiquement au démarrage.

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests avec couverture
npm run test:cov

# Tests e2e
npm run test:e2e
```

## 📄 Licence

MIT

