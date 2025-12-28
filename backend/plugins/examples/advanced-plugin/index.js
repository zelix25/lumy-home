/**
 * Point d'entrée principal du plugin
 * 
 * Ce fichier est exécuté lors de l'activation du plugin
 */
let intervalId = null;
let config = null;

module.exports = {
  /**
   * Initialisation du plugin
   * @param {object} pluginConfig - Configuration du plugin
   */
  async init(pluginConfig) {
    config = pluginConfig;
    
    lumy.logger.info('Advanced Plugin initialisé');
    lumy.logger.info('Configuration:', {
      refreshInterval: config.refreshInterval,
      enableNotifications: config.enableNotifications,
      threshold: config.threshold
    });
    
    // Stocker la date de démarrage
    await lumy.storage.set('startTime', new Date().toISOString());
    
    // Démarrer un service périodique
    if (config.refreshInterval) {
      intervalId = setInterval(async () => {
        await this.checkDevices();
      }, config.refreshInterval * 1000);
      
      lumy.logger.info(`Service périodique démarré (intervalle: ${config.refreshInterval}s)`);
    }
    
    // Effectuer une vérification initiale
    await this.checkDevices();
  },
  
  /**
   * Vérifie l'état de tous les appareils
   */
  async checkDevices() {
    try {
      const devices = await lumy.devices.getAll();
      lumy.logger.debug(`Vérification de ${devices.length} appareil(s)`);
      
      // Filtrer les appareils avec température
      const sensors = devices.filter(d => d.state && d.state.temperature);
      
      for (const sensor of sensors) {
        const temp = sensor.state.temperature;
        
        // Vérifier le seuil
        if (temp > config.threshold) {
          lumy.logger.warn(`Température élevée détectée: ${sensor.name} à ${temp}°C`);
          
          if (config.enableNotifications) {
            await lumy.notifications.send({
              title: "Température élevée",
              message: `${sensor.name}: ${temp}°C (seuil: ${config.threshold}°C)`,
              level: "warning"
            });
          }
        }
      }
      
      // Stocker le dernier check
      await lumy.storage.set('lastCheck', new Date().toISOString());
      
    } catch (error) {
      lumy.logger.error('Erreur lors de la vérification des appareils', error);
    }
  },
  
  /**
   * Nettoyage lors de la désactivation
   */
  async destroy() {
    lumy.logger.info('Advanced Plugin en cours de désactivation');
    
    // Arrêter le service périodique
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    
    // Stocker la date de fin
    await lumy.storage.set('endTime', new Date().toISOString());
    
    lumy.logger.info('Advanced Plugin désactivé');
  }
};

