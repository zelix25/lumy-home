import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import DeleteIcon from '@mui/icons-material/Delete';
import StoreIcon from '@mui/icons-material/Store';
import SecurityIcon from '@mui/icons-material/Security';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { pluginsService, Plugin, PluginStatus } from '../services/plugins.service';
import { useNotification } from '../hooks/useNotification';

export default function PluginsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedPlugin, setSelectedPlugin] = useState<Plugin | null>(null);
  const [configValue, setConfigValue] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState<Set<string>>(new Set());
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedPluginPermissions, setSelectedPluginPermissions] = useState<string[]>([]);
  const [permissionsAnalysis, setPermissionsAnalysis] = useState<any>(null);

  useEffect(() => {
    loadPlugins();
  }, []);

  const loadPlugins = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await pluginsService.getAll();
      setPlugins(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des plugins');
      console.error('Erreur lors du chargement des plugins:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (plugin: Plugin) => {
    if (toggling.has(plugin.id)) return;

    setToggling((prev) => new Set(prev).add(plugin.id));
    try {
      if (plugin.status === PluginStatus.ENABLED) {
        await pluginsService.disable(plugin.id);
        addNotification({
          type: 'success',
          title: t('plugins.disableSuccess'),
          message: t('plugins.disableSuccessMessage', { name: plugin.displayName }),
        });
      } else {
        await pluginsService.enable(plugin.id);
        addNotification({
          type: 'success',
          title: t('plugins.enableSuccess'),
          message: t('plugins.enableSuccessMessage', { name: plugin.displayName }),
        });
      }
      await loadPlugins();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('plugins.toggleError'),
        message: err.message || t('plugins.toggleErrorMessage'),
      });
    } finally {
      setToggling((prev) => {
        const newSet = new Set(prev);
        newSet.delete(plugin.id);
        return newSet;
      });
    }
  };

  const handleOpenConfig = (plugin: Plugin) => {
    setSelectedPlugin(plugin);
    setConfigValue(JSON.stringify(plugin.config || {}, null, 2));
    setConfigDialogOpen(true);
  };

  const handleOpenPermissions = async (plugin: Plugin) => {
    setSelectedPlugin(plugin);
    try {
      const data = await pluginsService.getPluginPermissions(plugin.id);
      setSelectedPluginPermissions(data.permissions || []);
      setPermissionsAnalysis(data.analysis);
      setPermissionsDialogOpen(true);
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('plugins.permissionsError'),
        message: err.message || t('plugins.permissionsErrorMessage'),
      });
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedPlugin) return;

    setSavingConfig(true);
    try {
      const config = JSON.parse(configValue);
      await pluginsService.updateConfig(selectedPlugin.id, config);
      addNotification({
        type: 'success',
        title: t('plugins.configSaved'),
        message: t('plugins.configSavedMessage'),
      });
      setConfigDialogOpen(false);
      await loadPlugins();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('plugins.configError'),
        message: err.message || t('plugins.configErrorMessage'),
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handleUninstall = async (plugin: Plugin) => {
    if (!confirm(t('plugins.uninstallConfirm', { name: plugin.displayName }))) {
      return;
    }

    if (deleting.has(plugin.id)) return;

    setDeleting((prev) => new Set(prev).add(plugin.id));
    try {
      await pluginsService.uninstall(plugin.id);
      addNotification({
        type: 'success',
        title: t('plugins.uninstallSuccess'),
        message: t('plugins.uninstallSuccessMessage', { name: plugin.displayName }),
      });
      await loadPlugins();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('plugins.uninstallError'),
        message: err.message || t('plugins.uninstallErrorMessage'),
      });
    } finally {
      setDeleting((prev) => {
        const newSet = new Set(prev);
        newSet.delete(plugin.id);
        return newSet;
      });
    }
  };

  const getStatusColor = (status: PluginStatus) => {
    switch (status) {
      case PluginStatus.ENABLED:
        return 'success';
      case PluginStatus.DISABLED:
        return 'default';
      case PluginStatus.ERROR:
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {t('plugins.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('plugins.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<StoreIcon />}
          onClick={() => navigate('/plugins/store')}
        >
          {t('plugins.openStore')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : plugins.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('plugins.noPluginsInstalled')}
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {plugins.map((plugin) => (
            <Grid item xs={12} sm={6} md={4} key={plugin.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                    <Box>
                      <Typography variant="h6">{plugin.displayName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {plugin.version} • {plugin.author || t('plugins.unknownAuthor')}
                      </Typography>
                    </Box>
                    <Chip
                      label={t(`plugins.status.${plugin.status}`)}
                      color={getStatusColor(plugin.status) as any}
                      size="small"
                    />
                  </Box>
                  {plugin.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {plugin.description}
                    </Typography>
                  )}
                  {plugin.error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {plugin.error}
                    </Alert>
                  )}
                  <FormControlLabel
                    control={
                      <Switch
                        checked={plugin.status === PluginStatus.ENABLED}
                        onChange={() => handleToggle(plugin)}
                        disabled={toggling.has(plugin.id)}
                      />
                    }
                    label={t('plugins.enabled')}
                  />
                </CardContent>
                <CardActions>
                  {plugin.permissions && plugin.permissions.length > 0 && (
                    <Button
                      size="small"
                      startIcon={<SecurityIcon />}
                      onClick={() => handleOpenPermissions(plugin)}
                    >
                      {t('plugins.permissions')} ({plugin.permissions.length})
                    </Button>
                  )}
                  <Button
                    size="small"
                    startIcon={<SettingsIcon />}
                    onClick={() => handleOpenConfig(plugin)}
                  >
                    {t('plugins.configure')}
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleUninstall(plugin)}
                    disabled={deleting.has(plugin.id)}
                  >
                    {t('plugins.uninstall')}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog de configuration */}
      <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{t('plugins.configure')}: {selectedPlugin?.displayName}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={10}
            value={configValue}
            onChange={(e) => setConfigValue(e.target.value)}
            placeholder={t('plugins.configPlaceholder')}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveConfig} variant="contained" disabled={savingConfig}>
            {savingConfig ? <CircularProgress size={20} /> : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de permissions */}
      <Dialog open={permissionsDialogOpen} onClose={() => setPermissionsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {t('plugins.permissions')}: {selectedPlugin?.displayName}
        </DialogTitle>
        <DialogContent>
          {permissionsAnalysis && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('plugins.permissionsAnalysis')}
              </Typography>
              <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                <Chip
                  label={`${t('plugins.total')}: ${permissionsAnalysis.total}`}
                  size="small"
                />
                <Chip
                  label={`${t('plugins.highestRisk')}: ${permissionsAnalysis.highestRisk}`}
                  color={permissionsAnalysis.highestRisk === 'critical' ? 'error' : permissionsAnalysis.highestRisk === 'high' ? 'warning' : 'default'}
                  size="small"
                />
              </Stack>
              {permissionsAnalysis.criticalPermissions.length > 0 && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('plugins.criticalPermissions')}:
                  </Typography>
                  {permissionsAnalysis.criticalPermissions.map((perm: string) => (
                    <Chip key={perm} label={perm} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </Alert>
              )}
              {permissionsAnalysis.highRiskPermissions.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {t('plugins.highRiskPermissions')}:
                  </Typography>
                  {permissionsAnalysis.highRiskPermissions.map((perm: string) => (
                    <Chip key={perm} label={perm} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                  ))}
                </Alert>
              )}
            </Box>
          )}
          <Typography variant="subtitle2" gutterBottom>
            {t('plugins.requestedPermissions')}:
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {selectedPluginPermissions.map((permission) => (
              <Chip key={permission} label={permission} size="small" />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermissionsDialogOpen(false)}>{t('common.close')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

