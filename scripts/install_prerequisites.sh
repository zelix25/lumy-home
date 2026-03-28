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
    info "Installation de Docker..."

    apt-get install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin \
        | tee -a "$LOGS_DIR/install.log"

    # Vérifier si xz est installé
    if [ ! -f "/usr/bin/xz" ]; then
        apt-get install -y xz-utils | tee -a "$LOGS_DIR/install.log"
    fi

    # créer groupe docker si absent
    groupadd -f docker | tee -a "$LOGS_DIR/install.log"

    # ajouter lumy au groupe docker
    usermod -aG docker lumy | tee -a "$LOGS_DIR/install.log"

    # démarrer docker
    systemctl enable docker | tee -a "$LOGS_DIR/install.log"
    systemctl start docker | tee -a "$LOGS_DIR/install.log"

    DOCKER_INSTALLED="true"
    info "Docker installé. Reconnexion nécessaire pour que l'utilisateur lumy utilise docker sans sudo."
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
