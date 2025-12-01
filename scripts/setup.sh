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

# Déterminer le répertoire de base du projet
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
Z2MQTT_DIR="$PROJECT_ROOT/homehub"
MOSQUITTO_CONFIG_DIR="$Z2MQTT_DIR/mosquitto/config"
Z2MQTT_DATA_DIR="$Z2MQTT_DIR/data"

info "Démarrage de la configuration de Mosquitto et Zigbee2MQTT..."

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
warn "⚠️  Note: Les clés réseau ont été générées aléatoirement."
warn "⚠️  Si vous avez déjà un réseau Zigbee, vous devrez utiliser les mêmes clés."
echo ""
success "Configuration terminée avec succès !"

