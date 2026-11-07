import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Stack,
  InputAdornment,
  IconButton,
  Divider,
  CircularProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { recoveryUpdaterService } from '../services/recoveryUpdater.service';
import type { CheckResult, ServiceUpdateInfo } from '../services/updater.service';

const LOGO_PATH = '/assets/logo.png';

export default function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [isLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Mode recovery (bypass backend → lumy-updater)
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [updaterReachable, setUpdaterReachable] = useState<boolean | null>(null);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError(t('auth.fillAllFields'));
      return;
    }

    if (!isLogin && password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message || t('auth.error'));
    } finally {
      setLoading(false);
    }
  };

  const enterRecovery = async () => {
    setRecoveryMode(true);
    setRecoveryError(null);
    setRecoverySuccess(null);
    setCheckResult(null);
    setUpdaterReachable(null);
    setRecoveryBusy(true);
    try {
      await recoveryUpdaterService.getStatus();
      setUpdaterReachable(true);
    } catch {
      setUpdaterReachable(false);
      setRecoveryError(t('auth.recovery.updaterUnreachable'));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const handleCheckUpdates = async () => {
    setRecoveryError(null);
    setRecoverySuccess(null);
    setRecoveryBusy(true);
    try {
      const result = await recoveryUpdaterService.checkForUpdates();
      setCheckResult(result);
      setUpdaterReachable(true);
      if (!result.hasUpdates) {
        setRecoverySuccess(t('auth.recovery.noUpdates'));
      }
    } catch (err: any) {
      setUpdaterReachable(false);
      setRecoveryError(err.message || t('auth.recovery.checkError'));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const handleApplyUpdates = async () => {
    setRecoveryError(null);
    setRecoverySuccess(null);
    setRecoveryBusy(true);
    try {
      const servicesWithUpdate =
        checkResult?.updates
          ?.filter((u: ServiceUpdateInfo) => u.hasUpdate)
          .map((u) => u.service) || undefined;

      const result = await recoveryUpdaterService.applyUpdate(
        servicesWithUpdate?.length ? servicesWithUpdate : undefined,
      );

      if (result.ok) {
        setRecoverySuccess(
          t('auth.recovery.applySuccess', {
            services: result.updated?.join(', ') || '—',
          }),
        );
        setCheckResult(null);
      } else {
        setRecoveryError(t('auth.recovery.applyError'));
      }
    } catch (err: any) {
      setRecoveryError(err.message || t('auth.recovery.applyError'));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const updates =
    checkResult?.updates?.filter((u: ServiceUpdateInfo) => u.hasUpdate) || [];

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
      <Card sx={{ maxWidth: recoveryMode ? 480 : 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Box
              component="img"
              src={LOGO_PATH}
              alt="Lumy Home"
              sx={{ height: 56, width: 'auto' }}
            />
          </Box>

          {!recoveryMode ? (
            <>
              <Typography
                variant="h4"
                gutterBottom
                sx={{ fontWeight: 500, mb: 3, textAlign: 'center' }}
              >
                {t('auth.login')}
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
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
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    required
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={
                              showPassword
                                ? t('auth.hidePassword')
                                : t('auth.showPassword')
                            }
                            onClick={() => setShowPassword((v) => !v)}
                            onMouseDown={(e) => e.preventDefault()}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    disabled={loading}
                    sx={{ mt: 2 }}
                  >
                    {loading ? t('common.loading') : t('auth.login')}
                  </Button>
                </Stack>
              </form>

              <Divider sx={{ my: 3 }} />

              <Button
                variant="text"
                color="inherit"
                fullWidth
                startIcon={<BuildCircleOutlinedIcon />}
                onClick={enterRecovery}
                sx={{ color: 'text.secondary' }}
              >
                {t('auth.recovery.button')}
              </Button>
            </>
          ) : (
            <>
              <Typography
                variant="h5"
                gutterBottom
                sx={{ fontWeight: 500, mb: 1, textAlign: 'center' }}
              >
                {t('auth.recovery.title')}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2, textAlign: 'center' }}
              >
                {t('auth.recovery.description')}
              </Typography>

              <Alert severity="warning" sx={{ mb: 2 }}>
                {t('auth.recovery.warning')}
              </Alert>

              {updaterReachable !== null && (
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                  <Chip
                    size="small"
                    label={
                      updaterReachable
                        ? t('auth.recovery.updaterOnline')
                        : t('auth.recovery.updaterOffline')
                    }
                    color={updaterReachable ? 'success' : 'error'}
                  />
                </Box>
              )}

              {recoveryError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRecoveryError(null)}>
                  {recoveryError}
                </Alert>
              )}

              {recoverySuccess && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setRecoverySuccess(null)}>
                  {recoverySuccess}
                </Alert>
              )}

              {updates.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('auth.recovery.availableUpdates')}
                  </Typography>
                  <List dense disablePadding>
                    {updates.map((u) => (
                      <ListItem key={u.service} disableGutters>
                        <ListItemText
                          primary={u.service}
                          secondary={
                            u.lastImage
                              ? `${u.currentImage || '?'} → ${u.lastImage}`
                              : u.currentImage
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              <Stack spacing={1.5}>
                <Button
                  variant="outlined"
                  fullWidth
                  disabled={recoveryBusy}
                  onClick={handleCheckUpdates}
                >
                  {recoveryBusy ? (
                    <CircularProgress size={22} />
                  ) : (
                    t('auth.recovery.check')
                  )}
                </Button>

                <Button
                  variant="contained"
                  color="warning"
                  fullWidth
                  disabled={recoveryBusy || !updaterReachable}
                  onClick={handleApplyUpdates}
                >
                  {recoveryBusy ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : (
                    t('auth.recovery.apply')
                  )}
                </Button>

                <Typography variant="caption" color="text.secondary" align="center">
                  {t('auth.recovery.applyHint')}
                </Typography>

                <Button
                  variant="text"
                  startIcon={<ArrowBackIcon />}
                  onClick={() => setRecoveryMode(false)}
                  disabled={recoveryBusy}
                  sx={{ mt: 1 }}
                >
                  {t('auth.recovery.back')}
                </Button>
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
