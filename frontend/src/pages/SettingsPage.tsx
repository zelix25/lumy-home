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
  Autocomplete,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api.service';
import { telegramService, TelegramConfig } from '../services/telegram.service';

interface Settings {
  logout_delay: number;
  city?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
}

// Liste des fuseaux horaires IANA courants (fallback si Intl.supportedValuesOf non disponible)
const COMMON_TIMEZONES = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Zurich',
  'Europe/Vienna',
  'Europe/Warsaw',
  'Europe/Prague',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Montreal',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Pacific/Auckland',
];

function getTimezoneOptions(): string[] {
  if (typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl) {
    try {
      return (Intl as any).supportedValuesOf('timeZone') as string[];
    } catch {
      return COMMON_TIMEZONES;
    }
  }
  return COMMON_TIMEZONES;
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const ADVANCED_MODE_STORAGE_KEY = 'lumy_settings_advanced_mode';
  const [settings, setSettings] = useState<Settings>({
    logout_delay: 0,
    city: '',
    zipCode: '',
    country: '',
    timezone: 'Europe/Paris',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    id: '',
    chatId: null,
    token_bot: null,
    isActive: false,
    pin: null,
    createdAt: '',
    updatedAt: '',
  });
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [hostTimeLabel, setHostTimeLabel] = useState<string | null>(null);
  const [advancedMode, setAdvancedMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ADVANCED_MODE_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    loadSettings();
    loadTelegramConfig();
  }, []);

  useEffect(() => {
    if (loading || activeTab !== 0) return;

    const locale = i18n.language?.startsWith('fr') ? 'fr-FR' : 'en-GB';

    const fetchHostTime = async () => {
      try {
        const { iso, timezone } = await apiService.get<{ iso: string; timezone: string }>(
          '/settings/host-time',
        );
        const d = new Date(iso);
        setHostTimeLabel(
          new Intl.DateTimeFormat(locale, {
            timeZone: timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }).format(d),
        );
      } catch {
        setHostTimeLabel(null);
      }
    };

    fetchHostTime();
    const id = window.setInterval(fetchHostTime, 1000);
    return () => window.clearInterval(id);
  }, [loading, activeTab, i18n.language]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.get<Settings>('/settings');
      // Extraire uniquement les champs nécessaires
      setSettings({
        logout_delay: data.logout_delay ?? 0,
        city: data.city ?? '',
        zipCode: data.zipCode ?? '',
        country: data.country ?? '',
        latitude: data.latitude ?? undefined,
        longitude: data.longitude ?? undefined,
        timezone: data.timezone ?? 'Europe/Paris',
      });
    } catch (err: any) {
      setError(err.message || t('settings.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  const loadTelegramConfig = async () => {
    try {
      const data = await telegramService.getTelegramConfig();
      setTelegramConfig(data);
    } catch (err: any) {
      console.error('Erreur lors du chargement de la configuration Telegram:', err);
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
        city: settings.city || undefined,
        zipCode: settings.zipCode || undefined,
        country: settings.country || undefined,
        timezone: settings.timezone || undefined,
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

  const handleSaveTelegram = async () => {
    setSavingTelegram(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await telegramService.updateTelegramConfig({
        chatId: telegramConfig.chatId || undefined,
        token_bot: telegramConfig.token_bot || undefined,
        isActive: telegramConfig.isActive,
      });
      setTelegramConfig(updated);
      setSuccess(t('settings.telegram.saved'));
    } catch (err: any) {
      setError(err.message || t('settings.telegram.errorSaving'));
    } finally {
      setSavingTelegram(false);
    }
  };

  const handleToggleAdvancedMode = (enabled: boolean) => {
    setAdvancedMode(enabled);
    try {
      localStorage.setItem(ADVANCED_MODE_STORAGE_KEY, enabled ? 'true' : 'false');
    } catch {
      // Ignorer si localStorage n'est pas disponible
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
                <Tab label={t('settings.tabLocation')} />
                <Tab label={t('settings.tabTelegram')} />
                <Tab label={t('settings.tabAdvancedMode')} />
              </Tabs>

              {activeTab === 0 && (
                <Stack spacing={3}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      {t('settings.locationInfo')}
                    </Typography>
                  </Alert>

                  {advancedMode && hostTimeLabel !== null && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        {t('settings.hostTime')}
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {hostTimeLabel}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        {t('settings.hostTimeHelp')}
                      </Typography>
                    </Box>
                  )}

                  <Autocomplete
                    options={getTimezoneOptions()}
                    value={settings.timezone || null}
                    onChange={(_, newValue) =>
                      setSettings({ ...settings, timezone: newValue || '' })
                    }
                    onInputChange={(_, newInputValue) =>
                      setSettings({ ...settings, timezone: newInputValue })
                    }
                    freeSolo
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label={t('settings.timezone')}
                        helperText={t('settings.timezoneHelp')}
                      />
                    )}
                  />

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

                  {advancedMode && (settings.latitude && settings.longitude) && (
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

              {activeTab === 1 && (
                <Stack spacing={3}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    <Typography variant="body2">
                      {t('settings.telegram.info')}
                    </Typography>
                  </Alert>

                  <TextField
                    label={t('settings.telegram.tokenBot')}
                    value={telegramConfig.token_bot || ''}
                    onChange={(e) =>
                      setTelegramConfig({ ...telegramConfig, token_bot: e.target.value })
                    }
                    fullWidth
                    type="password"
                    helperText={t('settings.telegram.tokenBotHelp')}
                  />

                  <TextField
                    label={t('settings.telegram.chatId')}
                    value={telegramConfig.chatId || ''}
                    onChange={(e) =>
                      setTelegramConfig({ ...telegramConfig, chatId: e.target.value })
                    }
                    fullWidth
                    helperText={t('settings.telegram.chatIdHelp')}
                  />

                  <FormControlLabel
                    control={
                      <Switch
                        checked={telegramConfig.isActive}
                        onChange={(e) =>
                          setTelegramConfig({ ...telegramConfig, isActive: e.target.checked })
                        }
                      />
                    }
                    label={t('settings.telegram.isActive')}
                  />
                </Stack>
              )}

              {activeTab === 2 && (
                <Stack spacing={3}>
                  <Alert severity="info" sx={{ mb: 1 }}>
                    <Typography variant="body2">{t('settings.advancedModeInfo')}</Typography>
                  </Alert>

                  <FormControlLabel
                    control={
                      <Switch
                        checked={advancedMode}
                        onChange={(e) => handleToggleAdvancedMode(e.target.checked)}
                      />
                    }
                    label={t('settings.advancedModeEnabled')}
                  />
                </Stack>
              )}

              {activeTab !== 2 && (
                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    onClick={activeTab === 1 ? handleSaveTelegram : handleSave}
                    disabled={activeTab === 1 ? savingTelegram : saving}
                  >
                    {activeTab === 1
                      ? savingTelegram
                        ? t('common.loading')
                        : t('common.save')
                      : saving
                      ? t('common.loading')
                      : t('common.save')}
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

