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
  IconButton,
  Stack,
} from '@mui/material';
import {
  Search as SearchIcon,
  InstallDesktop as InstallIcon,
  CheckCircle as CheckCircleIcon,
  Store as StoreIcon,
  Info as InfoIcon,
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
  price?: number;
  category?: string;
  installed?: boolean;
  rating?: number;
  downloads?: number;
}

export default function StorePage() {
  const { t } = useTranslation();
  const { showNotification } = useNotification();
  const navigate = useNavigate();
  const [plugins, setPlugins] = useState<StorePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [connected, setConnected] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<StorePlugin | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    checkConnectionAndLoadPlugins();
  }, []);

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
      setPlugins(storePlugins || []);
    } catch (error: any) {
      console.error('Erreur lors du chargement des plugins:', error);
      showNotification(
        error.message || t('store.plugins.loadError'),
        'error',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (plugin: StorePlugin) => {
    if (plugin.installed) {
      showNotification(t('store.plugins.alreadyInstalled'), 'info');
      return;
    }

    // Vérifier la connexion avant d'installer
    if (!connected) {
      showNotification(
        t('store.plugins.installRequiresConnection'),
        'warning',
      );
      navigate('/store/connect');
      return;
    }

    try {
      setInstalling(plugin.id);
      await pluginsService.installFromStore(plugin.id);
      showNotification(
        t('store.plugins.installSuccess', { name: plugin.displayName }),
        'success',
      );
      // Recharger les plugins pour mettre à jour le statut
      await loadPlugins();
    } catch (error: any) {
      console.error('Erreur lors de l\'installation:', error);
      showNotification(
        error.message || t('store.plugins.installError'),
        'error',
      );
    } finally {
      setInstalling(null);
    }
  };

  const handleViewDetails = (plugin: StorePlugin) => {
    setSelectedPlugin(plugin);
    setDialogOpen(true);
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
          {plugins.map((plugin) => (
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
                        src={plugin.icon}
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
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" component="h3" gutterBottom>
                        {plugin.displayName}
                      </Typography>
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
                    onClick={() => handleInstall(plugin)}
                    disabled={
                      installing === plugin.id ||
                      plugin.installed ||
                      !!installing
                    }
                    sx={{ ml: 'auto' }}
                  >
                    {plugin.installed
                      ? t('store.plugins.installed')
                      : t('store.plugins.install')}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
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
                    src={selectedPlugin.icon}
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
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDialogOpen(false)}>
                {t('common.close')}
              </Button>
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
                  handleInstall(selectedPlugin);
                  setDialogOpen(false);
                }}
                disabled={
                  installing === selectedPlugin.id ||
                  selectedPlugin.installed ||
                  !!installing
                }
              >
                {selectedPlugin.installed
                  ? t('store.plugins.installed')
                  : t('store.plugins.install')}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}


