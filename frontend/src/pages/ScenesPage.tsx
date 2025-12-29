import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  CircularProgress,
  Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import { useTranslation } from 'react-i18next';
import { simpleAutomationsService, Automation } from '../services/simple-automations.service';
import { useNotification } from '../hooks/useNotification';
import SimpleAutomationCard from '../components/SimpleAutomationCard';
import CreateSimpleAutomationDialog from '../components/CreateSimpleAutomationDialog';
import NodeEditorDialog from '../components/NodeEditorDialog';

export default function ScenesPage() {
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [nodeEditorOpen, setNodeEditorOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);

  const fetchAutomations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await simpleAutomationsService.getAll();
      setAutomations(data);
    } catch (err: any) {
      setError(err.message || t('automations.loadError'));
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: err.message || t('automations.loadError'),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAutomations();
  }, []);

  const handleCreateSuccess = () => {
    fetchAutomations();
    setEditingAutomation(null);
  };

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setCreateDialogOpen(true);
  };

  const handleEditNode = (automation: Automation) => {
    setEditingAutomation(automation);
    setNodeEditorOpen(true);
  };

  const handleDialogClose = () => {
    setCreateDialogOpen(false);
    setEditingAutomation(null);
  };

  const handleNodeEditorClose = () => {
    setNodeEditorOpen(false);
    setEditingAutomation(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 1 }}>
            {t('scenes.title')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('scenes.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AccountTreeIcon />}
            onClick={() => setNodeEditorOpen(true)}
          >
            {t('scenes.createAutomation')}
          </Button>
          {/*<Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCreateDialogOpen(true)}
          >
            {t('automations.createAutomation')}
          </Button>*/}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {automations.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t('automations.noAutomationsCreated')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {t('automations.noAutomationsCreatedHint')}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setNodeEditorOpen(true)}
              >
                {t('scenes.createAutomation')}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {automations.map((automation) => (
            <Grid item xs={12} md={6} key={automation.id}>
              <SimpleAutomationCard
                automation={automation}
                onUpdate={fetchAutomations}
                onEdit={handleEdit}
                onEditNode={handleEditNode}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <CreateSimpleAutomationDialog
        open={createDialogOpen}
        onClose={handleDialogClose}
        onSuccess={handleCreateSuccess}
        automation={editingAutomation}
      />

      <NodeEditorDialog
        open={nodeEditorOpen}
        onClose={handleNodeEditorClose}
        onSuccess={handleCreateSuccess}
        automation={editingAutomation}
      />
    </Box>
  );
}

