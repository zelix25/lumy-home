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
  FormControlLabel,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  Checkbox,
  Link,
  LinearProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth.service';
import { settingsService } from '../services/settings.service';
import { storeService, ConnectStoreDto } from '../services/store.service';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

type SetupStep = 'update' | 'account' | 'store' | 'ai' | 'weather' | 'complete';

export default function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();
  
  // Récupérer l'étape depuis localStorage ou utiliser 'update' par défaut
  const getInitialStep = (): SetupStep => {
    const savedStep = localStorage.getItem('setup_current_step');
    if (savedStep && ['update', 'account', 'store', 'ai', 'weather', 'complete'].includes(savedStep)) {
      return savedStep as SetupStep;
    }
    return 'update';
  };
  
  const [currentStep, setCurrentStep] = useState<SetupStep>(getInitialStep());
  
  // Sauvegarder l'étape dans localStorage à chaque changement
  useEffect(() => {
    localStorage.setItem('setup_current_step', currentStep);
  }, [currentStep]);
  const [updateStatus, setUpdateStatus] = useState<'checking' | 'updating' | 'updated' | 'error'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; label: string; color: string }>({ score: 0, label: '', color: '' });
  
  // Étape 3: Store
  const [storeEmail, setStoreEmail] = useState('');
  const [storePassword, setStorePassword] = useState('');
  const [storeConnected, setStoreConnected] = useState(false);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeSuccess, setStoreSuccess] = useState<string | null>(null);
  
  // Étape 4: IA
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiType, setAiType] = useState<'cloud' | 'local'>('cloud');
  const [systemInfo, setSystemInfo] = useState<{ ram: number; cpuArch: string; cpuType: string } | null>(null);
  const [checkingSystemInfo, setCheckingSystemInfo] = useState(false);
  const [localAiDisabled, setLocalAiDisabled] = useState(false);

  // Étape 5: Météo
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherSuccess, setWeatherSuccess] = useState(false);

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

  const checkSystemInfo = async () => {
    setCheckingSystemInfo(true);
    try {
      const info = await settingsService.getSystemInfo();
      setSystemInfo(info);
      // Désactiver l'option Local si RAM < 8Go OU CPU ARM
      const shouldDisableLocal = info.ram < 8 || info.cpuType === 'arm';
      setLocalAiDisabled(shouldDisableLocal);
      // Si Local est désactivé et que c'était sélectionné, passer à Cloud
      if (shouldDisableLocal && aiType === 'local') {
        setAiType('cloud');
      }
    } catch (err) {
      console.error('Erreur lors de la vérification des informations système:', err);
      // En cas d'erreur, désactiver Local par sécurité
      setLocalAiDisabled(true);
      if (aiType === 'local') {
        setAiType('cloud');
      }
    } finally {
      setCheckingSystemInfo(false);
    }
  };

  useEffect(() => {
    // Vérifier les mises à jour au chargement
    checkUpdateStatus();
  }, []);

  // Fonction pour calculer la force du mot de passe
  const calculatePasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) {
      return { score: 0, label: '', color: '' };
    }

    let score = 0;
    
    // Longueur minimale
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    
    // Contient des minuscules
    if (/[a-z]/.test(pwd)) score += 1;
    
    // Contient des majuscules
    if (/[A-Z]/.test(pwd)) score += 1;
    
    // Contient des chiffres
    if (/[0-9]/.test(pwd)) score += 1;
    
    // Contient des caractères spéciaux
    if (/[^a-zA-Z0-9]/.test(pwd)) score += 1;
    
    // Déterminer le label et la couleur
    if (score <= 2) {
      return { score: 1, label: t('auth.passwordStrength.weak'), color: '#f44336' };
    } else if (score <= 4) {
      return { score: 2, label: t('auth.passwordStrength.medium'), color: '#ff9800' };
    } else {
      return { score: 3, label: t('auth.passwordStrength.strong'), color: '#4caf50' };
    }
  };

  // Mettre à jour la force du mot de passe quand il change
  useEffect(() => {
    const strength = calculatePasswordStrength(password);
    setPasswordStrength(strength);
  }, [password, t]);

  useEffect(() => {
    // Vérifier les informations système quand on arrive à l'étape IA
    if (currentStep === 'ai') {
      checkSystemInfo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

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

    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    
    // Vérifier les exigences du mot de passe
    if (!/[A-Z]/.test(password)) {
      setError(t('auth.passwordMissingUppercase'));
      return;
    }
    
    if (!/[^a-zA-Z0-9]/.test(password)) {
      setError(t('auth.passwordMissingSpecial'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register(email, password);
      
      // Vérifier que le token JWT a bien été généré et stocké
      const token = authService.getToken();
      if (!token) {
        console.error('Token JWT non généré après la création du compte');
        setError(t('auth.tokenGenerationError'));
        return;
      }
      
      console.log('Token JWT généré avec succès');
      setCurrentStep('store');
    } catch (err: any) {
      setError(err.message || t('auth.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleConnectStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setStoreError(null);
    setStoreSuccess(null);
    setStoreLoading(true);

    try {
      // Vérifier que le token JWT est bien présent avant de se connecter au store
      const token = authService.getToken();
      if (!token) {
        setStoreError(t('setup.store.noToken'));
        setStoreLoading(false);
        return;
      }

      const credentials: ConnectStoreDto = {
        email: storeEmail,
        password: storePassword,
      };

      const response = await storeService.connectStore(credentials);
      setStoreConnected(true);
      
      // Stocker le token JWT et l'email du store dans le navigateur
      if (response.tokenStore) {
        const storeData = {
          token: response.tokenStore,
          email: response.storeEmail,
        };
        localStorage.setItem('lumy_store', JSON.stringify(storeData));
        localStorage.removeItem('tokenStore');
      }
      
      setStoreSuccess(t('setup.store.connected'));
      setStoreEmail('');
      setStorePassword('');
    } catch (err: any) {
      // Extraire le message d'erreur
      let errorMessage = t('setup.store.error');
      if (err.message) {
        // Si c'est une erreur JSON, essayer de parser le message
        try {
          const errorData = JSON.parse(err.message);
          errorMessage = errorData.message || errorData.error || err.message;
        } catch {
          errorMessage = err.message;
        }
      }
      
      // Si c'est une erreur 401, donner un message plus explicite
      if (err.message?.includes('401') || err.message?.includes('Non autorisé') || err.message?.includes('Unauthorized')) {
        // Vérifier si c'est une erreur d'authentification JWT ou d'identifiants store
        const token = authService.getToken();
        if (!token) {
          errorMessage = t('setup.store.noToken');
        } else {
          errorMessage = t('setup.store.authError');
        }
      }
      
      setStoreError(errorMessage);
    } finally {
      setStoreLoading(false);
    }
  };

  const handleSkipStore = () => {
    setCurrentStep('ai');
  };

  const handleContinueFromStore = () => {
    setCurrentStep('ai');
  };

  const handleContinueFromAI = () => {
    setCurrentStep('weather');
  };

  const handleSaveWeather = async () => {
    if (!city || !zipCode || !country) {
      setWeatherError(t('setup.weather.fillAllFields'));
      return;
    }

    setWeatherLoading(true);
    setWeatherError(null);
    setWeatherSuccess(false);

    try {
      await settingsService.updateSettings({
        city,
        zipCode,
        country,
      });
      setWeatherSuccess(true);
    } catch (err: any) {
      setWeatherError(err.message || t('setup.weather.error'));
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleContinueFromWeather = () => {
    setCurrentStep('complete');
  };

  const handleSkipWeather = () => {
    setCurrentStep('complete');
  };


  const handleComplete = async () => {
    try {
      // Mettre à jour les settings pour indiquer que le setup est terminé
      await settingsService.updateSettings({ setup: false });
      // Nettoyer le localStorage
      localStorage.removeItem('setup_current_step');
      navigate('/');
    } catch (err) {
      console.error('Erreur lors de la finalisation du setup:', err);
      // Nettoyer le localStorage même en cas d'erreur
      localStorage.removeItem('setup_current_step');
      navigate('/');
    }
  };

  const steps = [
    t('setup.stepUpdate'),
    t('setup.stepAccount'),
    t('setup.stepStore'),
    t('setup.stepAI'),
    t('setup.stepWeather'),
    t('setup.stepComplete'),
  ];

  const getActiveStep = () => {
    switch (currentStep) {
      case 'update':
        return 0;
      case 'account':
        return 1;
      case 'store':
        return 2;
      case 'ai':
        return 3;
      case 'weather':
        return 4;
      case 'complete':
        return 5;
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
              
              {password && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={(passwordStrength.score / 3) * 100}
                      sx={{
                        flexGrow: 1,
                        height: 6,
                        borderRadius: 1,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: passwordStrength.color,
                        },
                      }}
                    />
                    {passwordStrength.label && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: passwordStrength.color,
                          fontWeight: 500,
                          minWidth: 60,
                          textAlign: 'right',
                        }}
                      >
                        {passwordStrength.label}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('auth.passwordStrength.requirements')}
                  </Typography>
                </Box>
              )}

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

      case 'store':
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
              {t('setup.store.title')}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('setup.store.description')}
            </Typography>

            {storeError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setStoreError(null)}>
                {storeError}
              </Alert>
            )}

            {storeSuccess && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setStoreSuccess(null)}>
                {storeSuccess}
              </Alert>
            )}

            {!storeConnected ? (
              <form onSubmit={handleConnectStore}>
                <Stack spacing={2}>
                  <TextField
                    label={t('auth.email')}
                    type="email"
                    value={storeEmail}
                    onChange={(e) => setStoreEmail(e.target.value)}
                    fullWidth
                    required
                    autoComplete="email"
                  />

                  <TextField
                    label={t('auth.password')}
                    type="password"
                    value={storePassword}
                    onChange={(e) => setStorePassword(e.target.value)}
                    fullWidth
                    required
                    autoComplete="current-password"
                  />

                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="outlined"
                      onClick={handleSkipStore}
                      fullWidth
                    >
                      {t('setup.store.skip')}
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      disabled={storeLoading}
                      fullWidth
                    >
                      {storeLoading ? t('common.loading') : t('setup.store.connect')}
                    </Button>
                  </Stack>
                  
                  <Box sx={{ mt: 2, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('setup.store.noAccount')}{' '}
                      <Link
                        href="https://store.lumy-home.com/user/register"
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ cursor: 'pointer' }}
                      >
                        {t('setup.store.createAccountLink')}
                      </Link>
                    </Typography>
                  </Box>
                </Stack>
              </form>
            ) : (
              <Box>
                <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
                  {t('setup.store.connected')}
                </Alert>
                <Button variant="contained" onClick={handleContinueFromStore} fullWidth>
                  {t('setup.continue')}
                </Button>
              </Box>
            )}
          </Box>
        );

      case 'ai':
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
              {t('setup.ai.title')}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('setup.ai.description')}
            </Typography>

            {checkingSystemInfo && (
              <Box sx={{ textAlign: 'center', py: 2 }}>
                <CircularProgress size={24} sx={{ mr: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  {t('setup.ai.checkingSystem')}
                </Typography>
              </Box>
            )}

            {systemInfo && (
              <Alert severity="info" sx={{ mb: 3 }}>
                {t('setup.ai.systemInfo', { 
                  ram: systemInfo.ram.toFixed(1), 
                  cpuType: systemInfo.cpuType.toUpperCase(),
                  cpuArch: systemInfo.cpuArch 
                })}
              </Alert>
            )}

            <Stack spacing={3}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={aiEnabled}
                    onChange={(e) => setAiEnabled(e.target.checked)}
                  />
                }
                label={t('setup.ai.enable')}
              />

              {aiEnabled && (
                <FormControl component="fieldset">
                  <FormLabel component="legend">{t('setup.ai.type')}</FormLabel>
                  <RadioGroup
                    value={aiType}
                    onChange={(e) => setAiType(e.target.value as 'cloud' | 'local')}
                  >
                    <FormControlLabel
                      value="cloud"
                      control={<Radio />}
                      label={
                        <Box>
                          <Typography variant="body1">{t('setup.ai.cloud')}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('setup.ai.cloudDescription')}
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      value="local"
                      control={<Radio />}
                      disabled={localAiDisabled}
                      label={
                        <Box>
                          <Typography variant="body1">
                            {t('setup.ai.local')}
                            {localAiDisabled && (
                              <Typography component="span" variant="caption" color="error" sx={{ ml: 1 }}>
                                ({t('setup.ai.localDisabled')})
                              </Typography>
                            )}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {t('setup.ai.localDescription')}
                          </Typography>
                        </Box>
                      }
                    />
                  </RadioGroup>
                </FormControl>
              )}

              <Button
                variant="contained"
                onClick={handleContinueFromAI}
                fullWidth
                sx={{ mt: 2 }}
              >
                {t('setup.continue')}
              </Button>
            </Stack>
          </Box>
        );

      case 'weather':
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
              {t('setup.weather.title')}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('setup.weather.description')}
            </Typography>

            {weatherError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setWeatherError(null)}>
                {weatherError}
              </Alert>
            )}

            {weatherSuccess && (
              <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
                {t('setup.weather.success')}
              </Alert>
            )}

            <Stack spacing={2}>
              <TextField
                label={t('settings.city')}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                fullWidth
                required
                disabled={weatherSuccess}
              />

              <TextField
                label={t('settings.zipCode')}
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                fullWidth
                required
                disabled={weatherSuccess}
              />

              <TextField
                label={t('settings.country')}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                fullWidth
                required
                disabled={weatherSuccess}
                placeholder={t('setup.weather.countryPlaceholder')}
              />

              {weatherSuccess ? (
                <Button variant="contained" onClick={handleContinueFromWeather} fullWidth>
                  {t('setup.continue')}
                </Button>
              ) : (
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="outlined"
                    onClick={handleSkipWeather}
                    fullWidth
                    disabled={weatherLoading}
                  >
                    {t('setup.weather.skip')}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSaveWeather}
                    disabled={weatherLoading || !city || !zipCode || !country}
                    fullWidth
                  >
                    {weatherLoading ? t('common.loading') : t('setup.weather.save')}
                  </Button>
                </Stack>
              )}
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
