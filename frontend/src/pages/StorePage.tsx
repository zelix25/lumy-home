import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Search as SearchIcon,
  InstallDesktop as InstallIcon,
  CheckCircle as CheckCircleIcon,
  Store as StoreIcon,
  Info as InfoIcon,
  Delete as DeleteIcon,
  FilterList as FilterListIcon,
  MoreVert as MoreVertIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { pluginsService } from '../services/plugins.service';
import { storeService } from '../services/store.service';
import { useNotification } from '../hooks/useNotification';
import { useNavigate } from 'react-router-dom';

interface StorePlugin {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  author?: string;
  icon?: string;
  screenshots?: string[];
  price?: number;
  category?: string;
  installed?: boolean;
  installedPluginId?: string; // ID du plugin installé (pour la désinstallation)
  rating?: number;
  downloads?: number;
}

export default function StorePage() {
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState<StorePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showInstalledOnly, setShowInstalledOnly] = useState(false);
  const [connected, setConnected] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<StorePlugin | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [pluginToInstall, setPluginToInstall] = useState<StorePlugin | null>(null);
  const [uninstallDialogOpen, setUninstallDialogOpen] = useState(false);
  const [pluginToUninstall, setPluginToUninstall] = useState<StorePlugin | null>(null);
  const [settingsMenuAnchor, setSettingsMenuAnchor] = useState<null | HTMLElement>(null);
  const [settingsMenuPluginId, setSettingsMenuPluginId] = useState<string | null>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [pluginForSettings, setPluginForSettings] = useState<{ id: string; name: string; config: Record<string, any> } | null>(null);
  const [pluginConfig, setPluginConfig] = useState<Record<string, any>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    // Vérifier si lumy_store est présent dans le navigateur
    const lumyStore = localStorage.getItem('lumy_store');
    if (!lumyStore) {
      // Rediriger vers la page de connexion si le token n'est pas présent
      navigate('/store/connect', { replace: true });
      return;
    }
    checkConnectionAndLoadPlugins();
  }, [navigate]);

  useEffect(() => {
    // Charger les plugins même si l'utilisateur n'est pas connecté (endpoint public)
    loadPlugins();
  }, [search]);

  const checkConnectionAndLoadPlugins = async () => {
    try {
      // Vérifier la connexion au store (pour l'installation, pas pour l'affichage)
      const status = await storeService.getConnectionStatus();
      console.log('Statut de connexion au store:', status);
      setConnected(status.connected);
      // Charger les plugins même si non connecté (endpoint public)
      await loadPlugins();
    } catch (error) {
      console.error('Erreur lors de la vérification de la connexion:', error);
      setConnected(false);
      // Essayer quand même de charger les plugins (endpoint public)
      await loadPlugins();
    } finally {
      setLoading(false);
    }
  };

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const storePlugins = await pluginsService.getAvailablePluginsFromStore(
        search || undefined,
      );
      
      // Récupérer les plugins installés pour obtenir leurs IDs
      const installedPlugins = await pluginsService.getAllPlugins();
      const installedPluginsMap = new Map(
        installedPlugins.map((p) => [p.name, p.id])
      );
      
      // Enrichir les plugins du store avec les IDs des plugins installés
      const enrichedPlugins = (storePlugins || []).map((plugin: StorePlugin) => ({
        ...plugin,
        installedPluginId: installedPluginsMap.get(plugin.name),
        installed: !!installedPluginsMap.get(plugin.name),
      }));
      
      setPlugins(enrichedPlugins);
    } catch (error: any) {
      console.error('Erreur lors du chargement des plugins:', error);
      addNotification({
        message: error.message || t('store.plugins.loadError'),
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInstallClick = (plugin: StorePlugin) => {
    if (plugin.installed) {
      addNotification({
        message: t('store.plugins.alreadyInstalled'),
        type: 'info',
      });
      return;
    }

    // Vérifier la connexion avant d'installer
    if (!connected) {
      addNotification({
        message: t('store.plugins.installRequiresConnection'),
        type: 'warning',
      });
      navigate('/store/connect');
      return;
    }

    setPluginToInstall(plugin);
    setInstallDialogOpen(true);
  };

  const handleInstallConfirm = async () => {
    if (!pluginToInstall) return;

    try {
      setInstalling(pluginToInstall.id);
      await pluginsService.installFromStore(pluginToInstall.id);
      addNotification({
        message: t('store.plugins.installSuccess', { name: pluginToInstall.displayName }),
        type: 'success',
      });
      // Recharger les plugins pour mettre à jour le statut
      await loadPlugins();
    } catch (error: any) {
      console.error('Erreur lors de l\'installation:', error);
      addNotification({
        message: error.message || t('store.plugins.installError'),
        type: 'error',
      });
    } finally {
      setInstalling(null);
      setInstallDialogOpen(false);
      setPluginToInstall(null);
    }
  };

  const handleUninstall = async (plugin: StorePlugin) => {
    if (!plugin.installedPluginId) {
      addNotification({
        message: t('store.plugins.uninstallError'),
        type: 'error',
      });
      return;
    }

    try {
      setUninstalling(plugin.id);
      
      // Désactiver le plugin avant la désinstallation
      try {
        await pluginsService.disable(plugin.installedPluginId);
        addNotification({
          message: t('store.plugins.disableSuccess', { name: plugin.displayName }),
          type: 'info',
        });
      } catch (disableError: any) {
        // Si la désactivation échoue, continuer quand même avec la désinstallation
        console.warn('Erreur lors de la désactivation du plugin:', disableError);
      }
      
      // Désinstaller le plugin
      await pluginsService.uninstall(plugin.installedPluginId);
      addNotification({
        message: t('store.plugins.uninstallSuccess', { name: plugin.displayName }),
        type: 'success',
      });
      // Recharger les plugins pour mettre à jour le statut
      await loadPlugins();
    } catch (error: any) {
      console.error('Erreur lors de la désinstallation:', error);
      addNotification({
        message: error.message || t('store.plugins.uninstallError'),
        type: 'error',
      });
    } finally {
      setUninstalling(null);
      setUninstallDialogOpen(false);
      setPluginToUninstall(null);
    }
  };

  const handleUninstallClick = (plugin: StorePlugin) => {
    setPluginToUninstall(plugin);
    setUninstallDialogOpen(true);
  };

  const handleViewDetails = (plugin: StorePlugin) => {
    setSelectedPlugin(plugin);
    setDialogOpen(true);
  };

  // Fonction helper pour construire l'URL complète avec VITE_STORE_URL
  const getStoreUrl = (path?: string): string | undefined => {
    if (!path) return undefined;
    // Si l'URL est déjà absolue (commence par http:// ou https://), la retourner telle quelle
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    // Sinon, préfixer avec VITE_STORE_URL
    const storeUrl = import.meta.env.VITE_STORE_URL || '';
    if (!storeUrl) return path;
    // S'assurer que storeUrl se termine par / et que path ne commence pas par /
    const cleanStoreUrl = storeUrl.endsWith('/') ? storeUrl.slice(0, -1) : storeUrl;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    // Si storeUrl ne contient pas de protocole, ajouter http://
    if (!cleanStoreUrl.startsWith('http://') && !cleanStoreUrl.startsWith('https://')) {
      return `http://${cleanStoreUrl}${cleanPath}`;
    }
    return `${cleanStoreUrl}${cleanPath}`;
  };

  // Ne plus bloquer l'affichage si non connecté, mais afficher un avertissement

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <StoreIcon sx={{ fontSize: 32 }} />
        <Typography variant="h4" component="h1">
          {t('store.plugins.title')}
        </Typography>
      </Stack>

      {!connected && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => navigate('/store/connect')}
            >
              {t('store.connect.button')}
            </Button>
          }
        >
          {t('store.plugins.notConnectedWarning')}
        </Alert>
      )}

      <Box sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            fullWidth
            placeholder={t('store.plugins.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant={showInstalledOnly ? 'contained' : 'outlined'}
            startIcon={<FilterListIcon />}
            onClick={() => setShowInstalledOnly(!showInstalledOnly)}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {t('store.plugins.showInstalledOnly')}
          </Button>
        </Stack>
      </Box>

      {loading ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <CircularProgress />
        </Box>
      ) : plugins.length === 0 ? (
        <Alert severity="info">{t('store.plugins.noPlugins')}</Alert>
      ) : (
        <Grid container spacing={3}>
          {plugins
            .filter((plugin) => !showInstalledOnly || plugin.installed)
            .map((plugin) => (
            <Grid item xs={12} sm={6} md={4} key={plugin.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {plugin.icon ? (
                      <Box
                        component="img"
                        src={getStoreUrl(plugin.icon)}
                        alt={plugin.displayName}
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: 1,
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: 1,
                          bgcolor: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                        }}
                      >
                        <StoreIcon />
                      </Box>
                    )}
                    <Box sx={{ flexGrow: 1, position: 'relative' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography variant="h6" component="h3" gutterBottom sx={{ flexGrow: 1 }}>
                          {plugin.displayName}
                        </Typography>
                        {plugin.installed && plugin.installedPluginId && (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setSettingsMenuAnchor(e.currentTarget);
                              setSettingsMenuPluginId(plugin.installedPluginId || null);
                            }}
                            sx={{ mt: -1, mr: -1 }}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        )}
                      </Stack>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1 }}
                      >
                        {plugin.description?.substring(0, 100)}
                        {plugin.description?.length > 100 ? '...' : ''}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        {plugin.category && (
                          <Chip
                            label={plugin.category}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        <Chip
                          label={`v${plugin.version}`}
                          size="small"
                          variant="outlined"
                        />
                        {plugin.installed && (
                          <Chip
                            icon={<CheckCircleIcon />}
                            label={t('store.plugins.installed')}
                            size="small"
                            color="success"
                          />
                        )}
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<InfoIcon />}
                    onClick={() => handleViewDetails(plugin)}
                  >
                    {t('store.plugins.details')}
                  </Button>
                  {plugin.installed ? (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={
                        uninstalling === plugin.id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <DeleteIcon />
                        )
                      }
                      onClick={() => handleUninstallClick(plugin)}
                      disabled={uninstalling === plugin.id || !!uninstalling}
                      sx={{ ml: 'auto' }}
                    >
                      {t('store.plugins.uninstall')}
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={
                        installing === plugin.id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <InstallIcon />
                        )
                      }
                      onClick={() => handleInstallClick(plugin)}
                      disabled={
                        installing === plugin.id ||
                        plugin.installed ||
                        !!installing
                      }
                      sx={{ ml: 'auto' }}
                    >
                      {t('store.plugins.install')}
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
          {showInstalledOnly && plugins.filter((p) => p.installed).length === 0 && (
            <Grid item xs={12}>
              <Alert severity="info">{t('store.plugins.noInstalledPlugins')}</Alert>
            </Grid>
          )}
        </Grid>
      )}

      {/* Dialog de détails */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedPlugin && (
          <>
            <DialogTitle>
              <Stack direction="row" spacing={2} alignItems="center">
                {selectedPlugin.icon && (
                  <Box
                    component="img"
                    src={getStoreUrl(selectedPlugin.icon)}
                    alt={selectedPlugin.displayName}
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 1,
                      objectFit: 'cover',
                    }}
                  />
                )}
                <Box>
                  <Typography variant="h6">{selectedPlugin.displayName}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {t('store.plugins.version')}: {selectedPlugin.version}
                    {selectedPlugin.author && ` • ${selectedPlugin.author}`}
                  </Typography>
                </Box>
              </Stack>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body1" paragraph>
                {selectedPlugin.description}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                {selectedPlugin.category && (
                  <Chip label={selectedPlugin.category} size="small" />
                )}
                {selectedPlugin.rating && (
                  <Chip
                    label={`⭐ ${selectedPlugin.rating.toFixed(1)}`}
                    size="small"
                  />
                )}
                {selectedPlugin.downloads && (
                  <Chip
                    label={`📥 ${selectedPlugin.downloads}`}
                    size="small"
                  />
                )}
                {selectedPlugin.price && (
                  <Chip
                    label={`€${selectedPlugin.price.toFixed(2)}`}
                    size="small"
                    color="primary"
                  />
                )}
              </Stack>
              {selectedPlugin.screenshots && selectedPlugin.screenshots.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    {t('store.plugins.screenshots')}
                  </Typography>
                  <Grid container spacing={2}>
                    {selectedPlugin.screenshots.map((screenshot, index) => (
                      <Grid item xs={12} sm={6} key={index}>
                        <Box
                          component="img"
                          src={getStoreUrl(screenshot)}
                          alt={`${selectedPlugin.displayName} - Screenshot ${index + 1}`}
                          sx={{
                            width: '100%',
                            height: 'auto',
                            borderRadius: 1,
                            objectFit: 'cover',
                            border: '1px solid',
                            borderColor: 'divider',
                          }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>
                {t('common.close')}
              </Button>
              {selectedPlugin.installed ? (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={
                    uninstalling === selectedPlugin.id ? (
                      <CircularProgress size={16} />
                    ) : (
                      <DeleteIcon />
                    )
                  }
                  onClick={() => {
                    setDialogOpen(false);
                    handleUninstallClick(selectedPlugin);
                  }}
                  disabled={uninstalling === selectedPlugin.id || !!uninstalling}
                >
                  {t('store.plugins.uninstall')}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  startIcon={
                    installing === selectedPlugin.id ? (
                      <CircularProgress size={16} />
                    ) : (
                      <InstallIcon />
                    )
                  }
                onClick={() => {
                  setDialogOpen(false);
                  handleInstallClick(selectedPlugin);
                }}
                  disabled={
                    installing === selectedPlugin.id ||
                    selectedPlugin.installed ||
                    !!installing
                  }
                >
                  {t('store.plugins.install')}
                </Button>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Dialog de confirmation d'installation */}
      <Dialog
        open={installDialogOpen}
        onClose={() => {
          setInstallDialogOpen(false);
          setPluginToInstall(null);
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            {pluginToInstall?.icon && (
              <Box
                component="img"
                src={getStoreUrl(pluginToInstall.icon)}
                alt={pluginToInstall.displayName}
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1,
                  objectFit: 'cover',
                }}
              />
            )}
            <Box>
              <Typography variant="h6">{t('store.plugins.install')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {pluginToInstall?.displayName}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography>
            {pluginToInstall &&
              t('store.plugins.installConfirm', {
                name: pluginToInstall.displayName,
              })}
          </Typography>
          {pluginToInstall?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {pluginToInstall.description}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setInstallDialogOpen(false);
              setPluginToInstall(null);
            }}
            disabled={installing === pluginToInstall?.id}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleInstallConfirm}
            variant="contained"
            disabled={installing === pluginToInstall?.id}
            startIcon={
              installing === pluginToInstall?.id ? (
                <CircularProgress size={16} />
              ) : (
                <InstallIcon />
              )
            }
          >
            {t('store.plugins.install')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Menu de paramètres */}
      <Menu
        anchorEl={settingsMenuAnchor}
        open={Boolean(settingsMenuAnchor)}
        onClose={() => {
          setSettingsMenuAnchor(null);
          setSettingsMenuPluginId(null);
        }}
      >
        <MenuItem
          onClick={async () => {
            if (!settingsMenuPluginId) return;
            try {
              const plugin = await pluginsService.getPlugin(settingsMenuPluginId);
              setPluginForSettings({
                id: settingsMenuPluginId,
                name: plugin.displayName || plugin.name,
                config: plugin.config || {},
              });
              setPluginConfig(plugin.config || {});
              setSettingsDialogOpen(true);
            } catch (error: any) {
              console.error('Erreur lors du chargement des paramètres:', error);
              addNotification({
                message: error.message || t('store.plugins.settingsLoadError'),
                type: 'error',
              });
            } finally {
              setSettingsMenuAnchor(null);
              setSettingsMenuPluginId(null);
            }
          }}
        >
          <SettingsIcon sx={{ mr: 1, fontSize: 20 }} />
          {t('store.plugins.settings')}
        </MenuItem>
      </Menu>

      {/* Dialog de paramètres */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => {
          setSettingsDialogOpen(false);
          setPluginForSettings(null);
          setPluginConfig({});
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <SettingsIcon />
            <Box>
              <Typography variant="h6">
                {t('store.plugins.settings')} - {pluginForSettings?.name}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {Object.keys(pluginConfig).length === 0 ? (
            <Alert severity="info" sx={{ mt: 2 }}>
              {t('store.plugins.noSettings')}
            </Alert>
          ) : (
            <Box sx={{ mt: 2 }}>
              {Object.entries(pluginConfig).map(([key, value]) => (
                <TextField
                  key={key}
                  fullWidth
                  label={key}
                  value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  onChange={(e) => {
                    const newConfig = { ...pluginConfig };
                    try {
                      // Essayer de parser comme JSON si possible
                      const parsed = JSON.parse(e.target.value);
                      newConfig[key] = parsed;
                    } catch {
                      // Sinon, garder comme string
                      newConfig[key] = e.target.value;
                    }
                    setPluginConfig(newConfig);
                  }}
                  multiline={typeof value === 'object'}
                  rows={typeof value === 'object' ? 4 : 1}
                  sx={{ mb: 2 }}
                />
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setSettingsDialogOpen(false);
              setPluginForSettings(null);
              setPluginConfig({});
            }}
            disabled={savingConfig}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={async () => {
              if (!pluginForSettings) return;
              try {
                setSavingConfig(true);
                await pluginsService.updateConfig(pluginForSettings.id, pluginConfig);
                addNotification({
                  message: t('store.plugins.settingsSaveSuccess', { name: pluginForSettings.name }),
                  type: 'success',
                });
                setSettingsDialogOpen(false);
                setPluginForSettings(null);
                setPluginConfig({});
                // Recharger les plugins pour mettre à jour
                await loadPlugins();
              } catch (error: any) {
                console.error('Erreur lors de la sauvegarde des paramètres:', error);
                addNotification({
                  message: error.message || t('store.plugins.settingsSaveError'),
                  type: 'error',
                });
              } finally {
                setSavingConfig(false);
              }
            }}
            variant="contained"
            disabled={savingConfig || Object.keys(pluginConfig).length === 0}
            startIcon={savingConfig ? <CircularProgress size={16} /> : undefined}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de confirmation de désinstallation */}
      <Dialog
        open={uninstallDialogOpen}
        onClose={() => {
          setUninstallDialogOpen(false);
          setPluginToUninstall(null);
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            {pluginToUninstall?.icon && (
              <Box
                component="img"
                src={getStoreUrl(pluginToUninstall.icon)}
                alt={pluginToUninstall.displayName}
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1,
                  objectFit: 'cover',
                }}
              />
            )}
            <Box>
              <Typography variant="h6">{t('store.plugins.uninstall')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {pluginToUninstall?.displayName}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography>
            {pluginToUninstall &&
              t('store.plugins.uninstallConfirm', {
                name: pluginToUninstall.displayName,
              })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setUninstallDialogOpen(false);
              setPluginToUninstall(null);
            }}
            disabled={uninstalling === pluginToUninstall?.id}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => pluginToUninstall && handleUninstall(pluginToUninstall)}
            color="error"
            variant="contained"
            disabled={uninstalling === pluginToUninstall?.id}
            startIcon={
              uninstalling === pluginToUninstall?.id ? (
                <CircularProgress size={16} />
              ) : (
                <DeleteIcon />
              )
            }
          >
            {t('store.plugins.uninstall')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


