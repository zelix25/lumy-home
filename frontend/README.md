# HomeHub IA - Frontend

Frontend React + Material-UI pour HomeHub IA, une interface intuitive pour la domotique Zigbee.

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20+
- npm ou yarn

### Installation

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement
npm run dev
```

L'application sera accessible sur `http://localhost:5173`

### Build de production

```bash
npm run build
```

Les fichiers de production seront dans le dossier `dist/`.

## 🔧 Variables d'environnement

### Développement local

Créez un fichier `.env` à la racine du dossier `frontend` avec :

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### Docker

Pour Docker, les variables d'environnement doivent être définies **avant le build**. 

**Option 1 : Fichier .env à la racine du projet**

Créez un fichier `.env` à la racine du projet (à côté de `docker-compose.yml`) :

```env
VITE_API_URL=http://backend:3000
VITE_WS_URL=ws://backend:3000
```

Puis lancez :
```bash
docker-compose build frontend
docker-compose up
```

**Option 2 : Variables d'environnement système**

Exportez les variables avant de lancer docker-compose :

```bash
export VITE_API_URL=http://backend:3000
export VITE_WS_URL=ws://backend:3000
docker-compose build frontend
docker-compose up
```

**Note importante :** Les variables doivent être disponibles au moment du **build**, pas seulement au runtime. C'est pourquoi elles sont passées via `build.args` dans le `docker-compose.yml`.

## 📦 Structure du projet

```
src/
├── components/      # Composants réutilisables
│   └── Layout.tsx   # Layout principal avec navigation
├── pages/          # Pages de l'application
│   ├── HomePage.tsx
│   ├── DevicesPage.tsx
│   ├── ScenesPage.tsx
│   ├── AssistantPage.tsx
│   └── HistoryPage.tsx
├── services/       # Services API et WebSocket
│   ├── api.service.ts
│   └── websocket.service.ts
├── hooks/          # Hooks React personnalisés
│   ├── useWebSocket.ts
│   └── useMqttMessages.ts
├── theme.ts        # Configuration Material-UI
├── App.tsx         # Composant principal
└── main.tsx        # Point d'entrée
```

## 🎨 Design

L'interface est conçue pour être :
- **Simple** : Navigation claire et intuitive
- **Moderne** : Design épuré et futuriste
- **Accessible** : Pensé pour les utilisateurs sans connaissances techniques
- **Responsive** : Adapté à tous les écrans

## 🔌 Configuration

Créez un fichier `.env` à la racine du projet :

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

## 📝 Navigation

L'application propose 5 sections principales :

1. **Maison** - Vue d'ensemble et statistiques
2. **Appareils** - Gestion des appareils Zigbee
3. **Scènes & Automatisations** - Création et gestion des scènes
4. **Assistant IA** - Création d'automatisations en langage naturel
5. **Historique** - Consultation des événements

## 🧪 Développement

```bash
# Lancer le linter
npm run lint

# Prévisualiser le build de production
npm run preview
```

## 📄 Licence

MIT

