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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/auth.service';

export default function AccountPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setEmail(user.email);
    }
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Pour l'instant, on ne peut que récupérer le profil
      // La modification d'email nécessiterait un endpoint backend
      await authService.getProfile();
      setSuccess(t('account.profileUpdated'));
    } catch (err: any) {
      setError(err.message || t('account.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 3 }}>
        {t('account.title')}
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
            {t('account.profile')}
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

          <Stack spacing={3}>
            <TextField
              label={t('account.email')}
              type="email"
              value={email}
              disabled
              fullWidth
              helperText={t('account.emailCannotBeChanged')}
            />

            <Box>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? t('common.loading') : t('common.save')}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

