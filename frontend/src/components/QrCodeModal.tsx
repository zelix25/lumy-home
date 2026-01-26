import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import QRCode from 'react-qr-code';
import { useTranslation } from 'react-i18next';
import { settingsService } from '../services/settings.service';

interface QrCodeModalProps {
  open: boolean;
  onClose: () => void;
}

export default function QrCodeModal({ open, onClose }: QrCodeModalProps) {
  const { t } = useTranslation();
  const [ip, setIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchServerIp = useCallback(async () => {
    setLoading(true);
    setError(null);
    setIp(null);
    try {
      const response = await settingsService.getServerIp();
      setIp(response.ip);
    } catch (err: any) {
      console.error('Erreur lors de la récupération de l\'IP:', err);
      setError(err.message || t('qrCode.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) {
      fetchServerIp();
    } else {
      // Réinitialiser l'état quand la modal se ferme
      setIp(null);
      setError(null);
      setLoading(false);
    }
  }, [open, fetchServerIp]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      disableEscapeKeyDown={false}
    >
      <DialogTitle>{t('qrCode.title')}</DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            py: 2,
          }}
        >
          {loading ? (
            <CircularProgress />
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : ip ? (
            <>
              <Box
                sx={{
                  p: 2,
                  backgroundColor: '#ffffff',
                  borderRadius: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <QRCode value={ip} size={256} />
              </Box>
              <Typography variant="body2" color="text.secondary" align="center">
                {t('qrCode.description')}
              </Typography>
              <Typography variant="body1" sx={{ fontWeight: 500, mt: 1 }}>
                {ip}
              </Typography>
            </>
          ) : null}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.close')}</Button>
      </DialogActions>
    </Dialog>
  );
}
