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
import { apiService } from '../services/api.service';

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

  useEffect(() => {
    loadSettings();
  }, []);

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
              <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
                <Tab label={t('settings.tabGeneral')} />
                <Tab label={t('settings.tabLocation')} />
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

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? t('common.loading') : t('common.save')}
                </Button>
              </Box>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

