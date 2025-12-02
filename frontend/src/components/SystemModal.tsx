import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Stack,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';

interface SystemModalProps {
  open: boolean;
  onClose: () => void;
  onRestart: () => void;
  onShutdown: () => void;
}

export default function SystemModal({
  open,
  onClose,
  onRestart,
  onShutdown,
}: SystemModalProps) {
  const { t } = useTranslation();

  const handleRestart = () => {
    onRestart();
    onClose();
  };

  const handleShutdown = () => {
    onShutdown();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('system.title')}</DialogTitle>
      <DialogContent>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {t('system.description')}
        </Typography>
        <Stack spacing={2}>
          <Button
            variant="contained"
            color="warning"
            startIcon={<RestartAltIcon />}
            onClick={handleRestart}
            fullWidth
            size="large"
          >
            {t('system.restart')}
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<PowerSettingsNewIcon />}
            onClick={handleShutdown}
            fullWidth
            size="large"
          >
            {t('system.shutdown')}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

