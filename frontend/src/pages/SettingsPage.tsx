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
  Divider,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { apiService } from '../services/api.service';
import { telegramService, TelegramConfig } from '../services/telegram.service';

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
  
  // État Telegram
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig | null>(null);
  const [loadingTelegram, setLoadingTelegram] = useState(false);
  const [telegramError, setTelegramError] = useState<string | null>(null);
  const [telegramSuccess, setTelegramSuccess] = useState<string | null>(null);
  const [registeringChat, setRegisteringChat] = useState(false);
  const [chatId, setChatId] = useState('');
  const [chatType, setChatType] = useState('private');
  const [chatTitle, setChatTitle] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    loadSettings();
    if (activeTab === 2) {
      loadTelegramConfig();
    }
  }, [activeTab]);

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

  const loadTelegramConfig = async () => {
    setLoadingTelegram(true);
    setTelegramError(null);
    try {
      const config = await telegramService.getConfig();
      setTelegramConfig(config);
      if (config.chatId) {
        setChatId(config.chatId.toString());
      }
    } catch (err: any) {
      setTelegramError(err.message || 'Erreur lors du chargement de la configuration Telegram');
    } finally {
      setLoadingTelegram(false);
    }
  };

  const handleRegisterChat = async () => {
    if (!chatId.trim()) {
      setTelegramError('Veuillez entrer un Chat ID');
      return;
    }

    setRegisteringChat(true);
    setTelegramError(null);
    setTelegramSuccess(null);
    try {
      // L'UUID sera généré automatiquement côté backend
      const config = await telegramService.registerChat({
        chatId: chatId.trim(),
        chatType: chatType || 'private',
        chatTitle: chatTitle || 'Chat privé',
      });
      setTelegramConfig(config);
      setTelegramSuccess(t('settings.telegram.step2.success'));
    } catch (err: any) {
      setTelegramError(err.message || t('settings.telegram.step2.error'));
    } finally {
      setRegisteringChat(false);
    }
  };

  const handleResetTelegram = async () => {
    setResetting(true);
    setTelegramError(null);
    setTelegramSuccess(null);
    try {
      const config = await telegramService.reset();
      setTelegramConfig(config);
      setChatId('');
      setChatType('private');
      setChatTitle('');
      setTelegramSuccess(t('settings.telegram.status.resetSuccess'));
      setResetDialogOpen(false);
    } catch (err: any) {
      setTelegramError(err.message || t('settings.telegram.status.resetError'));
    } finally {
      setResetting(false);
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
                <Tab label={t('settings.tabTelegram')} />
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

              {activeTab === 2 && (
                <Stack spacing={3}>
                  {/* Instructions au-dessus du titre */}
                  <Paper elevation={1} sx={{ p: 3, bgcolor: 'action.hover' }}>
                    <Typography variant="h6" gutterBottom>
                      {t('settings.telegram.info.title')}
                    </Typography>
                    <Stack spacing={1}>
                      <Typography variant="body2">{t('settings.telegram.info.step1')}</Typography>
                      <Typography variant="body2">{t('settings.telegram.info.step2')}</Typography>
                      <Typography variant="body2">{t('settings.telegram.info.step3')}</Typography>
                      <Typography variant="body2">{t('settings.telegram.info.step4')}</Typography>
                    </Stack>
                  </Paper>

                  <Typography variant="h6" gutterBottom>
                    {t('settings.telegram.title')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {t('settings.telegram.description')}
                  </Typography>

                  {telegramError && (
                    <Alert severity="error" onClose={() => setTelegramError(null)}>
                      {telegramError}
                    </Alert>
                  )}

                  {telegramSuccess && (
                    <Alert severity="success" onClose={() => setTelegramSuccess(null)}>
                      {telegramSuccess}
                    </Alert>
                  )}

                  {loadingTelegram ? (
                    <Typography>{t('common.loading')}</Typography>
                  ) : (
                    <>
                      {/* Formulaire d'enregistrement */}
                      <Paper elevation={1} sx={{ p: 3 }}>
                        <Stack spacing={2}>
                          <TextField
                            label={t('settings.telegram.step2.chatId')}
                            value={chatId}
                            onChange={(e) => setChatId(e.target.value)}
                            fullWidth
                            helperText={t('settings.telegram.step2.chatIdHelp')}
                            disabled={!!telegramConfig?.chatId}
                          />

                          <FormControl fullWidth disabled={!!telegramConfig?.chatId}>
                            <InputLabel>{t('settings.telegram.step2.chatType')}</InputLabel>
                            <Select
                              value={chatType}
                              label={t('settings.telegram.step2.chatType')}
                              onChange={(e) => setChatType(e.target.value)}
                            >
                              <MenuItem value="private">private</MenuItem>
                              <MenuItem value="group">group</MenuItem>
                              <MenuItem value="supergroup">supergroup</MenuItem>
                              <MenuItem value="channel">channel</MenuItem>
                            </Select>
                          </FormControl>

                          <TextField
                            label={t('settings.telegram.step2.chatTitle')}
                            value={chatTitle}
                            onChange={(e) => setChatTitle(e.target.value)}
                            fullWidth
                            disabled={!!telegramConfig?.chatId}
                          />

                          {telegramConfig?.chatId ? (
                            <Alert severity="success">
                              <Typography variant="body2">
                                <strong>{t('settings.telegram.status.configured')}</strong>
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                <strong>{t('settings.telegram.status.chatId')}:</strong> {telegramConfig.chatId}
                              </Typography>
                              {telegramConfig.uuid && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  <strong>{t('settings.telegram.status.uuid')}:</strong> {telegramConfig.uuid}
                                </Typography>
                              )}
                            </Alert>
                          ) : (
                            <Button
                              variant="contained"
                              onClick={handleRegisterChat}
                              disabled={registeringChat || !chatId.trim()}
                              sx={{ mt: 1 }}
                            >
                              {registeringChat ? t('settings.telegram.step2.registering') : t('settings.telegram.step2.button')}
                            </Button>
                          )}
                        </Stack>
                      </Paper>

                      {/* Réinitialiser */}
                      {telegramConfig && (telegramConfig.uuid || telegramConfig.chatId) && (
                        <Box>
                          <Divider sx={{ my: 2 }} />
                          <Button
                            variant="outlined"
                            color="error"
                            onClick={() => setResetDialogOpen(true)}
                          >
                            {t('settings.telegram.status.reset')}
                          </Button>
                        </Box>
                      )}
                    </>
                  )}
                </Stack>
              )}

              {activeTab !== 2 && (
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

              {/* Dialog de confirmation pour réinitialiser */}
              <Dialog
                open={resetDialogOpen}
                onClose={() => setResetDialogOpen(false)}
              >
                <DialogTitle>{t('settings.telegram.status.reset')}</DialogTitle>
                <DialogContent>
                  <Typography>{t('settings.telegram.status.resetConfirm')}</Typography>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setResetDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    onClick={handleResetTelegram}
                    color="error"
                    variant="contained"
                    disabled={resetting}
                  >
                    {resetting ? t('settings.telegram.status.resetting') : t('common.confirm')}
                  </Button>
                </DialogActions>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

