# Configuration des variables d'environnement - Frontend

## 📋 Comment ça fonctionne

### 1. Fichiers de configuration

Les variables d'environnement sont chargées depuis les fichiers suivants (par ordre de priorité) :

1. `.env.[mode].local` (ex: `.env.production.local`)
2. `.env.local`
3. `.env.[mode]` (ex: `.env.production`)
4. `.env`

### 2. Variables disponibles

Seules les variables préfixées par `VITE_` sont exposées au code client :

- `VITE_API_URL` : URL de l'API backend
- `VITE_WS_URL` : URL du WebSocket

### 3. Utilisation dans le code

#### `vite.config.ts`
```typescript
// Charge les variables depuis .env pour la configuration du serveur de dev
const env = loadEnv(mode, process.cwd(), 'VITE_');
```

#### `api.service.ts` et `websocket.service.ts`
```typescript
// Vite remplace automatiquement import.meta.env.VITE_* au build
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000';
```

### 4. Développement local

1. Créez un fichier `.env` à la racine du dossier `frontend` :
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

2. Lancez le serveur de développement :
```bash
npm run dev
```

Les variables sont automatiquement chargées par Vite.

### 5. Build Docker

Dans le `Dockerfile`, les variables sont passées via `ARG` et `ENV` :

```dockerfile
ARG VITE_API_URL=http://localhost:3000
ARG VITE_WS_URL=ws://localhost:3000
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
```

Ces variables sont disponibles au moment du build et sont intégrées dans le code JavaScript compilé.

**Important** : Les variables `VITE_*` sont remplacées au moment du build, pas au runtime. Elles doivent pointer vers les URLs **publiques** accessibles depuis le navigateur.

### 6. Ordre de priorité (Docker)

1. Variables passées via `build.args` dans `docker-compose.yml`
2. Variables d'environnement du système
3. Variables du fichier `.env` (si copié dans le conteneur)
4. Valeurs par défaut dans le `Dockerfile`

## 🔍 Vérification

Pour vérifier que les variables sont bien chargées :

1. **En développement** : Ouvrez la console du navigateur et tapez :
```javascript
console.log(import.meta.env.VITE_API_URL);
```

2. **Dans le code buildé** : Les variables sont remplacées par leurs valeurs. Cherchez dans le code compilé dans `dist/`.

## ⚠️ Notes importantes

- Les variables `VITE_*` sont **publiques** et visibles dans le code JavaScript compilé
- Ne mettez **jamais** de secrets dans les variables `VITE_*`
- Pour Docker, utilisez les URLs publiques (ex: `http://localhost:3000`) car le code s'exécute dans le navigateur
- Les variables sont intégrées au build, pas au runtime

