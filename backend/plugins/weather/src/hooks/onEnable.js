/**
 * Hook onEnable - Exécuté lors de l'activation du plugin
 * 
 * Ce hook est appelé chaque fois que le plugin est activé.
 * Utilisez-le pour démarrer les services, activer les listeners, etc.
 * 
 * @param {Object} context - Contexte du plugin
 * @param {string} context.pluginId - ID du plugin
 * @param {Object} context.config - Configuration du plugin
 * @param {Object} context.api - API du système Lumy Home
 */
module.exports = async function onEnable(context) {
  console.log(`[Weather Plugin] Activation du plugin météo (ID: ${context.pluginId})`);
  
  // Exemple : Démarrer la mise à jour périodique de la météo
  // const updateInterval = context.config.updateInterval || 30; // minutes
  // const intervalId = setInterval(async () => {
  //   await updateWeatherData(context);
  // }, updateInterval * 60 * 1000);
  // 
  // // Stocker l'ID de l'intervalle pour le nettoyer lors de la désactivation
  // context.api.setPluginData('weatherIntervalId', intervalId);
  
  return {
    success: true,
    message: 'Plugin météo activé',
  };
};

