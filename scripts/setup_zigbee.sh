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

# Générer un UUID v7 aléatoire
generate_uuid_v7() {
    ts_hex=$(printf '%012x' $(date +%s%3N))
    rand_hex=$(openssl rand -hex 10)
    echo "${ts_hex:0:8}-${ts_hex:8:4}-7${rand_hex:1:3}-$(printf '%x' $(( (0x${rand_hex:4:2} & 0x3f) | 0x80 )) )${rand_hex:6:2}-${rand_hex:8:12}"
}

BOX_ID=$(generate_uuid_v7)

# Génère une ligne passwd Mosquitto 2.x ($7$ = PBKDF2-HMAC-SHA512) :
# sel aléatoire 12 octets, itérations 101 (défaut mosquitto 2.0.x), sel et hash en base64.
write_mosquitto_passwd_entry() {
    local user="$1"
    local password="$2"
    local passwd_file="$3"
    MQTT_USER="$user" MQTT_PASSWORD="$password" PASSWD_FILE="$passwd_file" python3 <<'PY'
import base64
import hashlib
import os
import secrets

user = os.environ["MQTT_USER"]
password = os.environ["MQTT_PASSWORD"].encode("utf-8")
path = os.environ["PASSWD_FILE"]

salt = secrets.token_bytes(12)
iterations = 101
dk = hashlib.pbkdf2_hmac("sha512", password, salt, iterations, dklen=64)
salt_b64 = base64.b64encode(salt).decode("ascii")
hash_b64 = base64.b64encode(dk).decode("ascii")
line = "%s:$7$%d$%s$%s\n" % (user, iterations, salt_b64, hash_b64)

fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
try:
    os.write(fd, line.encode("utf-8"))
finally:
    os.close(fd)
PY
}

info "Démarrage de la configuration de Mosquitto et Zigbee2MQTT..."

# Créer les dossiers système dans /opt/lumy
info "Création des dossiers système dans /opt/lumy..."
LUMYHOME_DIR="/opt/lumy"
LUMYHOME_DIR_DATA_DIR="$LUMYHOME_DIR/data"
LUMYHOME_DIR_LOG_DIR="$LUMYHOME_DIR/logs"
LUMYHOME_DIR_AGENT_DIR="$LUMYHOME_DIR_DATA_DIR/agent"

# Déterminer le répertoire de base du projet
Z2MQTT_DIR="$LUMYHOME_DIR_DATA_DIR/zigbee2mqtt"
MOSQUITTO_CONFIG_DIR="$LUMYHOME_DIR_DATA_DIR/mosquitto/config"
Z2MQTT_CONFIG_FILE="$Z2MQTT_DIR/configuration.yaml"

# Vérifier les permissions root pour créer dans /opt
if [ "$EUID" -ne 0 ]; then
    warn "Les permissions root sont nécessaires pour créer les dossiers dans /opt/lumy"
    warn "Le script va tenter de créer les dossiers avec sudo..."
    SUDO_CMD="sudo"
else
    SUDO_CMD=""
fi

# Créer le dossier principal
if [ ! -d "$LUMYHOME_DIR" ]; then
    $SUDO_CMD mkdir -p "$LUMYHOME_DIR"
    success "Dossier $LUMYHOME_DIR créé"
else
    info "Dossier $LUMYHOME_DIR existe déjà"
fi

# Créer les sous-dossiers
for dir in "$LUMYHOME_DIR_DATA_DIR" "$LUMYHOME_DIR_LOG_DIR" "$Z2MQTT_DIR" "$LUMYHOME_DIR_AGENT_DIR"; do
    if [ ! -d "$dir" ]; then
        $SUDO_CMD mkdir -p "$dir"
        success "Dossier $dir créé"
    else
        info "Dossier $dir existe déjà"
    fi
done

# Définir les permissions appropriées (si on est root)
if [ "$EUID" -eq 0 ]; then
    $SUDO_CMD chown -R "$USER:$USER" "$LUMYHOME_DIR" 2>/dev/null || true
    $SUDO_CMD chmod -R 755 "$LUMYHOME_DIR"
    success "Permissions définies pour $LUMYHOME_DIR"
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
mkdir -p "$Z2MQTT_DIR"
mkdir -p "$LUMYHOME_DIR_DATA_DIR/mosquitto/data"
mkdir -p "$LUMYHOME_DIR_DATA_DIR/mosquitto/log"

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
    if ! command -v python3 &> /dev/null; then
        error "python3 est requis pour générer le fichier passwd (PBKDF2-SHA512, format Mosquitto \$7\$)."
        exit 1
    fi
    info "Génération du mot de passe pour l'utilisateur $MQTT_USER (PBKDF2-SHA512)..."
    MQTT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

    write_mosquitto_passwd_entry "$MQTT_USER" "$MQTT_PASSWORD" "$MOSQUITTO_CONFIG_DIR/passwd"
    
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

# Verifier si le port USB0 est disponible
if [ -c "/dev/ttyUSB0" ]; then
    info "Module Zigbee2MQTT détecté sur le port USB0."
    PORT_ZIGBEE="/dev/ttyUSB0"

elif [ -c "/dev/ttyAMA0" ]; then
    info "Module Zigbee2MQTT détecté sur le port AMA0."
    PORT_ZIGBEE="/dev/ttyAMA0"
else
    error "Aucun module Zigbee2MQTT détecté sur le port /dev/ttyUSB0 ou /dev/ttyAMA0. Veuillez connecter un module Zigbee2MQTT à votre ordinateur."
    exit 1
fi

# Sélectionner le type d'adapter Zigbee2MQTT
info "Sélection du type de coordinateur Zigbee2MQTT..."
echo ""
echo "Options disponibles :"
echo "  1) ember   - Ember (EZSP)"
echo "  2) zstack  - Z-Stack"
echo "  3) deconz  - deConz"
echo "  4) zigate  - Zigate"
echo ""
warn "Veuillez sélectionner le type de coordinateur (1-4) :"
read -r adapter_choice

# Valider et convertir le choix en nom d'adapter
case $adapter_choice in
    1)
        ADAPTER="ember"
        info "Type de coordinateur sélectionné : Ember (EZSP)"
        ;;
    2)
        ADAPTER="zstack"
        info "Type de coordinateur sélectionné : Z-Stack"
        ;;
    3)
        ADAPTER="deconz"
        info "Type de coordinateur sélectionné : deConz"
        ;;
    4)
        ADAPTER="zigate"
        info "Type de coordinateur sélectionné : Zigate"
        ;;
    *)
        warn "Choix invalide. Utilisation de Zigate par défaut."
        ADAPTER="zigate"
        ;;
esac

# Créer le fichier configuration.yml
info "Création du fichier configuration.yml pour Zigbee2MQTT..."
cat > "$Z2MQTT_CONFIG_FILE" << EOF
version: 4
mqtt:
  base_topic: zigbee2mqtt
  server: mqtt://mosquitto:1883
  user: mqtt
  password: $MQTT_PASSWORD
serial:
  port: $PORT_ZIGBEE
  adapter: $ADAPTER
  baudrate: 115200
  rtscts: true
advanced:
  log_level: info
  channel: 11
  network_key:
$NETWORK_KEY_YAML
  pan_id: $PAN_ID_DECIMAL
  ext_pan_id:
$EXT_PAN_ID_YAML
frontend:
  enabled: false
  port: 8080
homeassistant:
  enabled: false
onboarding: false
EOF

success "Fichier configuration.yml créé avec succès"

# 3. Configuration Backend .env
info "Configuration du fichier .env pour le backend..."



# Créer le dossier backend dans /opt/lumy/data si nécessaire
BACKEND_ENV_DIR="$LUMYHOME_DIR_DATA_DIR/backend"
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

NODE_ENV=production
PORT=3000
FRONTEND_URL=http://lumy-frontend:80

# Database
DATABASE_PATH=data/lumy.db

# MQTT (Zigbee2MQTT)
MQTT_BROKER_URL=mqtt://mosquitto:1883
MQTT_USERNAME=mqtt
MQTT_PASSWORD=$MQTT_PASSWORD
MQTT_CLIENT_ID=lumy
MQTT_RECONNECT_PERIOD=5000

# Logging
# debug | info | warn | error
LOG_LEVEL=info

# Auth
# Changez cette clé en production !
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d
ENABLE_LOCAL_MODE=true

# Box ID
BOX_ID=$BOX_ID

# Store
STORE_BASE_URL=https://store.lumy-home.com

# Updater
UPDATER_URL=http://lumy-updater:3411

EOF

chmod 600 "$BACKEND_ENV_FILE"
success "Fichier .env créé pour le backend avec succès"

# 4. Configuration Agent .env
info "Configuration du fichier .env pour l'agent..."

# Créer le dossier agent dans /opt/lumy/data si nécessaire
AGENT_ENV_DIR="$LUMYHOME_DIR_DATA_DIR/agent"
if [ ! -d "$AGENT_ENV_DIR" ]; then
    $SUDO_CMD mkdir -p "$AGENT_ENV_DIR"
    success "Dossier $AGENT_ENV_DIR créé"
fi

AGENT_ENV_FILE="$AGENT_ENV_DIR/.env"

# Créer le fichier .env pour l'agent
info "Création du fichier .env pour l'agent dans $AGENT_ENV_FILE..."
cat > "$AGENT_ENV_FILE" << EOF
NODE_ENV=production

# WebSocket broker (inclure le chemin /tunnel/agent)
BROKER_WSS_URL=wss://broker.lumy-home.com/tunnel/agent

# Même secret et issuer que le broker (signature JWT device côté agent)
BROKER_JWT_SECRET=0123456789abcdef0123456789abcdef
BROKER_JWT_ISSUER=lumy-broker

# Identifiant stable de la box (claim box_id)
BOX_ID=$BOX_ID

# UI Lumy Home via service Docker frontend
LOCAL_UI_URL=http://lumy-frontend:80

LOG_LEVEL=info
HEARTBEAT_INTERVAL_MS=30000
RECONNECT_MAX_MS=60000
EOF


# Télécharger le fichier docker-compose.yml lumy Home
wget https://raw.githubusercontent.com/zelix25/lumy-home/master/docker-compose.yml -O "$LUMYHOME_DIR/docker-compose.yml"
success "Fichier docker-compose.yml téléchargé avec succès"
sudo chmod 644 "$LUMYHOME_DIR/docker-compose.yml"

cd "$LUMYHOME_DIR"
docker compose up -d
success "Lumy Home démarré avec succès"

# Récupérer l'IP de la box
IP_BOX=$(hostname -I | awk '{print $1}')
if [ -z "$IP_BOX" ]; then
    error "Impossible de récupérer l'IP de la box"
    exit 1
fi

# Redémarre lumy-backend
info "Redémarrage de lumy-backend..."
docker compose down backend
docker compose up -d backend
success "lumy-backend redémarré avec succès"

# Afficher un résumé
echo ""
info "=== Résumé de la configuration ==="
success "Mosquitto configuré:"
echo "  - Fichier de configuration: $MOSQUITTO_CONFIG_DIR/mosquitto.conf"
echo "  - Fichier de mots de passe: $MOSQUITTO_CONFIG_DIR/passwd"
echo "  - Utilisateur: $MQTT_USER"
echo ""
success "Zigbee2MQTT configuré:"
echo "  - Fichier de configuration: $Z2MQTT_CONFIG_FILE"
echo "  - Canal Zigbee: 11"
echo "  - PAN ID: $PAN_ID_DECIMAL (0x$PAN_ID_HEX)"
echo "  - Utilisateur MQTT: $MQTT_USER"
echo ""
success "Backend configuré:"
echo "  - Fichier .env: $BACKEND_ENV_FILE"
echo "  - JWT Secret généré automatiquement"
echo ""
success "Agent configuré:"
echo "  - Fichier .env: $AGENT_ENV_FILE"
echo "  - JWT Secret généré automatiquement"
echo ""
warn "⚠️  Note: Les clés réseau ont été générées aléatoirement."
warn "⚠️  Si vous avez déjà un réseau Zigbee, vous devrez utiliser les mêmes clés."
warn "⚠️  Le fichier .env contient des informations sensibles. Ne le partagez pas !"
echo ""
success "Lumy Home est disponible à l'adresse http://lumy-home.local" ou "http://$IP_BOX"
success "Configuration terminée avec succès !"

reboot

