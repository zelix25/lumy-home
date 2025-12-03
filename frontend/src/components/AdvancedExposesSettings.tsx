import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Alert,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import { devicesService } from '../services/devices.service';

interface ExposeFeature {
  type: string;
  name?: string;
  property?: string;
  access?: number;
  value_min?: number;
  value_max?: number;
  value_step?: number;
  unit?: string;
  value_on?: any;
  value_off?: any;
  values?: any[];
  description?: string;
  features?: ExposeFeature[];
}

interface Expose {
  type: string;
  name?: string;
  features?: ExposeFeature[];
  property?: string;
  access?: number;
  value_min?: number;
  value_max?: number;
  value_step?: number;
  unit?: string;
  value_on?: any;
  value_off?: any;
  values?: any[];
  description?: string;
}

interface AdvancedExposesSettingsProps {
  deviceId: string;
  friendlyName: string;
  exposes: Expose[];
  currentState: Record<string, any>;
  onStateUpdate?: () => void;
}

const getAccessLabel = (access: number | undefined): string => {
  if (!access) return 'Lecture seule';
  // access: 1 = read, 2 = write, 3 = read+write, 7 = read+write+report
  if (access === 1) return 'Lecture seule';
  if (access === 2) return 'Écriture seule';
  if (access === 3 || access === 7) return 'Lecture/Écriture';
  return 'Inconnu';
};

const renderFeatureControl = (
  feature: ExposeFeature,
  currentValue: any,
  onValueChange: (property: string, value: any) => void,
  deviceId: string,
  friendlyName: string,
): JSX.Element | null => {
  const property = feature.property || feature.name;
  if (!property) return null;

  const access = feature.access || 0;
  const canWrite = access === 2 || access === 3 || access === 7;

  if (!canWrite) {
    return (
      <Box key={property} sx={{ mb: 2 }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          {feature.name || property} ({getAccessLabel(access)})
        </Typography>
        <Typography variant="body1">
          {currentValue !== undefined ? String(currentValue) : 'N/A'}
          {feature.unit && ` ${feature.unit}`}
        </Typography>
      </Box>
    );
  }

  switch (feature.type) {
    case 'binary':
      return (
        <Box key={property} sx={{ mb: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={currentValue === feature.value_on || currentValue === true}
                onChange={(e) => {
                  const newValue = e.target.checked ? (feature.value_on ?? true) : (feature.value_off ?? false);
                  onValueChange(property, newValue);
                }}
              />
            }
            label={feature.name || property}
          />
          {feature.description && (
            <Typography variant="caption" color="text.secondary" display="block">
              {feature.description}
            </Typography>
          )}
        </Box>
      );

    case 'enum':
      return (
        <Box key={property} sx={{ mb: 2 }}>
          <FormControl fullWidth>
            <InputLabel>{feature.name || property}</InputLabel>
            <Select
              value={currentValue !== undefined ? String(currentValue) : ''}
              label={feature.name || property}
              onChange={(e) => onValueChange(property, e.target.value)}
            >
              {feature.values?.map((val, idx) => (
                <MenuItem key={idx} value={String(val)}>
                  {String(val)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {feature.description && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {feature.description}
            </Typography>
          )}
        </Box>
      );

    case 'numeric':
      const min = feature.value_min ?? 0;
      const max = feature.value_max ?? 100;
      const step = feature.value_step ?? 1;
      const isFloat = step < 1 || (min % 1 !== 0) || (max % 1 !== 0);

      return (
        <Box key={property} sx={{ mb: 2 }}>
          <Typography gutterBottom>
            {feature.name || property}
            {feature.unit && ` (${feature.unit})`}
          </Typography>
          <Box sx={{ px: 2 }}>
            <Slider
              value={currentValue !== undefined ? Number(currentValue) : min}
              onChange={(_, val) => {
                const numVal = Array.isArray(val) ? val[0] : val;
                onValueChange(property, isFloat ? Number(numVal.toFixed(2)) : numVal);
              }}
              min={min}
              max={max}
              step={step}
              marks={max - min <= 10}
              valueLabelDisplay="auto"
            />
          </Box>
          <TextField
            fullWidth
            type="number"
            size="small"
            value={currentValue !== undefined ? currentValue : ''}
            onChange={(e) => {
              const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= min && val <= max) {
                onValueChange(property, val);
              }
            }}
            inputProps={{ min, max, step }}
            sx={{ mt: 1 }}
          />
          {feature.description && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {feature.description}
            </Typography>
          )}
        </Box>
      );

    case 'text':
      return (
        <Box key={property} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label={feature.name || property}
            value={currentValue !== undefined ? String(currentValue) : ''}
            onChange={(e) => onValueChange(property, e.target.value)}
            multiline={feature.type === 'text' && (String(currentValue || '').length > 50)}
            rows={feature.type === 'text' && (String(currentValue || '').length > 50) ? 3 : 1}
          />
          {feature.description && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {feature.description}
            </Typography>
          )}
        </Box>
      );

    default:
      return (
        <Box key={property} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label={feature.name || property}
            value={currentValue !== undefined ? String(currentValue) : ''}
            onChange={(e) => {
              // Essayer de convertir en nombre si possible
              const numVal = Number(e.target.value);
              onValueChange(property, isNaN(numVal) ? e.target.value : numVal);
            }}
          />
          {feature.description && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              {feature.description}
            </Typography>
          )}
        </Box>
      );
  }
};

export default function AdvancedExposesSettings({
  deviceId,
  friendlyName,
  exposes,
  currentState,
  onStateUpdate,
}: AdvancedExposesSettingsProps) {
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleValueChange = (property: string, value: any) => {
    setPendingChanges((prev) => ({ ...prev, [property]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSave = async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await devicesService.sendCommand(deviceId, pendingChanges);
      setPendingChanges({});
      setSuccess(true);
      if (onStateUpdate) {
        setTimeout(() => {
          onStateUpdate();
        }, 500);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde des paramètres');
      console.error('Erreur lors de la sauvegarde:', err);
    } finally {
      setSaving(false);
    }
  };

  const renderExpose = (expose: Expose, index: number): JSX.Element => {
    const hasFeatures = expose.features && expose.features.length > 0;
    const isCluster = expose.type === 'cluster' || hasFeatures;

    if (isCluster && hasFeatures) {
      return (
        <Accordion key={index} defaultExpanded={index === 0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                {expose.name || expose.type || `Cluster ${index + 1}`}
              </Typography>
              {expose.description && (
                <Chip label={expose.description} size="small" variant="outlined" />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ pl: 2 }}>
              {expose.features?.map((feature, featureIndex) => {
                const property = feature.property || feature.name;
                if (!property) return null;

                const currentValue = pendingChanges[property] !== undefined
                  ? pendingChanges[property]
                  : currentState[property];

                return (
                  <Box key={featureIndex} sx={{ mb: 2 }}>
                    {renderFeatureControl(feature, currentValue, handleValueChange, deviceId, friendlyName)}
                  </Box>
                );
              })}
            </Box>
          </AccordionDetails>
        </Accordion>
      );
    }

    // Expose simple (non-cluster)
    const property = expose.property || expose.name;
    if (!property) return <div key={index} />;

    const currentValue = pendingChanges[property] !== undefined
      ? pendingChanges[property]
      : currentState[property];

    const feature: ExposeFeature = {
      type: expose.type,
      name: expose.name,
      property: expose.property,
      access: expose.access,
      value_min: expose.value_min,
      value_max: expose.value_max,
      value_step: expose.value_step,
      unit: expose.unit,
      value_on: expose.value_on,
      value_off: expose.value_off,
      values: expose.values,
      description: expose.description,
    };

    return (
      <Box key={index} sx={{ mb: 2 }}>
        {renderFeatureControl(feature, currentValue, handleValueChange, deviceId, friendlyName)}
      </Box>
    );
  };

  if (!exposes || exposes.length === 0) {
    return (
      <Card>
        <CardContent>
          <Alert severity="info">
            Aucune exposition configurable disponible pour cet appareil.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            Réglages avancés (Expositions Zigbee2MQTT)
          </Typography>
          {Object.keys(pendingChanges).length > 0 && (
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              size="small"
            >
              {saving ? 'Enregistrement...' : `Enregistrer (${Object.keys(pendingChanges).length})`}
            </Button>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(false)}>
            Paramètres enregistrés avec succès
          </Alert>
        )}

        <Box>
          {exposes.map((expose, index) => renderExpose(expose, index))}
        </Box>

        {Object.keys(pendingChanges).length > 0 && (
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              fullWidth
            >
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

