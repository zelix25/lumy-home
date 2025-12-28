# Lumy Home

<div align="center">

![Lumy Home Logo](logo.png)

**Solution de domotique Zigbee open-source avec intelligence artificielle**

[English](#lumy-home-1) | [Français](#lumy-home)

</div>

---

# Lumy Home

Lumy Home est une solution complète de domotique Zigbee open-source qui permet de contrôler et automatiser votre maison intelligente. Avec son interface moderne, son système d'automatisations avancé et son assistant IA en langage naturel, Lumy Home rend la domotique accessible à tous.

## ✨ Fonctionnalités principales

### 🏠 Gestion des appareils
- **Découverte automatique** : Détection et ajout automatique des appareils Zigbee
- **Support multi-appareils** : Lampes, interrupteurs, capteurs, thermostats, etc.
- **Organisation par pièces** : Groupez vos appareils par pièce pour une meilleure organisation
- **Contrôle en temps réel** : Allumage, extinction, réglage de luminosité et de couleur
- **Statut en direct** : Suivi de l'état de tous vos appareils via WebSocket

### 🤖 Automatisations intelligentes
- **Création en langage naturel** : Créez des automatisations en parlant simplement ("Allume la lumière du salon quand j'entre dans la pièce")
- **Éditeur visuel de nœuds** : Créez des automatisations complexes avec un éditeur graphique intuitif
- **Déclencheurs variés** :
  - Détection de mouvement
  - Ouverture/fermeture de portes et fenêtres
  - Température
  - Lever/coucher du soleil
  - Heure programmée
  - Boutons
- **Actions multiples** : Contrôlez plusieurs appareils simultanément
- **Historique d'exécution** : Suivez toutes les exécutions de vos automatisations

### 🧠 Intelligence artificielle
- **Assistant IA local** : Utilise Gemma3 via Ollama pour un traitement 100% local
- **Création d'automatisations en langage naturel** : Décrivez simplement ce que vous voulez
- **Pas de données envoyées** : Tout reste sur votre serveur

### 📊 Tableau de bord
- **Vue d'ensemble** : Contrôle rapide de tous vos appareils
- **Graphiques de consommation** : Suivez la consommation énergétique de vos appareils
- **Météo intégrée** : Affichage des conditions météorologiques locales
- **Historique** : Timeline de tous les événements de votre maison

### 🔌 Système de plugins
- **Extensibilité** : Ajoutez de nouvelles fonctionnalités via des plugins
- **API complète** : Développez vos propres plugins facilement
- **Gestion centralisée** : Installez, mettez à jour et désinstallez des plugins depuis l'interface

### 🌐 Interface moderne
- **Design Material-UI** : Interface moderne et intuitive
- **Multilingue** : Support français et anglais
- **Responsive** : Accessible depuis n'importe quel appareil
- **Temps réel** : Mises à jour instantanées via WebSocket

## 🚀 Démarrage rapide

### Prérequis

- Docker et Docker Compose installés
- Un coordinateur Zigbee (ex: CC2531, CC2652, etc.)
- Linux (Debian/Ubuntu recommandé)

### Installation automatique

```bash
# Téléchargez le script d'installation
wget https://raw.githubusercontent.com/votre-repo/lumy-home/main/scripts/install.sh

# Rendez-le exécutable
chmod +x install.sh

# Exécutez l'installation
sudo ./install.sh
```

### Installation manuelle

1. **Clonez le dépôt**
```bash
git clone https://github.com/votre-repo/lumy-home.git
cd lumy-home
```

2. **Configurez les variables d'environnement**
```bash
# Copiez les fichiers d'exemple
cp backend/env.example.prod backend/.env
cp frontend/env.example.prod frontend/.env

# Éditez les fichiers .env selon vos besoins
```

3. **Créez le réseau Docker**
```bash
docker network create lumy-network
```

4. **Lancez les services**
```bash
docker-compose up -d
```

5. **Accédez à l'interface**
Ouvrez votre navigateur à l'adresse : `http://localhost`

## 📖 Documentation

### Configuration

- [Configuration réseau](doc/NETWORK_SETUP.md)
- [Variables d'environnement](doc/ENV_SETUP.md)
- [Configuration Zigbee2MQTT](data/zigbee2mqtt/configuration.yaml)

### Développement

- [API Backend](backend/README.md)
- [Frontend](frontend/README.md)
- [Système de plugins](backend/plugins/API.md)
- [Automatisations](backend/src/automations/README.md)

## 🏗️ Architecture

Lumy Home est composé de plusieurs services Docker :

- **Frontend** : Interface React avec Material-UI (port 80)
- **Backend** : API NestJS (port 3000)
- **Zigbee2MQTT** : Gestionnaire Zigbee (port 8080)
- **Mosquitto** : Broker MQTT
- **Ollama** : Serveur IA local (port 11434)

## 🔧 Configuration

### Coordinateur Zigbee

Assurez-vous que votre coordinateur Zigbee est connecté et accessible via `/dev/ttyUSB0` (ou modifiez le chemin dans `docker-compose.yml`).

### Réseau

Par défaut, les services communiquent via un réseau Docker privé. Pour le développement local, vous pouvez décommenter les ports dans `docker-compose.yml`.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Ouvrir une issue pour signaler un bug
- Proposer une nouvelle fonctionnalité
- Soumettre une pull request

## 📝 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- [Zigbee2MQTT](https://www.zigbee2mqtt.io/) pour la gestion Zigbee
- [NestJS](https://nestjs.com/) pour le framework backend
- [React](https://react.dev/) pour le framework frontend
- [Ollama](https://ollama.ai/) pour l'IA locale

---

# Lumy Home

Lumy Home is a complete open-source Zigbee home automation solution that allows you to control and automate your smart home. With its modern interface, advanced automation system, and natural language AI assistant, Lumy Home makes home automation accessible to everyone.

## ✨ Main Features

### 🏠 Device Management
- **Automatic Discovery** : Automatic detection and addition of Zigbee devices
- **Multi-device Support** : Lights, switches, sensors, thermostats, etc.
- **Room Organization** : Group your devices by room for better organization
- **Real-time Control** : Turn on/off, adjust brightness and color
- **Live Status** : Track the status of all your devices via WebSocket

### 🤖 Smart Automations
- **Natural Language Creation** : Create automations by simply speaking ("Turn on the living room light when I enter the room")
- **Visual Node Editor** : Create complex automations with an intuitive graphical editor
- **Various Triggers** :
  - Motion detection
  - Door/window opening/closing
  - Temperature
  - Sunrise/sunset
  - Scheduled time
  - Buttons
- **Multiple Actions** : Control multiple devices simultaneously
- **Execution History** : Track all executions of your automations

### 🧠 Artificial Intelligence
- **Local AI Assistant** : Uses Gemma3 via Ollama for 100% local processing
- **Natural Language Automation Creation** : Simply describe what you want
- **No Data Sent** : Everything stays on your server

### 📊 Dashboard
- **Overview** : Quick control of all your devices
- **Energy Consumption Graphs** : Track energy consumption of your devices
- **Integrated Weather** : Display local weather conditions
- **History** : Timeline of all events in your home

### 🔌 Plugin System
- **Extensibility** : Add new features via plugins
- **Complete API** : Easily develop your own plugins
- **Centralized Management** : Install, update, and uninstall plugins from the interface

### 🌐 Modern Interface
- **Material-UI Design** : Modern and intuitive interface
- **Multilingual** : French and English support
- **Responsive** : Accessible from any device
- **Real-time** : Instant updates via WebSocket

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- A Zigbee coordinator (e.g., CC2531, CC2652, etc.)
- Linux (Debian/Ubuntu recommended)

### Automatic Installation

```bash
# Download the installation script
wget https://raw.githubusercontent.com/votre-repo/lumy-home/main/scripts/install.sh

# Make it executable
chmod +x install.sh

# Run the installation
sudo ./install.sh
```

### Manual Installation

1. **Clone the repository**
```bash
git clone https://github.com/votre-repo/lumy-home.git
cd lumy-home
```

2. **Configure environment variables**
```bash
# Copy example files
cp backend/env.example.prod backend/.env
cp frontend/env.example.prod frontend/.env

# Edit .env files according to your needs
```

3. **Create Docker network**
```bash
docker network create lumy-network
```

4. **Start services**
```bash
docker-compose up -d
```

5. **Access the interface**
Open your browser at: `http://localhost`

## 📖 Documentation

### Configuration

- [Network Setup](doc/NETWORK_SETUP.md)
- [Environment Variables](doc/ENV_SETUP.md)
- [Zigbee2MQTT Configuration](data/zigbee2mqtt/configuration.yaml)

### Development

- [Backend API](backend/README.md)
- [Frontend](frontend/README.md)
- [Plugin System](backend/plugins/API.md)
- [Automations](backend/src/automations/README.md)

## 🏗️ Architecture

Lumy Home consists of several Docker services:

- **Frontend** : React interface with Material-UI (port 80)
- **Backend** : NestJS API (port 3000)
- **Zigbee2MQTT** : Zigbee manager (port 8080)
- **Mosquitto** : MQTT broker
- **Ollama** : Local AI server (port 11434)

## 🔧 Configuration

### Zigbee Coordinator

Make sure your Zigbee coordinator is connected and accessible via `/dev/ttyUSB0` (or modify the path in `docker-compose.yml`).

### Network

By default, services communicate via a private Docker network. For local development, you can uncomment the ports in `docker-compose.yml`.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Open an issue to report a bug
- Propose a new feature
- Submit a pull request

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Zigbee2MQTT](https://www.zigbee2mqtt.io/) for Zigbee management
- [NestJS](https://nestjs.com/) for the backend framework
- [React](https://react.dev/) for the frontend framework
- [Ollama](https://ollama.ai/) for local AI

