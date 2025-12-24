import { Card, CardContent, Typography, Alert, Grid } from '@mui/material';
import PluginComponentLoader from './PluginComponentLoader';
import { PluginUIExtension } from '../services/plugins.service';

interface PluginWidgetLoaderProps {
  extension: PluginUIExtension;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
}

/**
 * Composant pour charger et afficher un widget de plugin dans le dashboard
 * 
 * Ce composant encapsule un widget dans une Card Material-UI et utilise
 * PluginComponentLoader pour charger le composant React du widget.
 */
export default function PluginWidgetLoader({
  extension,
  xs = 12,
  sm = 6,
  md = 4,
  lg = 3,
}: PluginWidgetLoaderProps) {
  if (!extension.componentPath) {
    return (
      <Grid item xs={xs} sm={sm} md={md} lg={lg}>
        <Card
          sx={{
            height: '100%',
            backgroundColor: '#FFFFFF',
            border: 'none',
            borderRadius: 1,
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          }}
        >
          <CardContent>
            <Alert severity="warning">
              Widget sans chemin de composant défini.
            </Alert>
          </CardContent>
        </Card>
      </Grid>
    );
  }

  return (
    <Grid item xs={xs} sm={sm} md={md} lg={lg}>
      <Card
        sx={{
          height: '100%',
          backgroundColor: '#FFFFFF',
          border: 'none',
          borderRadius: 1,
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          transition: 'all 0.15s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {extension.displayName && (
          <CardContent sx={{ pb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 500, mb: 1 }}>
              {extension.displayName}
            </Typography>
            {extension.description && (
              <Typography variant="body2" color="text.secondary">
                {extension.description}
              </Typography>
            )}
          </CardContent>
        )}
        <CardContent sx={{ flexGrow: 1, pt: extension.displayName ? 0 : 2 }}>
          <PluginComponentLoader
            extension={extension}
            props={{
              ...(extension.props || {}),
              pluginId: extension.pluginId,
              pluginName: extension.displayName,
            }}
          />
        </CardContent>
      </Card>
    </Grid>
  );
}

