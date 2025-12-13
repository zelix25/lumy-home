import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Rating,
  Divider,
  Grid,
  IconButton,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import { useTranslation } from 'react-i18next';
import { pluginsService, StorePlugin } from '../services/plugins.service';
import { useNotification } from '../hooks/useNotification';

export default function PluginDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { addNotification } = useNotification();

  const [plugin, setPlugin] = useState<StorePlugin | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (id) {
      loadPlugin();
    }
  }, [id]);

  const loadPlugin = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const data = await pluginsService.getStorePlugin(id);
      setPlugin(data);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement du plugin');
      console.error('Erreur lors du chargement du plugin:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!plugin || installing) return;

    setInstalling(true);
    try {
      await pluginsService.install({
        source: plugin.id,
        version: plugin.version,
      });
      addNotification({
        type: 'success',
        title: t('plugins.installSuccess'),
        message: t('plugins.installSuccessMessage', { name: plugin.displayName }),
      });
      navigate('/plugins');
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('plugins.installError'),
        message: err.message || t('plugins.installErrorMessage'),
      });
    } finally {
      setInstalling(false);
    }
  };

  const getCategoryLabel = (category?: string) => {
    if (!category) return '';
    return t(`plugins.categories.${category}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !plugin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || 'Plugin non trouvé'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/plugins/store')} sx={{ mt: 2 }}>
          {t('common.back')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <IconButton onClick={() => navigate('/plugins/store')} sx={{ mb: 2 }}>
        <ArrowBackIcon />
      </IconButton>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'start', gap: 2, mb: 2 }}>
                {plugin.icon && (
                  <Box
                    component="img"
                    src={plugin.icon}
                    alt={plugin.displayName}
                    sx={{ width: 80, height: 80, objectFit: 'contain' }}
                  />
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h4" gutterBottom>
                    {plugin.displayName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {plugin.author || t('plugins.unknownAuthor')} • {t('plugins.store.version')} {plugin.version}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                    {plugin.category && (
                      <Chip
                        label={getCategoryLabel(plugin.category)}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {plugin.rating !== undefined && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Rating value={plugin.rating} readOnly size="small" />
                        <Typography variant="caption">
                          {plugin.rating.toFixed(1)} ({plugin.reviews || 0} {t('plugins.store.reviews')})
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="h6" gutterBottom>
                {t('plugins.store.description')}
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                {plugin.description || t('plugins.store.noDescription')}
              </Typography>

              {plugin.tags && plugin.tags.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    {t('plugins.store.tags')}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                    {plugin.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" />
                    ))}
                  </Stack>
                </>
              )}

              {plugin.screenshots && plugin.screenshots.length > 0 && (
                <>
                  <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                    {t('plugins.store.screenshots')}
                  </Typography>
                  <Grid container spacing={2}>
                    {plugin.screenshots.map((screenshot, index) => (
                      <Grid item xs={12} sm={6} key={index}>
                        <Box
                          component="img"
                          src={screenshot}
                          alt={`Screenshot ${index + 1}`}
                          sx={{ width: '100%', borderRadius: 1 }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('plugins.store.install')}
              </Typography>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    {t('plugins.store.downloads')}: {plugin.downloads || 0}
                  </Typography>
                  {plugin.lumyVersion && (
                    <Typography variant="body2" color="text.secondary">
                      {t('plugins.store.requiresLumy')}: {plugin.lumyVersion}
                    </Typography>
                  )}
                  {plugin.license && (
                    <Typography variant="body2" color="text.secondary">
                      {t('plugins.store.license')}: {plugin.license}
                    </Typography>
                  )}
                </Box>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={installing ? <CircularProgress size={20} /> : <DownloadIcon />}
                  onClick={handleInstall}
                  disabled={installing}
                >
                  {installing ? t('plugins.installing') : t('plugins.install')}
                </Button>
                {plugin.repository && (
                  <Button
                    variant="outlined"
                    fullWidth
                    href={plugin.repository}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('plugins.store.viewRepository')}
                  </Button>
                )}
                {plugin.documentation && (
                  <Button
                    variant="outlined"
                    fullWidth
                    href={plugin.documentation}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t('plugins.store.documentation')}
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

