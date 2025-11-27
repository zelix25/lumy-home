import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { useTranslation } from 'react-i18next';
import CreateAutomationDialog from '../components/CreateAutomationDialog';
import AutomationCard from '../components/AutomationCard';
import {
  automationsService,
  Automation,
} from '../services/automations.service';

export default function AssistantPage() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [llamaAvailable, setLlamaAvailable] = useState<boolean | null>(null);
  const [llamaMessage, setLlamaMessage] = useState<string | null>(null);
  const [checkingLlama, setCheckingLlama] = useState(true);

  const fetchAutomations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await automationsService.getAll();
      setAutomations(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des automatisations');
    } finally {
      setLoading(false);
    }
  };

  const checkLlamaStatus = async () => {
    try {
      setCheckingLlama(true);
      const status = await automationsService.checkStatus();
      setLlamaAvailable(status.available);
      setLlamaMessage(status.message || null);
    } catch (err: any) {
      setLlamaAvailable(false);
      setLlamaMessage(
        err.message || t('assistant.llamaUnavailableMessage'),
      );
    } finally {
      setCheckingLlama(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
    checkLlamaStatus();
  }, []);

  const handleAutomationCreated = (automation: Automation) => {
    setAutomations((prev) => [automation, ...prev]);
    fetchAutomations(); // Rafraîchir pour avoir les données complètes
  };

  const handleToggleStatus = async (
    id: string,
    status: 'active' | 'inactive',
  ) => {
    try {
      await automationsService.toggleStatus(id, status);
      setAutomations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a)),
      );
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la modification');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette automatisation ?')) {
      return;
    }

    try {
      await automationsService.delete(id);
      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 1 }}>
            {t('assistant.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('assistant.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
          disabled={llamaAvailable === false || checkingLlama}
        >
          {t('assistant.createAutomation')}
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {checkingLlama ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('assistant.checkingStatus')}
        </Alert>
      ) : llamaAvailable === false && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 500 }}>
            {t('assistant.llamaUnavailable')}
          </Typography>
          <Typography variant="body2">
            {t('assistant.llamaUnavailableMessage')}
          </Typography>
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : automations.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <SmartToyIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {t('assistant.noAutomationsCreated')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {t('assistant.noAutomationsCreatedHint')}
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
            disabled={llamaAvailable === false || checkingLlama}
          >
            {t('assistant.createAutomation')}
          </Button>
        </Box>
      ) : (
        <>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 3 }}>
            {t('assistant.myAutomations')}
          </Typography>
          <Grid container spacing={3}>
            {automations.map((automation) => (
              <Grid item xs={12} md={6} key={automation.id}>
                <AutomationCard
                  automation={automation}
                  onToggleStatus={handleToggleStatus}
                  onDelete={handleDelete}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      <CreateAutomationDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleAutomationCreated}
      />
    </Box>
  );
}

