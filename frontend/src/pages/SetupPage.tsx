import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Stack,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDevices } from '../hooks/useDevices';
import { devicesService } from '../services/devices.service';
import { useAuth } from '../contexts/AuthContext';
import { settingsService } from '../services/settings.service';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

type SetupStep = 'update' | 'account' | 'devices' | 'complete';

export default function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { devices, refetch } = useDevices();
  const { register } = useAuth();
  const [currentStep, setCurrentStep] = useState<SetupStep>('update');
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'updating' | 'updated' | 'error'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deviceNames, setDeviceNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkUpdateStatus();
  }, []);

  const checkUpdateStatus = async () => {
    setUpdateStatus('checking');
    try {
      // Simuler la vérification de mise à jour
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Pour l'instant, on considère qu'il n'y a pas de mise à jour
      setUpdateStatus('updated');
    } catch (err) {
      setUpdateStatus('error');
    }
  };

  /*const handleUpdate = async () => {
    setUpdateStatus('updating');
    try {
      // TODO: Implémenter la mise à jour réelle
      await new Promise((resolve) => setTimeout(resolve, 3000));
      setUpdateStatus('updated');
    } catch (err) {
      setUpdateStatus('error');
      setError(t('setup.updateError'));
    }
  };*/

  const handleCreateAccount = async () => {
    if (!email || !password) {
      setError(t('auth.fillAllFields'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register(email, password);
      setCurrentStep('devices');
    } catch (err: any) {
      setError(err.message || t('auth.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceNameChange = (ieeeAddress: string, name: string) => {
    setDeviceNames((prev) => ({
      ...prev,
      [ieeeAddress]: name,
    }));
  };

  const handleSaveDevices = async () => {
    setLoading(true);
    setError(null);

    try {
      const promises = Object.entries(deviceNames).map(([ieeeAddress, name]) => {
        if (name.trim()) {
          return devicesService.updateFriendlyName(ieeeAddress, name.trim());
        }
        return Promise.resolve();
      });

      await Promise.all(promises);
      await refetch();
      setCurrentStep('complete');
    } catch (err: any) {
      setError(err.message || t('setup.errorSaving'));
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    try {
      // Mettre à jour les settings pour indiquer que le setup est terminé
      await settingsService.updateSettings({ setup: false });
      navigate('/');
    } catch (err) {
      console.error('Erreur lors de la finalisation du setup:', err);
      navigate('/');
    }
  };

  const steps = [
    t('setup.stepUpdate'),
    t('setup.stepAccount'),
    t('setup.stepDevices'),
    t('setup.stepComplete'),
  ];

  const getActiveStep = () => {
    switch (currentStep) {
      case 'update':
        return 0;
      case 'account':
        return 1;
      case 'devices':
        return 2;
      case 'complete':
        return 3;
      default:
        return 0;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'update':
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
              {t('setup.checkingUpdates')}
            </Typography>

            {updateStatus === 'checking' && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  {t('setup.checkingUpdatesMessage')}
                </Typography>
              </Box>
            )}

            {updateStatus === 'updated' && (
              <Box>
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
                  {t('setup.noUpdates')}
                </Alert>
                <Button variant="contained" onClick={() => setCurrentStep('account')} fullWidth>
                  {t('setup.continue')}
                </Button>
              </Box>
            )}

            {updateStatus === 'updating' && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress sx={{ mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  {t('setup.updating')}
                </Typography>
              </Box>
            )}

            {updateStatus === 'error' && (
              <Box>
                <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 3 }}>
                  {t('setup.updateError')}
                </Alert>
                <Stack direction="row" spacing={2}>
                  <Button variant="outlined" onClick={checkUpdateStatus} fullWidth>
                    {t('setup.retry')}
                  </Button>
                  <Button variant="contained" onClick={() => setCurrentStep('account')} fullWidth>
                    {t('setup.skip')}
                  </Button>
                </Stack>
              </Box>
            )}
          </Box>
        );

      case 'account':
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
              {t('setup.createAccount')}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <Stack spacing={2}>
              <TextField
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                required
                autoComplete="email"
              />

              <TextField
                label={t('auth.password')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                required
                autoComplete="new-password"
              />

              <TextField
                label={t('auth.confirmPassword')}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                required
                autoComplete="new-password"
              />

              <Button
                variant="contained"
                onClick={handleCreateAccount}
                disabled={loading}
                fullWidth
                sx={{ mt: 2 }}
              >
                {loading ? t('common.loading') : t('setup.createAccount')}
              </Button>
            </Stack>
          </Box>
        );

      case 'devices':
        const devicesToName = devices.filter(
          (d) => !d.friendlyName || d.friendlyName === d.ieeeAddress,
        );

        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
              {t('setup.nameDevices')}
            </Typography>

            {devicesToName.length > 0 && (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {t('setup.detectedDevices', { count: devicesToName.length })}
              </Typography>
            )}

            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            {devicesToName.length > 0 ? (
              <>
                <List>
                  {devicesToName.map((device) => (
                    <ListItem key={device.ieeeAddress} sx={{ px: 0 }}>
                      <ListItemText
                        primary={device.model || device.ieeeAddress}
                        secondary={device.type || t('devices.unknown')}
                        sx={{ flex: '0 1 auto', mr: 2 }}
                      />
                      <TextField
                        size="small"
                        placeholder={t('setup.deviceNamePlaceholder')}
                        value={deviceNames[device.ieeeAddress] || ''}
                        onChange={(e) =>
                          handleDeviceNameChange(device.ieeeAddress, e.target.value)
                        }
                        sx={{ flex: 1 }}
                      />
                    </ListItem>
                  ))}
                </List>

                <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                  <Button
                    variant="outlined"
                    onClick={() => setCurrentStep('complete')}
                    disabled={loading}
                  >
                    {t('common.skip')}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSaveDevices}
                    disabled={loading}
                    sx={{ flex: 1 }}
                  >
                    {loading ? t('common.loading') : t('common.save')}
                  </Button>
                </Stack>
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  {t('setup.allDevicesNamed')}
                </Typography>
                <Button variant="contained" onClick={() => setCurrentStep('complete')}>
                  {t('setup.continue')}
                </Button>
              </Box>
            )}
          </Box>
        );

      case 'complete':
        return (
          <Box sx={{ textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
              {t('setup.complete')}
            </Typography>

            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              {t('setup.readyToUse')}
            </Typography>

            <Button variant="contained" onClick={handleComplete} size="large">
              {t('setup.startUsing')}
            </Button>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F7F7F5',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 700, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 4, textAlign: 'center' }}>
            {t('setup.welcome')}
          </Typography>

          <Stepper activeStep={getActiveStep()} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent()}
        </CardContent>
      </Card>
    </Box>
  );
}
