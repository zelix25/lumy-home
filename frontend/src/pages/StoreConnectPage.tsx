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
  CircularProgress,
  Link,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { storeService, ConnectStoreDto } from '../services/store.service';

export default function StoreConnectPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [storeEmail, setStoreEmail] = useState<string | null>(null);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      setCheckingStatus(true);
      const status = await storeService.getConnectionStatus();
      setConnected(status.connected);
    } catch (err) {
      console.error('Erreur lors de la vérification du statut:', err);
      setConnected(false);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const credentials: ConnectStoreDto = {
        email,
        password,
      };

      const response = await storeService.connectStore(credentials);
      setConnected(true);
      setStoreEmail(response.storeEmail);
      
      // Stocker le token JWT du store dans le navigateur
      if (response.tokenStore) {
        localStorage.setItem('tokenStore', response.tokenStore);
      }
      
      setSuccess(t('store.connect.success'));
      setEmail('');
      setPassword('');
    } catch (err: any) {
      const errorMessage = err.message || t('store.connect.error');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await storeService.disconnectStore();
      setConnected(false);
      setStoreEmail(null);
      
      // Supprimer le token JWT du store du navigateur
      localStorage.removeItem('tokenStore');
      
      setSuccess(t('store.disconnect.success'));
    } catch (err: any) {
      const errorMessage = err.message || t('store.disconnect.error');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            {t('store.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {t('store.description')}
          </Typography>

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

          {connected ? (
            <Box>
              <Alert severity="success" sx={{ mb: 2 }}>
                {t('store.connected.message', { email: storeEmail || t('store.connected.unknown') })}
              </Alert>

              <Stack spacing={2}>
                <Typography variant="body1">
                  {t('store.connected.description')}
                </Typography>

                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleDisconnect}
                  disabled={loading}
                  fullWidth
                >
                  {loading ? <CircularProgress size={24} /> : t('store.disconnect.button')}
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleConnect}>
              <Stack spacing={2}>
                <Alert severity="info">
                  {t('store.connect.info')}
                </Alert>

                <TextField
                  label={t('store.connect.email')}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  disabled={loading}
                />

                <TextField
                  label={t('store.connect.password')}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  fullWidth
                  disabled={loading}
                />

                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !email || !password}
                  fullWidth
                >
                  {loading ? <CircularProgress size={24} /> : t('store.connect.button')}
                </Button>

                <Typography variant="body2" color="text.secondary" align="center">
                  {t('store.connect.noAccount')}{' '}
                  <Link
                    href="https://store.lumy-home.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('store.connect.createAccount')}
                  </Link>
                </Typography>
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

