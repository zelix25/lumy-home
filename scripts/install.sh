#!/usr/bin/env bash
set -euo pipefail

# Script d'installation Lumy Home
# Ce script installe tous les prérequis nécessaires pour Lumy Home

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# Vérifier si le script est exécuté en root ou avec sudo
if [ "$EUID" -ne 0 ]; then 
    error "Ce script doit être exécuté en tant que root ou avec sudo"
    exit 1
fi

# Vérifier la distribution (Debian/Ubuntu)
if ! command -v apt-get &> /dev/null; then
    error "Ce script nécessite une distribution basée sur Debian/Ubuntu"
    exit 1
fi

info "Démarrage de l'installation de Lumy Home..."

# 1. Mise à jour de l'OS
info "Mise à jour de la liste des paquets..."
apt-get update -y

info "Mise à niveau de l'OS..."
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

# 2. Installation des prérequis de base
info "Installation des prérequis de base (xz, curl, ca-certificates, gnupg, lsb-release)..."
apt-get install -y \
    xz-utils \
    curl \
    ca-certificates \
    gnupg \
    lsb-release

# 3. Installation de Docker CE officiel
info "Installation de Docker CE officiel..."

# Vérifier si Docker est déjà installé
if command -v docker &> /dev/null; then
    warn "Docker est déjà installé, vérification de la version..."
    docker --version
else
    # Ajouter la clé GPG de Docker
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Ajouter le dépôt Docker
    tee /etc/apt/sources.list.d/docker.sources <<EOF
    Types: deb
    URIs: https://download.docker.com/linux/debian
    Suites: $(. /etc/os-release && echo "$VERSION_CODENAME")
    Components: stable
    Signed-By: /etc/apt/keyrings/docker.asc
    EOF

    # Mettre à jour la liste des paquets
    apt-get update -y

    # Installer Docker Engine, CLI, et containerd
    apt-get install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

    # Ajouter l'utilisateur courant au groupe docker
    usermod -aG docker $USER
    newgrp docker

    # Démarrer et activer Docker
    systemctl enable docker
    systemctl start docker

    info "Docker CE installé avec succès"
    docker --version

fi

# 4. Installation de Docker Compose officiel (standalone)
info "Installation de Docker Compose officiel (standalone)..."

DOCKER_COMPOSE_VERSION="v2.24.0"
DOCKER_COMPOSE_ARCH=$(uname -m)

# Déterminer l'architecture
case "$DOCKER_COMPOSE_ARCH" in
    x86_64)
        DOCKER_COMPOSE_ARCH="x86_64"
        ;;
    aarch64|arm64)
        DOCKER_COMPOSE_ARCH="aarch64"
        ;;
    armv7l|armhf)
        DOCKER_COMPOSE_ARCH="armv7"
        ;;
    *)
        error "Architecture non supportée: $DOCKER_COMPOSE_ARCH"
        exit 1
        ;;
esac

# Télécharger Docker Compose
DOCKER_COMPOSE_URL="https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-${DOCKER_COMPOSE_ARCH}"

if [ ! -f /usr/local/bin/docker-compose ] || [ "$(docker-compose version --short 2>/dev/null || echo '')" != "${DOCKER_COMPOSE_VERSION#v}" ]; then
    info "Téléchargement de Docker Compose ${DOCKER_COMPOSE_VERSION}..."
    curl -L "${DOCKER_COMPOSE_URL}" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    
    # Créer un lien symbolique pour compatibilité
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    info "Docker Compose installé avec succès"
    docker-compose --version
else
    warn "Docker Compose est déjà installé à la dernière version"
    docker-compose --version
fi

# 5. Changer le hostname en "Lumy Home"
info "Configuration du hostname en 'Lumy Home'..."
CURRENT_HOSTNAME=$(hostname)
if [ "$CURRENT_HOSTNAME" != "Lumy Home" ]; then
    hostnamectl set-hostname Lumy Home
    # Mettre à jour /etc/hosts
    sed -i "s/127.0.1.1.*${CURRENT_HOSTNAME}/127.0.1.1\tLumy Home/" /etc/hosts 2>/dev/null || true
    info "Hostname changé de '${CURRENT_HOSTNAME}' vers 'Lumy Home'"
    warn "Un redémarrage est recommandé pour que le changement de hostname prenne effet complètement"
else
    info "Le hostname est déjà configuré sur 'Lumy Home'"
fi

# 6. Créer le dossier /opt/Lumy Home
info "Création du dossier /opt/Lumy Home..."
mkdir -p /opt/Lumy Home
chmod 755 /opt/Lumy Home

# 7. Télécharger et extraire Lumy Home-core.tar.gz
info "Téléchargement de Lumy Home-core.tar.gz..."

# URL du package (à adapter selon votre source)
Lumy Home_PACKAGE_URL="${Lumy Home_PACKAGE_URL:-https://github.com/your-repo/Lumy Home/releases/latest/download/Lumy Home-core.tar.gz}"
PACKAGE_NAME="Lumy Home-core.tar.gz"
TEMP_DIR=$(mktemp -d)

# Télécharger le package
if curl -L -f -o "${TEMP_DIR}/${PACKAGE_NAME}" "${Lumy Home_PACKAGE_URL}"; then
    info "Package téléchargé avec succès"
else
    error "Échec du téléchargement du package depuis ${Lumy Home_PACKAGE_URL}"
    error "Vous pouvez définir Lumy Home_PACKAGE_URL pour spécifier une URL personnalisée"
    error "Exemple: Lumy Home_PACKAGE_URL=https://example.com/Lumy Home-core.tar.gz ./install.sh"
    rm -rf "${TEMP_DIR}"
    exit 1
fi

# Vérifier que le fichier est un archive tar.xz valide
if ! tar -tzf "${TEMP_DIR}/${PACKAGE_NAME}" >/dev/null 2>&1; then
    error "Le fichier téléchargé n'est pas une archive tar.gz valide"
    rm -rf "${TEMP_DIR}"
    exit 1
fi

# Extraire le package dans /opt/Lumy Home
info "Extraction du package dans /opt/Lumy Home..."
tar -xzf "${TEMP_DIR}/${PACKAGE_NAME}" -C /opt/Lumy Home --strip-components=1

# Nettoyer le fichier temporaire
rm -rf "${TEMP_DIR}"

# Vérifier que l'extraction a réussi
if [ -d "/opt/Lumy Home" ] && [ "$(ls -A /opt/Lumy Home)" ]; then
    info "Package extrait avec succès dans /opt/Lumy Home"
    ls -la /opt/Lumy Home
else
    error "L'extraction du package a échoué"
    exit 1
fi

# Résumé de l'installation
echo ""
info "=========================================="
info "Installation de Lumy Home terminée !"
info "=========================================="
echo ""
info "Résumé:"
info "  ✓ OS mis à jour et upgradé"
info "  ✓ xz installé"
info "  ✓ Docker CE installé: $(docker --version)"
info "  ✓ Docker Compose installé: $(docker-compose --version)"
info "  ✓ Hostname configuré: $(hostname)"
info "  ✓ Lumy Home installé dans: /opt/Lumy Home"
echo ""
warn "Note: Un redémarrage est recommandé pour que tous les changements prenne effet"
echo ""

