# Configuration réseau Docker - Lumy Home

## 🎯 Architecture réseau

Lumy Home utilise une architecture réseau Docker sécurisée où :

- **Frontend** : Seul service accessible publiquement (port 80)
- **Backend** : Accessible uniquement via le réseau Docker privé
- **Mosquitto** : Accessible uniquement via le réseau Docker privé
- **Communication** : Tous les services communiquent via des réseaux Docker privés

## 🌐 Réseaux Docker

### Réseau `Lumy Home-network` (bridge externe)
- **Services** : `mosquitto`, `backend`, `frontend`
- **Type** : Bridge externe (créé manuellement)
- **Usage** : Communication entre mosquitto et backend

### Réseau `frontend-backend` (bridge interne)
- **Services** : `frontend`, `backend`
- **Type** : Bridge interne (créé automatiquement par Docker Compose)
- **Usage** : Communication privée entre frontend et backend via nginx proxy

## 🔄 Flux de communication

### Requêtes HTTP API
```
Navigateur → Frontend (nginx:80) → /api → Backend (backend:3000)
```

Le frontend utilise des chemins relatifs (`/api`) qui sont proxifiés par nginx vers le backend via le réseau Docker privé.

### WebSocket
```
Navigateur → Frontend (nginx:80) → /socket.io → Backend (backend:3000)
```

Le frontend utilise des chemins relatifs pour WebSocket, proxifiés par nginx.

### MQTT
```
Backend → Mosquitto (mosquitto:1883) via réseau Docker privé
```

## 🚀 Configuration

### 1. Créer le réseau externe (si nécessaire)

```bash
docker network create Lumy Home-network
```

### 2. Ports exposés

- **Frontend** : `80:80` (seul port public)
- **Backend** : Aucun port exposé (communication privée uniquement)
- **Mosquitto** : Aucun port exposé (communication privée uniquement)

### 3. Pour le développement local

Si vous avez besoin d'accéder directement au backend ou à mosquitto depuis votre machine hôte, décommentez les ports dans `docker-compose.yml` :

```yaml
backend:
  ports:
    - "3000:3000"  # Décommentez pour accès direct

mosquitto:
  ports:
    - "1883:1883"  # Décommentez pour accès direct
    - "9001:9001"  # Décommentez pour accès direct
```

## 🔒 Sécurité

### Avantages de cette architecture

1. **Isolation** : Le backend et mosquitto ne sont pas accessibles depuis l'extérieur
2. **Sécurité** : Réduction de la surface d'attaque
3. **Simplicité** : Un seul point d'entrée (frontend sur port 80)
4. **Performance** : Communication interne via réseau Docker (plus rapide)

### Points d'attention

- Le frontend doit être correctement configuré pour proxifier les requêtes
- Les variables d'environnement du backend doivent utiliser les noms de services Docker (`mosquitto`, `backend`, etc.)
- En production, configurez un reverse proxy (Traefik, Nginx, etc.) devant le frontend pour HTTPS

## 📝 Variables d'environnement

### Backend

```env
MQTT_BROKER_URL=mqtt://mosquitto:1883  # Nom de service Docker
FRONTEND_URL=http://frontend:80        # Nom de service Docker
```

### Frontend

Plus besoin de `VITE_API_URL` et `VITE_WS_URL` en Docker - utilisation de chemins relatifs.

## 🔍 Vérification

### Vérifier les réseaux

```bash
docker network ls
docker network inspect Lumy Home-network
docker network inspect Lumy Home_frontend-backend
```

### Tester la communication

```bash
# Depuis le conteneur frontend
docker exec -it frontend ping backend
docker exec -it frontend ping mosquitto

# Depuis le conteneur backend
docker exec -it backend ping mosquitto
docker exec -it backend ping frontend
```

### Vérifier les ports

```bash
# Seul le port 80 devrait être exposé
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

