import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Button,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Rating,
  IconButton,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  pluginsService,
  StorePlugin,
  StoreSearchParams,
  PluginCategory,
} from '../services/plugins.service';
import { useNotification } from '../hooks/useNotification';

export default function PluginsStorePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addNotification } = useNotification();

  const [plugins, setPlugins] = useState<StorePlugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PluginCategory | ''>('');
  const [categories, setCategories] = useState<Array<{ category: PluginCategory; count: number }>>(
    [],
  );
  const [sortBy, setSortBy] = useState<'name' | 'downloads' | 'rating' | 'updated'>('downloads');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [installing, setInstalling] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCategories();
    loadPlugins();
  }, []);

  useEffect(() => {
    // Rechercher avec un délai pour éviter trop de requêtes
    const timeoutId = setTimeout(() => {
      loadPlugins();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedCategory, sortBy, sortOrder]);

  const loadCategories = async () => {
    try {
      const cats = await pluginsService.getStoreCategories();
      setCategories(cats);
    } catch (err: any) {
      console.error('Erreur lors du chargement des catégories:', err);
    }
  };

  const loadPlugins = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: StoreSearchParams = {
        query: searchQuery || undefined,
        category: selectedCategory || undefined,
        sortBy,
        sortOrder,
        limit: 50,
      };
      const result = await pluginsService.searchStore(params);
      setPlugins(result.plugins);
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement des plugins');
      console.error('Erreur lors du chargement des plugins:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async (plugin: StorePlugin) => {
    if (installing.has(plugin.id)) return;

    setInstalling((prev) => new Set(prev).add(plugin.id));
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
      // Recharger la liste
      loadPlugins();
    } catch (err: any) {
      addNotification({
        type: 'error',
        title: t('plugins.installError'),
        message: err.message || t('plugins.installErrorMessage'),
      });
    } finally {
      setInstalling((prev) => {
        const newSet = new Set(prev);
        newSet.delete(plugin.id);
        return newSet;
      });
    }
  };

  const getCategoryLabel = (category?: PluginCategory) => {
    if (!category) return '';
    return t(`plugins.categories.${category}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('plugins.store.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t('plugins.store.subtitle')}
      </Typography>

      {/* Barre de recherche et filtres */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder={t('plugins.store.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />

        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 2 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>{t('plugins.store.category')}</InputLabel>
            <Select
              value={selectedCategory}
              label={t('plugins.store.category')}
              onChange={(e) => setSelectedCategory(e.target.value as PluginCategory | '')}
            >
              <MenuItem value="">{t('plugins.store.allCategories')}</MenuItem>
              {categories.map((cat) => (
                <MenuItem key={cat.category} value={cat.category}>
                  {getCategoryLabel(cat.category)} ({cat.count})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>{t('plugins.store.sortBy')}</InputLabel>
            <Select
              value={sortBy}
              label={t('plugins.store.sortBy')}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <MenuItem value="name">{t('plugins.store.sortByName')}</MenuItem>
              <MenuItem value="downloads">{t('plugins.store.sortByDownloads')}</MenuItem>
              <MenuItem value="rating">{t('plugins.store.sortByRating')}</MenuItem>
              <MenuItem value="updated">{t('plugins.store.sortByUpdated')}</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : plugins.length === 0 ? (
        <Alert severity="info">{t('plugins.store.noPluginsFound')}</Alert>
      ) : (
        <Grid container spacing={3}>
          {plugins.map((plugin) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={plugin.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {plugin.icon && (
                  <CardMedia
                    component="img"
                    height="140"
                    image={plugin.icon}
                    alt={plugin.displayName}
                    sx={{ objectFit: 'contain', p: 2 }}
                  />
                )}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {plugin.displayName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {plugin.description || t('plugins.store.noDescription')}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
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
                          ({plugin.reviews || 0})
                        </Typography>
                      </Box>
                    )}
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    {t('plugins.store.downloads')}: {plugin.downloads || 0} • {t('plugins.store.version')}: {plugin.version}
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => handleInstall(plugin)}
                    disabled={installing.has(plugin.id)}
                  >
                    {installing.has(plugin.id) ? t('plugins.installing') : t('plugins.install')}
                  </Button>
                  <Tooltip title={t('plugins.store.viewDetails')}>
                    <IconButton
                      size="small"
                      onClick={() => navigate(`/plugins/store/${plugin.id}`)}
                    >
                      <InfoIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

