import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  Alert,
  Stack,
  Stepper,
  Step,
  StepLabel,
  Link,
  LinearProgress,
  Autocomplete,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth.service';
import { settingsService } from '../services/settings.service';
import { storeService, ConnectStoreDto } from '../services/store.service';
import { setupService } from '../services/setup.service';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { MenuItem, Select, FormControl, InputLabel, CircularProgress } from '@mui/material';

type SetupStep = 'account' | 'store' | 'weather' | 'zigbee' | 'complete';

/** À mettre à true pour réafficher l'étape configuration Zigbee (USB / adaptateur). */
const SHOW_ZIGBEE_STEP = false;
const LOGO_PATH = '/assets/logo.png';

const COMMON_TIMEZONES = [
  'Europe/Paris',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Amsterdam',
  'Europe/Brussels',
  'Europe/Zurich',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
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

export default function SetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register } = useAuth();
  
  // Récupérer l'étape depuis localStorage ou utiliser 'account' par défaut
  const getInitialStep = (): SetupStep => {
    const savedStep = localStorage.getItem('setup_current_step');
    if (savedStep && ['account', 'store', 'weather', 'zigbee', 'complete'].includes(savedStep)) {
      if (!SHOW_ZIGBEE_STEP && savedStep === 'zigbee') {
        return 'complete';
      }
      return savedStep as SetupStep;
    }
    return 'account';
  };
  
  const [currentStep, setCurrentStep] = useState<SetupStep>(getInitialStep());
  
  // Sauvegarder l'étape dans localStorage à chaque changement
  useEffect(() => {
    localStorage.setItem('setup_current_step', currentStep);
  }, [currentStep]);

  useEffect(() => {
    if (!SHOW_ZIGBEE_STEP && currentStep === 'zigbee') {
      setCurrentStep('complete');
    }
  }, [currentStep]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<{ score: number; label: string; color: string }>({ score: 0, label: '', color: '' });
  
  // Étape 2: Store
  const [storeEmail, setStoreEmail] = useState('');
  const [storePassword, setStorePassword] = useState('');
  const [storeConnected, setStoreConnected] = useState(false);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storeSuccess, setStoreSuccess] = useState<string | null>(null);

  // Étape 3: Météo
  const [timezone, setTimezone] = useState('Europe/Paris');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherSuccess, setWeatherSuccess] = useState(false);

  // Étape 4: Zigbee
  const [usbDevices, setUsbDevices] = useState<string[]>([]);
  const [selectedPort, setSelectedPort] = useState('');
  const [selectedAdapter, setSelectedAdapter] = useState('zigate');
  const [zigbeeLoading, setZigbeeLoading] = useState(false);
  const [zigbeeError, setZigbeeError] = useState<string | null>(null);
  const [zigbeeSuccess, setZigbeeSuccess] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);


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
    setCurrentStep('weather');
  };

  const handleContinueFromStore = () => {
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
        timezone,
      });
      setWeatherSuccess(true);
    } catch (err: any) {
      setWeatherError(err.message || t('setup.weather.error'));
    } finally {
      setWeatherLoading(false);
    }
  };

  const handleContinueFromWeather = () => {
    setCurrentStep(SHOW_ZIGBEE_STEP ? 'zigbee' : 'complete');
  };

  const handleSkipWeather = () => {
    setCurrentStep(SHOW_ZIGBEE_STEP ? 'zigbee' : 'complete');
  };

  // Charger les périphériques USB au montage de l'étape zigbee
  useEffect(() => {
    if (SHOW_ZIGBEE_STEP && currentStep === 'zigbee' && usbDevices.length === 0) {
      loadUsbDevices();
    }
  }, [currentStep]);

  const loadUsbDevices = async () => {
    setLoadingDevices(true);
    try {
      const response = await setupService.getUsbDevices();
      setUsbDevices(response.devices);
      // Sélectionner automatiquement le premier périphérique s'il n'y en a qu'un
      if (response.devices.length === 1) {
        setSelectedPort(response.devices[0]);
      }
    } catch (err: any) {
      setZigbeeError(err.message || t('setup.zigbee.errorLoadingDevices'));
    } finally {
      setLoadingDevices(false);
    }
  };

  const handleSaveZigbee = async () => {
    if (!selectedPort || !selectedAdapter) {
      setZigbeeError(t('setup.zigbee.fillAllFields'));
      return;
    }

    setZigbeeLoading(true);
    setZigbeeError(null);
    setZigbeeSuccess(false);

    try {
      const response = await setupService.configureZigbee({
        port: selectedPort,
        adapter: selectedAdapter,
      });
      if (response.success) {
        setZigbeeSuccess(true);
      } else {
        setZigbeeError(response.message || t('setup.zigbee.error'));
      }
    } catch (err: any) {
      setZigbeeError(err.message || t('setup.zigbee.error'));
    } finally {
      setZigbeeLoading(false);
    }
  };

  const handleContinueFromZigbee = () => {
    setCurrentStep('complete');
  };

  const handleSkipZigbee = () => {
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

  const steps = SHOW_ZIGBEE_STEP
    ? [
        t('setup.stepAccount'),
        t('setup.stepStore'),
        t('setup.stepWeather'),
        t('setup.stepZigbee'),
        t('setup.stepComplete'),
      ]
    : [
        t('setup.stepAccount'),
        t('setup.stepStore'),
        t('setup.stepWeather'),
        t('setup.stepComplete'),
      ];

  const getActiveStep = () => {
    if (SHOW_ZIGBEE_STEP) {
      switch (currentStep) {
        case 'account':
          return 0;
        case 'store':
          return 1;
        case 'weather':
          return 2;
        case 'zigbee':
          return 3;
        case 'complete':
          return 4;
        default:
          return 0;
      }
    }
    switch (currentStep) {
      case 'account':
        return 0;
      case 'store':
        return 1;
      case 'weather':
        return 2;
      case 'complete':
        return 3;
      case 'zigbee':
        return 3;
      default:
        return 0;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
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
              <Autocomplete
                options={getTimezoneOptions()}
                value={timezone || null}
                onChange={(_, newValue) =>
                  setTimezone(newValue || 'Europe/Paris')
                }
                onInputChange={(_, newInputValue) =>
                  setTimezone(newInputValue || 'Europe/Paris')
                }
                freeSolo
                disabled={weatherSuccess}
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

      case 'zigbee':
        if (!SHOW_ZIGBEE_STEP) {
          return null;
        }
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 500 }}>
              {t('setup.zigbee.title')}
            </Typography>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {t('setup.zigbee.description')}
            </Typography>

            {zigbeeError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setZigbeeError(null)}>
                {zigbeeError}
              </Alert>
            )}

            {zigbeeSuccess && (
              <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 3 }}>
                {t('setup.zigbee.success')}
              </Alert>
            )}

            <Stack spacing={2}>
              <FormControl fullWidth required disabled={zigbeeSuccess || loadingDevices}>
                <InputLabel>{t('setup.zigbee.port')}</InputLabel>
                <Select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  label={t('setup.zigbee.port')}
                  disabled={loadingDevices}
                >
                  {loadingDevices ? (
                    <MenuItem disabled>
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                      {t('setup.zigbee.loadingDevices')}
                    </MenuItem>
                  ) : usbDevices.length === 0 ? (
                    <MenuItem disabled>{t('setup.zigbee.noDevices')}</MenuItem>
                  ) : (
                    usbDevices.map((device) => (
                      <MenuItem key={device} value={device}>
                        {device}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>

              {usbDevices.length === 0 && !loadingDevices && (
                <Button
                  variant="outlined"
                  onClick={loadUsbDevices}
                  disabled={loadingDevices}
                  fullWidth
                >
                  {t('setup.zigbee.refreshDevices')}
                </Button>
              )}

              <FormControl fullWidth required disabled={zigbeeSuccess}>
                <InputLabel>{t('setup.zigbee.adapter')}</InputLabel>
                <Select
                  value={selectedAdapter}
                  onChange={(e) => setSelectedAdapter(e.target.value)}
                  label={t('setup.zigbee.adapter')}
                >
                  <MenuItem value="ember">{t('setup.zigbee.adapters.ember')}</MenuItem>
                  <MenuItem value="zstack">{t('setup.zigbee.adapters.zstack')}</MenuItem>
                  <MenuItem value="zigate">{t('setup.zigbee.adapters.zigate')}</MenuItem>
                  <MenuItem value="deconz">{t('setup.zigbee.adapters.deconz')}</MenuItem>
                  <MenuItem value="ezsp">{t('setup.zigbee.adapters.ezsp')}</MenuItem>
                  <MenuItem value="zigatev3">{t('setup.zigbee.adapters.zigatev3')}</MenuItem>
                </Select>
              </FormControl>

              {zigbeeSuccess ? (
                <Button variant="contained" onClick={handleContinueFromZigbee} fullWidth>
                  {t('setup.continue')}
                </Button>
              ) : (
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="outlined"
                    onClick={handleSkipZigbee}
                    fullWidth
                    disabled={zigbeeLoading}
                  >
                    {t('setup.zigbee.skip')}
                  </Button>
                  <Button
                    variant="contained"
                    onClick={handleSaveZigbee}
                    disabled={zigbeeLoading || !selectedPort || !selectedAdapter}
                    fullWidth
                  >
                    {zigbeeLoading ? t('common.loading') : t('setup.zigbee.save')}
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
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box
              component="img"
              src={LOGO_PATH}
              alt="Lumy Home"
              sx={{ height: 64, width: 'auto' }}
            />
          </Box>
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
