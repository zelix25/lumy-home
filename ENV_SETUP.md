# Configuration des variables d'environnement

Ce document explique comment configurer les variables d'environnement pour HomeHub.

## 📁 Fichiers .env

Créez les fichiers `.env` suivants en copiant les fichiers `env.example` :

```bash
# Backend
cp backend/env.example backend/.env

# Frontend
cp frontend/env.example frontend/.env
```

## 🔧 Variables d'environnement

### Backend (`backend/.env`)

#### Application
- `NODE_ENV` : Environnement (`development` | `production` | `test`)
- `PORT` : Port d'écoute du serveur (défaut: `3000`)
- `FRONTEND_URL` : URL du frontend pour CORS
  - **Docker** : `http://frontend:80`
  - **Local** : `http://localhost:5173`

#### Base de données
- `DATABASE_PATH` : Chemin vers la base de données SQLite (défaut: `data/homehub.db`)

#### MQTT
- `MQTT_BROKER_URL` : URL du broker MQTT
  - **Docker** : `mqtt://mosquitto:1883` (communication via réseau Docker privé)
  - **Local** : `mqtt://localhost:1883`
- `MQTT_USERNAME` : Nom d'utilisateur MQTT (optionnel)
- `MQTT_PASSWORD` : Mot de passe MQTT (optionnel)
- `MQTT_CLIENT_ID` : ID du client MQTT (défaut: `homehub-backend`)
- `MQTT_RECONNECT_PERIOD` : Période de reconnexion en ms (défaut: `5000`)

#### Logging
- `LOG_LEVEL` : Niveau de log (`debug` | `info` | `warn` | `error`)

#### IA (Ollama)
- `LLAMA_API_URL` : URL de l'API Ollama
  - **Docker** : `http://ollama:11434`
  - **Local** : `http://localhost:11434`
- `LLAMA_MODEL` : Modèle à utiliser (défaut: `gemma3`)
- `USE_LOCAL_LLAMA` : Utiliser Ollama local (défaut: `true`)

#### Authentification
- `JWT_SECRET` : Clé secrète pour JWT ⚠️ **Changez en production !**
- `JWT_EXPIRES_IN` : Durée de validité du token (défaut: `7d`)
- `ENABLE_LOCAL_MODE` : Mode local sans authentification (défaut: `true`)

### Frontend (`frontend/.env`)

#### API (Optionnel - pour développement local uniquement)
- `VITE_API_URL` : URL de l'API backend (optionnel)
  - **Docker** : Non nécessaire - utilise des chemins relatifs `/api` proxifiés par nginx
  - **Local** : `http://localhost:3000` (si vous voulez bypasser le proxy Vite)
- `VITE_WS_URL` : URL du WebSocket (optionnel)
  - **Docker** : Non nécessaire - utilise des chemins relatifs proxifiés par nginx
  - **Local** : `ws://localhost:3000` (si vous voulez bypasser le proxy Vite)

⚠️ **Note importante** : 
- **En Docker** : Le frontend utilise des chemins relatifs (`/api` et `/socket.io`) qui sont automatiquement proxifiés par nginx vers le backend via le réseau Docker privé. Plus besoin de définir `VITE_API_URL` et `VITE_WS_URL`.
- **En développement local** : Vous pouvez définir ces variables si vous voulez bypasser le proxy Vite, sinon laissez-les vides pour utiliser les chemins relatifs.

## 🐳 Docker Compose

Le `docker-compose.yml` charge automatiquement les fichiers `.env` via `env_file` et utilise les variables d'environnement du système avec des valeurs par défaut.

### Ordre de priorité

1. Variables définies dans `docker-compose.yml` (section `environment`)
2. Variables du fichier `.env` (via `env_file`)
3. Variables d'environnement du système
4. Valeurs par défaut dans `docker-compose.yml`

### Exemple de configuration

```bash
# Créer les fichiers .env
cp backend/env.example backend/.env
cp frontend/env.example frontend/.env

# Modifier les valeurs selon votre environnement
# Puis lancer Docker Compose
docker-compose up -d
```

## 🔒 Sécurité

⚠️ **Important** :
- Ne commitez **jamais** les fichiers `.env` (ils sont dans `.gitignore`)
- Changez `JWT_SECRET` en production
- Utilisez des mots de passe forts pour MQTT en production
- En production, désactivez `ENABLE_LOCAL_MODE` si vous utilisez l'authentification

