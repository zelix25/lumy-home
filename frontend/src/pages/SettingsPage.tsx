import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
  Switch,
  FormControlLabel,
  Tabs,
  Tab,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiService } from '../services/api.service';
import { pluginsService, PluginUIExtension } from '../services/plugins.service';
import PluginPageLoader from '../components/PluginPageLoader';

interface Settings {
  logout_delay: number;
  hostname: string;
  setup: boolean;
  city?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [settings, setSettings] = useState<Settings>({
    logout_delay: 0,
    hostname: '',
    setup: false,
    city: '',
    zipCode: '',
    country: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [pluginPages, setPluginPages] = useState<PluginUIExtension[]>([]);

  useEffect(() => {
    loadSettings();
    loadPluginPages();
  }, []);

  // Synchroniser l'onglet actif avec l'URL au chargement et quand les pages de plugins sont chargées
  useEffect(() => {
    const path = location.pathname;
    console.log('SettingsPage - Path:', path, 'Plugin pages:', pluginPages.length);
    
    if (path.startsWith('/settings/') && path !== '/settings') {
      const pluginPage = pluginPages.find((p) => p.route === path);
      if (pluginPage) {
        const index = pluginPages.findIndex((p) => p.route === path);
        const tabIndex = 2 + index; // 2 = General (0) + Location (1)
        console.log('SettingsPage - Plugin page trouvée, onglet:', tabIndex);
        setActiveTab(tabIndex);
      } else if (pluginPages.length > 0) {
        // Si la route n'est pas trouvée mais qu'on a des pages de plugins, rester sur General
        console.log('SettingsPage - Route non trouvée, redirection vers /settings');
        setActiveTab(0);
        navigate('/settings', { replace: true });
      }
    } else if (path === '/settings') {
      setActiveTab(0);
    }
  }, [location.pathname, pluginPages, navigate]);

  const loadPluginPages = async () => {
    try {
      const pages = await pluginsService.getAvailablePages();
      // Filtrer les pages qui commencent par /settings/
      const settingsPages = pages.filter((page) => page.route?.startsWith('/settings/'));
      const sortedPages = settingsPages.sort((a, b) => (a.menuOrder ?? 999) - (b.menuOrder ?? 999));
      setPluginPages(sortedPages);
      console.log('Pages de paramètres chargées:', sortedPages);
    } catch (error) {
      console.error('Erreur lors du chargement des pages de plugins:', error);
    }
  };

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.get<Settings>('/settings');
      // Extraire uniquement les champs nécessaires
      setSettings({
        logout_delay: data.logout_delay ?? 0,
        hostname: data.hostname ?? '',
        setup: data.setup ?? false,
        city: data.city ?? '',
        zipCode: data.zipCode ?? '',
        country: data.country ?? '',
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
      });
    } catch (err: any) {
      setError(err.message || t('settings.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      // Envoyer uniquement les champs modifiables
      // Ne pas envoyer latitude/longitude car ils sont calculés automatiquement côté serveur
      const payload: any = {
        logout_delay: settings.logout_delay,
        hostname: settings.hostname,
        setup: settings.setup,
        city: settings.city || undefined,
        zipCode: settings.zipCode || undefined,
        country: settings.country || undefined,
      };
      const updated = await apiService.put<Settings>('/settings', payload);
      setSettings(updated);
      setSuccess(t('settings.saved'));
    } catch (err: any) {
      setError(err.message || t('settings.errorSaving'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 3 }}>
        {t('settings.title')}
      </Typography>

      <Card>
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {loading ? (
            <Typography>{t('common.loading')}</Typography>
          ) : (
            <>
              <Tabs 
                value={activeTab} 
                onChange={(_, newValue) => {
                  setActiveTab(newValue);
                  // Pour les onglets système (General et Location), naviguer vers /settings
                  if (newValue === 0 || newValue === 1) {
                    navigate('/settings', { replace: true });
                  } else {
                    // Pour les onglets de plugins, mettre à jour l'URL sans recharger la page
                    const pluginPage = pluginPages[newValue - 2];
                    if (pluginPage?.route) {
                      navigate(pluginPage.route, { replace: true });
                    }
                  }
                }} 
                sx={{ mb: 3 }}
              >
                <Tab label={t('settings.tabGeneral')} />
                <Tab label={t('settings.tabLocation')} />
                {pluginPages.map((page) => (
                  <Tab key={page.id} label={page.displayName} />
                ))}
              </Tabs>

              {activeTab === 0 && (
                <Stack spacing={3}>
                  <TextField
                    label={t('settings.hostname')}
                    value={settings.hostname}
                    onChange={(e) =>
                      setSettings({ ...settings, hostname: e.target.value })
                    }
                    fullWidth
                  />

                  <TextField
                    label={t('settings.logoutDelay')}
                    type="number"
                    value={settings.logout_delay}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        logout_delay: parseInt(e.target.value) || 0,
                      })
                    }
                    fullWidth
                    helperText={t('settings.logoutDelayHelp')}
                    inputProps={{ min: 0 }}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.setup}
                        onChange={(e) =>
                          setSettings({ ...settings, setup: e.target.checked })
                        }
                      />
                    }
                    label={t('settings.setup')}
                  />
                </Stack>
              )}

              {activeTab === 1 && (
                <Stack spacing={3}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      {t('settings.locationInfo')}
                    </Typography>
                  </Alert>

                  <TextField
                    label={t('settings.city')}
                    value={settings.city || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, city: e.target.value })
                    }
                    fullWidth
                  />

                  <TextField
                    label={t('settings.zipCode')}
                    value={settings.zipCode || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, zipCode: e.target.value })
                    }
                    fullWidth
                  />

                  <TextField
                    label={t('settings.country')}
                    value={settings.country || ''}
                    onChange={(e) =>
                      setSettings({ ...settings, country: e.target.value })
                    }
                    fullWidth
                  />

                  {(settings.latitude && settings.longitude) && (
                    <Alert severity="info">
                      <Typography variant="body2">
                        <strong>{t('settings.coordinates')}:</strong> {settings.latitude.toFixed(6)}, {settings.longitude.toFixed(6)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('settings.coordinatesHelp')}
                      </Typography>
                    </Alert>
                  )}
                </Stack>
              )}

              {/* Onglets des plugins */}
              {activeTab >= 2 && pluginPages[activeTab - 2] && (
                <Box>
                  <PluginPageLoader 
                    extension={{
                      ...pluginPages[activeTab - 2],
                      props: {
                        ...pluginPages[activeTab - 2].props,
                        pluginId: pluginPages[activeTab - 2].pluginId,
                        pluginName: pluginPages[activeTab - 2].displayName,
                      },
                    }} 
                  />
                </Box>
              )}

              {/* Bouton de sauvegarde uniquement pour les onglets système */}
              {activeTab < 2 && (
                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? t('common.loading') : t('common.save')}
                  </Button>
                </Box>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

