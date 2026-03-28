#!/usr/bin/env bash
set -euo pipefail

# Script d'installation Lumy Home
# Ce script installe tous les prérequis nécessaires pour Lumy Home

# Variables
LUMY_DIR_WORKING="/opt/lumy"
LOGS_DIR="$LUMY_DIR_WORKING/logs"
LSB_DIST="$(. /etc/os-release && echo "$ID")"

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

create_lumy_home_directory() {
    info "Création du dossier /opt/${LUMY_DIR_WORKING}..."
    mkdir -p ${LUMY_DIR_WORKING}
    chmod 755 ${LUMY_DIR_WORKING}
    mkdir -p ${LUMY_DIR_WORKING}/logs
    chmod 755 ${LUMY_DIR_WORKING}/logs
    chown -R $(whoami):$(whoami) ${LUMY_DIR_WORKING}
}

detect_architecture_type() {
    # Fonction pour détecter le type d'installation
    info "Détection de l'architecture..."
    ARCHITECTURE=$(dpkg --print-architecture)
    if [ "$ARCHITECTURE" = "amd64" ]; then
        ARCHITECTURE="x86_64"
    elif [ "$ARCHITECTURE" = "arm64" ]; then
        ARCHITECTURE="aarch64"
    elif [ "$ARCHITECTURE" = "armhf" ]; then
        ARCHITECTURE="armv7"
    fi
}

info "Démarrage de l'installation de Lumy Home..."

# 1. Mise à jour de l'OS
info "Mise à jour de la liste des paquets..."
apt-get update -y

info "Mise à niveau de l'OS..."
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y

install_base_packages() {
    # 2. Installation des prérequis de base
    info "Installation des prérequis de base (xz, curl, ca-certificates, gnupg, lsb-release)..."
    apt-get install -y \
        xz-utils \
        curl \
        ca-certificates \
        gnupg \
        lsb-release | tee -a "$LOGS_DIR/install.log"
}


# 3. Installation de Docker CE officiel
info "Installation de Docker CE officiel..."

uninstall_docker() {
    info "Désinstallation de Docker CE officiel..."
    apt-get remove -y docker docker-engine docker.io containerd runc
    apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    apt-get autoremove -y
    apt-get clean
    rm -rf /var/lib/docker
    rm -rf /var/lib/containerd

    DOCKER_INSTALLED="false"
}

# Vérifier si Docker est déjà installé
check_docker_installation() {
    if command -v docker &> /dev/null; then
        warn "Docker est déjà installé, desinstallation en cours..."
        uninstall_docker
    else
        DOCKER_INSTALLED="false"
    fi
}

add_docker_repo() {

    # Add Docker GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "https://download.docker.com/linux/${LSB_DIST}/gpg" -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add the repository to APT sources
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${LSB_DIST} $(lsb_release -cs) stable" |
        tee /etc/apt/sources.list.d/docker.list >/dev/null

    apt-get update -y
}


install_docker() {
    # 4. Installation de Docker Compose officiel (standalone)
    info "Installation de Docker Compose officiel (standalone)..."

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin | tee -a "$LOGS_DIR/install.log"

    # Vérifier si xz est installé
    [ -f "/usr/bin/xz" ] || (apt-get install -y xz-utils)

    groupadd -f docker | tee -a "$LOGS_DIR/install.log"
    chown root:docker /var/run/docker.sock | tee -a "$LOGS_DIR/install.log"
    usermod -a -G docker "$(whoami)" | tee -a "$LOGS_DIR/install.log"
    newgrp docker | tee -a "$LOGS_DIR/install.log"

    # Vérifier si l'utilisateur est créé avant d'exécuter les late-commands
    # Démarrer et activer Docker
    systemctl enable docker
    systemctl start docker

    DOCKER_INSTALLED="true"
}


hostname_configuration() {
    # 5. Changer le hostname en "Lumy Home"
    info "Configuration du hostname en 'Lumy Home'..."
    CURRENT_HOSTNAME=$(hostname)
    if [ "$CURRENT_HOSTNAME" != "lumy-home" ]; then
        hostnamectl set-hostname lumy-home
        # Mettre à jour /etc/hosts
        sed -i "s/127.0.1.1.*${CURRENT_HOSTNAME}/127.0.1.1\tlumy-home/" /etc/hosts 2>/dev/null || true
        info "Hostname changé de '${CURRENT_HOSTNAME}' vers 'lumy-home'"
        warn "Un redémarrage est recommandé pour que le changement de hostname prenne effet complètement"
    else
        info "Le hostname est déjà configuré sur 'lumy-home'"
    fi
}

# 7. Télécharger et extraire Lumy Home-core.tar.gz
#info "Téléchargement de lumy-home-core..."
# Déterminer la version du package
#LUMY_HOME_VERSION=$(curl -s https://api.github.com/repos/your-repo/Lumy Home/releases/latest | grep -o '"tag_name": "[^"]*"' | cut -d'"' -f4)

# URL du package (à adapter selon votre source)
#LUMY_HOME_PACKAGE_URL="${LUMY_HOME_PACKAGE_URL:-https://github.com/your-repo/Lumy Home/releases/latest/download/Lumy Home-core.tar.gz}"
#PACKAGE_NAME="lumy-home-core-v${LUMY_HOME_VERSION}.tar.gz"
#TEMP_DIR=$(mktemp -d)

# Télécharger le package
#if curl -L -f -o "${TEMP_DIR}/${PACKAGE_NAME}" "${LUMY_HOME_PACKAGE_URL}"; then
#    info "Package téléchargé avec succès"
#else
#    error "Échec du téléchargement du package depuis ${LUMY_HOME_PACKAGE_URL}"
#    error "Vous pouvez définir LUMY_HOME_PACKAGE_URL pour spécifier une URL personnalisée"
#    error "Exemple: LUMY_HOME_PACKAGE_URL=https://example.com/Lumy Home-core.tar.gz ./install.sh"
#    rm -rf "${TEMP_DIR}"
#    exit 1
#fi

# Vérifier que le fichier est un archive tar.xz valide
#if ! tar -tzf "${TEMP_DIR}/${PACKAGE_NAME}" >/dev/null 2>&1; then
    #    error "Le fichier téléchargé n'est pas une archive tar.gz valide"
#    rm -rf "${TEMP_DIR}"
#    exit 1
#fi

# Extraire le package dans /etc/lumy
#info "Extraction du package dans /etc/${LUMY_DIR}..."
#tar -xzf "${TEMP_DIR}/${PACKAGE_NAME}" -C /etc/${LUMY_DIR} --strip-components=1

# Nettoyer le fichier temporaire
#rm -rf "${TEMP_DIR}"

# Vérifier que l'extraction a réussi
#if [ -d "/etc/${LUMY_DIR}" ] && [ "$(ls -A /etc/${LUMY_DIR})" ]; then
#    info "Package extrait avec succès dans /etc/${LUMY_DIR}"
#    ls -la /etc/${LUMY_DIR}
#else
#    error "L'extraction du package a échoué"
#    exit 1
#fi

start_prerequisites_installation() {

    create_lumy_home_directory
    #detect_architecture_type
    install_base_packages
    check_docker_installation
    if [ "$DOCKER_INSTALLED" = "false" ]; then
        add_docker_repo
        install_docker
    fi
    hostname_configuration

    info "Démarrage de l'installation de Lumy Home..."
    info "Installation de Lumy Home terminée !"
    info "=========================================="
    echo ""
    info "Résumé:"
    info "  ✓ OS mis à jour et upgradé"
    info "  ✓ xz installé"
    info "  ✓ Docker CE installé: $(docker --version)"
    info "  ✓ Docker Compose installé: $(docker compose --version)"
    info "  ✓ Hostname configuré: $(hostname)"
    info "  ✓ Prérequis pour Lumy Home installés"
}

start_prerequisites_installation
