/**
 * Handler pour l'événement system:startup
 * Exécuté au démarrage du système
 */
module.exports = async function(event) {
  lumy.logger.info('Système démarré - Advanced Plugin prêt');
  
  // Récupérer les statistiques
  const devices = await lumy.devices.getAll();
  const automations = await lumy.automations.getAll();
  
  lumy.logger.info(`Système initialisé avec ${devices.length} appareil(s) et ${automations.length} automation(s)`);
};

