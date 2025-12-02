import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Alert,
  Stack,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { settingsService } from '../services/settings.service';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

type SetupStep = 'update' | 'account' | 'complete';

export default function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();
  const [currentStep, setCurrentStep] = useState<SetupStep>('update');
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'updating' | 'updated' | 'error'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  // Vérifier le statut du setup au chargement de la page
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const { setup } = await settingsService.getSetupStatus();
        // Si setup est à false, rediriger vers la page de login
        if (!setup) {
          navigate('/login', { replace: true });
        }
      } catch (err) {
        console.error('Erreur lors de la vérification du setup:', err);
        // En cas d'erreur, on continue quand même (ne pas bloquer la page)
      } finally {
        setCheckingSetup(false);
      }
    };

    checkSetup();
  }, [navigate]);

  useEffect(() => {
    // Ne vérifier les mises à jour que si le setup est actif
    if (!checkingSetup) {
      checkUpdateStatus();
    }
  }, [checkingSetup]);

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
      setCurrentStep('complete');
    } catch (err: any) {
      setError(err.message || t('auth.error'));
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
    t('setup.stepComplete'),
  ];

  const getActiveStep = () => {
    switch (currentStep) {
      case 'update':
        return 0;
      case 'account':
        return 1;
      case 'complete':
        return 2;
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

  // Afficher un loader pendant la vérification du setup
  if (checkingSetup) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F7F7F5',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

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
