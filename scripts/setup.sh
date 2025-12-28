#!/usr/bin/env bash
set -euo pipefail

# Script de configuration pour Mosquitto et Zigbee2MQTT
# Ce script configure Mosquitto et génère la configuration Zigbee2MQTT

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

success() {
    echo -e "${BLUE}✅ $1${NC}"
}

info "Démarrage de la configuration de Mosquitto et Zigbee2MQTT..."

# Créer les dossiers système dans /opt/exohome
info "Création des dossiers système dans /opt/exohome..."
EXOHOME_DIR="/opt/exohome"
EXOHOME_DATA_DIR="$EXOHOME_DIR/data"

# Déterminer le répertoire de base du projet
Z2MQTT_DIR="$EXOHOME_DATA_DIR/zigbee2mqtt"
MOSQUITTO_CONFIG_DIR="$EXOHOME_DATA_DIR/mosquitto/config"
Z2MQTT_DATA_DIR="$Z2MQTT_DIR/data"

# Vérifier les permissions root pour créer dans /opt
if [ "$EUID" -ne 0 ]; then
    warn "Les permissions root sont nécessaires pour créer les dossiers dans /opt/exohome"
    warn "Le script va tenter de créer les dossiers avec sudo..."
    SUDO_CMD="sudo"
else
    SUDO_CMD=""
fi

# Créer le dossier principal
if [ ! -d "$EXOHOME_DIR" ]; then
    $SUDO_CMD mkdir -p "$EXOHOME_DIR"
    success "Dossier $EXOHOME_DIR créé"
else
    info "Dossier $EXOHOME_DIR existe déjà"
fi

# Créer les sous-dossiers
for dir in "$EXOHOME_DATA_DIR" "$EXOHOME_CONFIG_DIR" "$EXOHOME_LOG_DIR"; do
    if [ ! -d "$dir" ]; then
        $SUDO_CMD mkdir -p "$dir"
        success "Dossier $dir créé"
    else
        info "Dossier $dir existe déjà"
    fi
done

# Définir les permissions appropriées (si on est root)
if [ "$EUID" -eq 0 ]; then
    $SUDO_CMD chown -R "$USER:$USER" "$EXOHOME_DIR" 2>/dev/null || true
    $SUDO_CMD chmod -R 755 "$EXOHOME_DIR"
    success "Permissions définies pour $EXOHOME_DIR"
fi

# Vérifier que Docker est installé et en cours d'exécution
if ! command -v docker &> /dev/null; then
    error "Docker n'est pas installé. Veuillez installer Docker pour continuer."
    exit 1
fi

if ! docker info &> /dev/null; then
    error "Docker n'est pas en cours d'exécution. Veuillez démarrer Docker pour continuer."
    exit 1
fi

info "Docker est disponible et en cours d'exécution"

# Créer les répertoires si nécessaire
info "Création des répertoires de configuration..."
mkdir -p "$MOSQUITTO_CONFIG_DIR"
mkdir -p "$Z2MQTT_DATA_DIR"
mkdir -p "$Z2MQTT_DIR/mosquitto/data"
mkdir -p "$Z2MQTT_DIR/mosquitto/log"

# 1. Configuration Mosquitto
info "Configuration de Mosquitto..."

# Générer un mot de passe aléatoire pour l'utilisateur mqtt
MQTT_USER="mqtt"
if [ -f "$MOSQUITTO_CONFIG_DIR/passwd" ]; then
    warn "Le fichier passwd existe déjà. Voulez-vous le régénérer ? (y/N)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        info "Régénération du mot de passe..."
        rm -f "$MOSQUITTO_CONFIG_DIR/passwd"
    else
        info "Conservation du fichier passwd existant."
    fi
fi

if [ ! -f "$MOSQUITTO_CONFIG_DIR/passwd" ]; then
    info "Génération du mot de passe pour l'utilisateur $MQTT_USER via Docker..."
    MQTT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Créer le fichier passwd avec mosquitto_passwd via Docker
    # Utiliser un conteneur temporaire pour générer le fichier passwd
    docker run --rm \
        -v "$MOSQUITTO_CONFIG_DIR:/mosquitto/config" \
        eclipse-mosquitto:2 \
        mosquitto_passwd -c -b /mosquitto/config/passwd "$MQTT_USER" "$MQTT_PASSWORD"
    
    # Vérifier que le fichier a été créé
    if [ ! -f "$MOSQUITTO_CONFIG_DIR/passwd" ]; then
        error "Échec de la génération du fichier passwd"
        exit 1
    fi
    
    success "Mot de passe généré pour l'utilisateur $MQTT_USER"
    warn "Mot de passe MQTT: $MQTT_PASSWORD"
    warn "⚠️  IMPORTANT: Notez ce mot de passe, il sera utilisé pour Zigbee2MQTT"
    echo ""
    echo "Mot de passe MQTT: $MQTT_PASSWORD" > "$MOSQUITTO_CONFIG_DIR/mqtt_credentials.txt"
    chmod 600 "$MOSQUITTO_CONFIG_DIR/mqtt_credentials.txt"
    info "Les identifiants ont été sauvegardés dans: $MOSQUITTO_CONFIG_DIR/mqtt_credentials.txt"
else
    info "Récupération du mot de passe depuis le fichier existant..."
    # Extraire le mot de passe depuis le fichier passwd (si possible)
    if [ -f "$MOSQUITTO_CONFIG_DIR/mqtt_credentials.txt" ]; then
        MQTT_PASSWORD=$(grep "Mot de passe MQTT:" "$MOSQUITTO_CONFIG_DIR/mqtt_credentials.txt" | cut -d' ' -f4)
        info "Mot de passe récupéré depuis mqtt_credentials.txt"
    else
        warn "Impossible de récupérer le mot de passe. Vous devrez le saisir manuellement."
        MQTT_PASSWORD=""
    fi
fi

# Créer le fichier mosquitto.conf
info "Création du fichier mosquitto.conf..."
cat > "$MOSQUITTO_CONFIG_DIR/mosquitto.conf" << 'EOF'
# Disable anonymous access
allow_anonymous false

# Point to password file
password_file /mosquitto/config/passwd

# Basic MQTT listener
listener 1883

# WebSocket listener
listener 9001
protocol websockets

# Persistence
persistence true
persistence_location /mosquitto/data/

# Logging
log_dest file /mosquitto/log/mosquitto.log
log_type error
log_type warning
log_type notice
log_type information
EOF

success "Fichier mosquitto.conf créé avec succès"

# 2. Configuration Zigbee2MQTT
info "Configuration de Zigbee2MQTT..."

# Générer les clés réseau Zigbee
info "Génération des clés réseau Zigbee..."

# Générer network_key (16 octets) - format tableau de 16 entiers décimaux
NETWORK_KEY_YAML=""
for i in {1..16}; do
    BYTE_HEX=$(openssl rand -hex 1)
    BYTE_DECIMAL=$((0x$BYTE_HEX))
    if [ $i -eq 1 ]; then
        NETWORK_KEY_YAML="    - $BYTE_DECIMAL"
    else
        NETWORK_KEY_YAML="$NETWORK_KEY_YAML"$'\n'"    - $BYTE_DECIMAL"
    fi
done

# Générer pan_id (2 octets) - valeur décimale entre 0x0001 et 0xFFFE
PAN_ID_HEX=$(openssl rand -hex 2)
# S'assurer que pan_id n'est pas 0x0000 ou 0xFFFF
while [ "$PAN_ID_HEX" = "0000" ] || [ "$PAN_ID_HEX" = "ffff" ]; do
    PAN_ID_HEX=$(openssl rand -hex 2)
done
PAN_ID_DECIMAL=$((0x$PAN_ID_HEX))

# Générer ext_pan_id (8 octets) - format tableau de 8 entiers décimaux
EXT_PAN_ID_YAML=""
for i in {1..8}; do
    BYTE_HEX=$(openssl rand -hex 1)
    BYTE_DECIMAL=$((0x$BYTE_HEX))
    if [ $i -eq 1 ]; then
        EXT_PAN_ID_YAML="    - $BYTE_DECIMAL"
    else
        EXT_PAN_ID_YAML="$EXT_PAN_ID_YAML"$'\n'"    - $BYTE_DECIMAL"
    fi
done

# Si le mot de passe n'a pas été récupéré, demander à l'utilisateur
if [ -z "$MQTT_PASSWORD" ]; then
    warn "Veuillez saisir le mot de passe MQTT pour Zigbee2MQTT:"
    read -s MQTT_PASSWORD
    echo ""
fi

# Créer le fichier configuration.yaml
info "Création du fichier configuration.yaml pour Zigbee2MQTT..."
cat > "$Z2MQTT_DATA_DIR/configuration.yaml" << EOF
version: 4
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://mosquitto:1883
  user: $MQTT_USER
  password: $MQTT_PASSWORD
serial:
  port: /dev/ttyUSB0
  adapter: zigate
  baudrate: 115200
  rtscts: false
advanced:
  log_level: info
  channel: 11
  network_key:
$NETWORK_KEY_YAML
  pan_id: $PAN_ID_DECIMAL
  ext_pan_id:
$EXT_PAN_ID_YAML
frontend:
  enabled: true
  port: 8080
homeassistant:
  enabled: false
onboarding: false
EOF

success "Fichier configuration.yaml créé avec succès"

# 3. Configuration Backend .env
info "Configuration du fichier .env pour le backend..."

# Créer le dossier backend dans /opt/exohome/data si nécessaire
BACKEND_ENV_DIR="$EXOHOME_DATA_DIR/backend"
if [ ! -d "$BACKEND_ENV_DIR" ]; then
    $SUDO_CMD mkdir -p "$BACKEND_ENV_DIR"
    success "Dossier $BACKEND_ENV_DIR créé"
    if [ "$EUID" -eq 0 ]; then
        $SUDO_CMD chown -R "$USER:$USER" "$BACKEND_ENV_DIR" 2>/dev/null || true
        $SUDO_CMD chmod -R 755 "$BACKEND_ENV_DIR"
    fi
else
    info "Dossier $BACKEND_ENV_DIR existe déjà"
fi

BACKEND_ENV_FILE="$BACKEND_ENV_DIR/.env"

# Générer un JWT secret aléatoire
JWT_SECRET=$(openssl rand -base64 64 | tr -d "=+/" | cut -c1-64)

# Créer le fichier .env pour le backend
info "Création du fichier .env pour le backend dans $BACKEND_ENV_FILE..."
cat > "$BACKEND_ENV_FILE" << EOF
# Application
# Renomer en .env

NODE_ENV=production
PORT=3000
FRONTEND_URL=http://exohome-frontend:80

# Database
DATABASE_PATH=data/exohome.db

# MQTT (Zigbee2MQTT)
MQTT_BROKER_URL=mqtt://mosquitto:1883
MQTT_USERNAME=exo
MQTT_PASSWORD=$MQTT_PASSWORD
MQTT_CLIENT_ID=exohome
MQTT_RECONNECT_PERIOD=5000

# Logging
# debug | info | warn | error
LOG_LEVEL=info

# AI (Gemma 3 via Ollama)
# Pour Docker, utilisez l'URL interne : http://ollama:11434
LLAMA_API_URL=http://localhost:11434
LLAMA_MODEL=gemma3
USE_LOCAL_LLAMA=true

# Auth
# Changez cette clé en production !
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
ENABLE_LOCAL_MODE=true
EOF

chmod 600 "$BACKEND_ENV_FILE"
success "Fichier .env créé pour le backend avec succès"

# Afficher un résumé
echo ""
info "=== Résumé de la configuration ==="
success "Mosquitto configuré:"
echo "  - Fichier de configuration: $MOSQUITTO_CONFIG_DIR/mosquitto.conf"
echo "  - Fichier de mots de passe: $MOSQUITTO_CONFIG_DIR/passwd"
echo "  - Utilisateur: $MQTT_USER"
echo ""
success "Zigbee2MQTT configuré:"
echo "  - Fichier de configuration: $Z2MQTT_DATA_DIR/configuration.yaml"
echo "  - Canal Zigbee: 11"
echo "  - PAN ID: $PAN_ID_DECIMAL (0x$PAN_ID_HEX)"
echo "  - Utilisateur MQTT: $MQTT_USER"
echo ""
success "Backend configuré:"
echo "  - Fichier .env: $BACKEND_ENV_FILE"
echo "  - JWT Secret généré automatiquement"
echo ""
warn "⚠️  Note: Les clés réseau ont été générées aléatoirement."
warn "⚠️  Si vous avez déjà un réseau Zigbee, vous devrez utiliser les mêmes clés."
warn "⚠️  Le fichier .env contient des informations sensibles. Ne le partagez pas !"
echo ""
success "Configuration terminée avec succès !"

