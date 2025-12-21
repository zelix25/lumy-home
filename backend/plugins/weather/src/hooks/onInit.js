/**
 * Hook onInit - Exécuté lors de l'initialisation du plugin
 * 
 * Ce hook est appelé une seule fois lorsque le plugin est chargé en mémoire.
 * Utilisez-le pour initialiser les services, configurer les listeners, etc.
 * 
 * @param {Object} context - Contexte du plugin
 * @param {string} context.pluginId - ID du plugin
 * @param {Object} context.config - Configuration du plugin
 * @param {Object} context.api - API du système Lumy Home
 */
module.exports = async function onInit(context) {
  console.log(`[Weather Plugin] Initialisation du plugin météo (ID: ${context.pluginId})`);
  
  // Exemple : Enregistrer un listener pour les mises à jour de configuration
  // context.api.on('config:updated', (newConfig) => {
  //   console.log('Configuration mise à jour:', newConfig);
  // });
  
  // Exemple : Initialiser un service météo
  // const weatherService = new WeatherService(context.config);
  // await weatherService.initialize();
  
  return {
    success: true,
    message: 'Plugin météo initialisé avec succès',
  };
};

