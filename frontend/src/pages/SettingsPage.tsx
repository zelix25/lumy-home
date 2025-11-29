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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api.service';

interface Settings {
  logout_delay: number;
  hostname: string;
  setup: boolean;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings>({
    logout_delay: 0,
    hostname: '',
    setup: false,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      const payload = {
        logout_delay: settings.logout_delay,
        hostname: settings.hostname,
        setup: settings.setup,
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

              <Box>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? t('common.loading') : t('common.save')}
                </Button>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

