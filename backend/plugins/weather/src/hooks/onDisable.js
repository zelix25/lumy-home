/**
 * Hook onDisable - Exécuté lors de la désactivation du plugin
 * 
 * Ce hook est appelé chaque fois que le plugin est désactivé.
 * Utilisez-le pour arrêter les services, nettoyer les ressources, etc.
 * 
 * @param {Object} context - Contexte du plugin
 * @param {string} context.pluginId - ID du plugin
 * @param {Object} context.config - Configuration du plugin
 * @param {Object} context.api - API du système Lumy Home
 */
module.exports = async function onDisable(context) {
  console.log(`[Weather Plugin] Désactivation du plugin météo (ID: ${context.pluginId})`);
  
  // Exemple : Arrêter la mise à jour périodique
  // const intervalId = context.api.getPluginData('weatherIntervalId');
  // if (intervalId) {
  //   clearInterval(intervalId);
  //   context.api.setPluginData('weatherIntervalId', null);
  // }
  
  return {
    success: true,
    message: 'Plugin météo désactivé',
  };
};

