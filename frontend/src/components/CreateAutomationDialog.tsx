import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Alert,
  Card,
  CardContent,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { automationsService, Automation } from '../services/automations.service';

interface CreateAutomationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (automation: Automation) => void;
}

const EXAMPLES = [
  'assistant.example1',
  'assistant.example2',
  'assistant.example3',
];

export default function CreateAutomationDialog({
  open,
  onClose,
  onSuccess,
}: CreateAutomationDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Automation | null>(null);

  const handleExampleClick = (exampleKey: string) => {
    setQuery(t(exampleKey));
    setError(null);
    setPreview(null);
  };

  const handleGenerate = async () => {
    if (!query.trim()) {
      setError('Veuillez entrer une description');
      return;
    }

    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const automation = await automationsService.generateAutomation(query);
      setPreview(automation);
    } catch (err: any) {
      setError(
        err.message ||
          t('assistant.errorCreating'),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (preview) {
      onSuccess(preview);
      handleClose();
    }
  };

  const handleClose = () => {
    setQuery('');
    setError(null);
    setPreview(null);
    onClose();
  };

  const formatTriggerText = (trigger: Automation['trigger']): string => {
    const triggerTypeMap: Record<string, string> = {
      motion: 'il y a du mouvement',
      contact: 'une porte ou fenêtre',
      temperature: 'la température change',
      button: 'un bouton est pressé',
      time: "l'heure spécifiée",
      manual: 'déclenchement manuel',
    };

    const baseText = triggerTypeMap[trigger.type] || trigger.type;

    if (trigger.deviceName) {
      return `${baseText} sur "${trigger.deviceName}"`;
    }

    return baseText;
  };

  const formatActionText = (action: Automation['actions'][0]): string => {
    const actionTypeMap: Record<string, string> = {
      turn_on: 'allumer',
      turn_off: 'éteindre',
      set_brightness: 'régler la luminosité de',
      set_color: 'changer la couleur de',
      notify: 'envoyer une notification pour',
    };

    const actionText = actionTypeMap[action.type] || action.type;
    const deviceName = action.deviceName || '';

    if (action.type === 'set_brightness' && action.params?.brightness) {
      return `${actionText} "${deviceName}" à ${action.params.brightness}%`;
    }

    return `${actionText} "${deviceName}"`;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('assistant.createAutomationTitle')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('assistant.createAutomationDescription')}
          </Typography>

          {/* Exemples */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              {t('assistant.examples')}:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {EXAMPLES.map((exampleKey, index) => (
                <Chip
                  key={index}
                  label={t(exampleKey)}
                  onClick={() => handleExampleClick(exampleKey)}
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: 'primary.main',
                      color: 'white',
                    },
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Champ de saisie */}
          <TextField
            fullWidth
            multiline
            rows={3}
            placeholder={t('assistant.enterYourRequest')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
              setPreview(null);
            }}
            disabled={loading}
            sx={{ mb: 2 }}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Aperçu de l'automatisation */}
          {preview && (
            <Card sx={{ mt: 2, backgroundColor: 'rgba(134, 166, 160, 0.05)' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
                  {t('assistant.preview')}
                </Typography>
                <Typography variant="body1" sx={{ mb: 1 }}>
                  <strong>{t('assistant.when')}:</strong> {formatTriggerText(preview.trigger)}
                </Typography>
                <Typography variant="body1">
                  <strong>{t('assistant.then')}:</strong>{' '}
                  {preview.actions.map(formatActionText).join(', ')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, fontStyle: 'italic' }}>
                  {preview.description}
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {preview ? t('common.cancel') : t('common.back')}
        </Button>
        {!preview ? (
          <Button
            onClick={handleGenerate}
            variant="contained"
            disabled={loading || !query.trim()}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? t('assistant.generating') : t('assistant.generate')}
          </Button>
        ) : (
          <Button onClick={handleConfirm} variant="contained">
            {t('common.save')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

