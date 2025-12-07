import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Stack,
  Slider,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useTranslation } from 'react-i18next';
import { useDevices } from '../hooks/useDevices';
import {
  simpleAutomationsService,
  AutomationTriggerType,
  AutomationActionType,
  CreateAutomationDto,
  UpdateAutomationDto,
  Automation,
} from '../services/simple-automations.service';
import { useNotification } from '../hooks/useNotification';
import { useEffect } from 'react';

interface CreateSimpleAutomationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  automation?: Automation | null;
}

//const steps = ['trigger', 'device', 'action'];

export default function CreateSimpleAutomationDialog({
  open,
  onClose,
  onSuccess,
  automation,
}: CreateSimpleAutomationDialogProps) {
  const { t } = useTranslation();
  const { devices } = useDevices();
  const { addNotification } = useNotification();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // État de l'automatisation
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType | ''>('');
  const [triggerDeviceId, setTriggerDeviceId] = useState<string>('');
  const [actionType, setActionType] = useState<AutomationActionType | ''>('');
  const [actionDeviceId, setActionDeviceId] = useState<string>('');
  const [brightness, setBrightness] = useState(100);
  const [colorTemp, setColorTemp] = useState(370);
  const [thermostatTemp, setThermostatTemp] = useState(20);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [turnOnDuration, setTurnOnDuration] = useState<number>(0);

  const handleReset = () => {
    setActiveStep(0);
    setName('');
    setDescription('');
    setTriggerType('');
    setTriggerDeviceId('');
    setActionType('');
    setActionDeviceId('');
    setBrightness(100);
    setColorTemp(370);
    setThermostatTemp(20);
    setNotificationMessage('');
    setTurnOnDuration(0);
    setError(null);
  };

  // Charger les données de l'automation si on est en mode édition
  useEffect(() => {
    if (automation && open) {
      setName(automation.name);
      setDescription(automation.description || '');
      setTriggerType(automation.trigger.type);
      setTriggerDeviceId(automation.trigger.deviceId || '');
      setActionType(automation.actions[0]?.type || '');
      setActionDeviceId(automation.actions[0]?.deviceId || '');
      setBrightness(automation.actions[0]?.params?.brightness || 100);
      setColorTemp(automation.actions[0]?.params?.color_temp || 370);
      setThermostatTemp(automation.actions[0]?.params?.temperature || 20);
      setNotificationMessage(automation.actions[0]?.params?.message || '');
      setTurnOnDuration(automation.actions[0]?.params?.duration || 0);
      // Définir l'étape active selon les données chargées
      if (automation.trigger.type && automation.trigger.deviceId) {
        if (automation.actions[0]?.type) {
          setActiveStep(2); // Toutes les étapes sont complètes
        } else {
          setActiveStep(1); // Trigger et device sont sélectionnés
        }
      }
    } else if (!automation && open) {
      // Réinitialiser si on est en mode création
      handleReset();
    }
  }, [automation, open]);

  // Filtrer les appareils selon le type de déclencheur
  const getAvailableTriggerDevices = () => {
    if (!triggerType) return [];
    
    switch (triggerType) {
      case AutomationTriggerType.MOTION:
        return devices.filter((d) => d.type === 'motion' || d.type === 'sensor');
      case AutomationTriggerType.CONTACT:
        return devices.filter((d) => d.type === 'door' || d.type === 'window');
      case AutomationTriggerType.TEMPERATURE:
        return devices.filter((d) => d.type === 'temperature' || d.type === 'sensor');
      case AutomationTriggerType.BUTTON:
        return devices.filter((d) => d.type === 'button' || d.type === 'switch');
      case AutomationTriggerType.VIBRATION:
        return devices.filter((d) => d.type === 'sensor' || d.state?.vibration !== undefined);
      case AutomationTriggerType.ILLUMINANCE:
        return devices.filter((d) => d.type === 'sensor' || d.state?.illuminance !== undefined);
      case AutomationTriggerType.HUMIDITY:
        return devices.filter((d) => d.type === 'temperature' || d.type === 'sensor');
      case AutomationTriggerType.WATER_LEAK:
        return devices.filter((d) => d.type === 'sensor');
      case AutomationTriggerType.SMOKE:
        return devices.filter((d) => d.type === 'sensor');
      case AutomationTriggerType.GAS:
        return devices.filter((d) => d.type === 'sensor');
      case AutomationTriggerType.SUNRISE_SUNSET:
        return []; // Pas besoin d'appareil pour le lever/coucher du soleil
      default:
        return [];
    }
  };

  // Filtrer les appareils selon le type d'action
  const getAvailableActionDevices = () => {
    if (!actionType) return [];
    
    switch (actionType) {
      case AutomationActionType.TURN_ON:
      case AutomationActionType.TURN_OFF:
      case AutomationActionType.SET_BRIGHTNESS:
      case AutomationActionType.SET_COLOR:
      case AutomationActionType.SET_COLOR_TEMP:
        return devices.filter((d) => d.type === 'light' || d.type === 'switch' || d.type === 'plug');
      case AutomationActionType.TOGGLE:
        return devices.filter((d) => d.type === 'switch' || d.type === 'plug');
      case AutomationActionType.SET_THERMOSTAT:
        return devices.filter((d) => d.type === 'thermostat');
      case AutomationActionType.NOTIFY:
        return []; // Pas besoin d'appareil pour les notifications
      default:
        return [];
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && !triggerType) {
      setError(t('automations.selectTrigger'));
      return;
    }
    // Si le déclencheur est SUNRISE_SUNSET, on saute l'étape de sélection d'appareil (pas besoin d'appareil)
    if (activeStep === 0 && triggerType === AutomationTriggerType.SUNRISE_SUNSET) {
      setError(null);
      setActiveStep(2); // Passer directement à l'étape 3 (action)
      return;
    }
    if (activeStep === 1 && !triggerDeviceId) {
      setError(t('automations.selectTriggerDevice'));
      return;
    }
    if (activeStep === 2 && !actionType) {
      setError(t('automations.selectAction'));
      return;
    }
    if (activeStep === 2 && actionType !== AutomationActionType.NOTIFY && !actionDeviceId) {
      setError(t('automations.selectActionDevice'));
      return;
    }
    setError(null);
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    // Si on revient en arrière depuis l'étape 3 (action) et que le déclencheur est SUNRISE_SUNSET,
    // on revient directement à l'étape 1 (déclencheur) car l'étape 2 (appareil) est sautée
    if (activeStep === 2 && triggerType === AutomationTriggerType.SUNRISE_SUNSET) {
      setActiveStep(0);
    } else {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t('automations.nameRequired'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const triggerDevice = triggerDeviceId ? devices.find((d) => d.ieeeAddress === triggerDeviceId) : null;
      const actionDevice = actionDeviceId ? devices.find((d) => d.ieeeAddress === actionDeviceId) : null;

      if (automation) {
        // Mode édition
        const updateData: UpdateAutomationDto = {
          name: name.trim(),
          description: description.trim() || undefined,
          trigger: {
            type: triggerType as AutomationTriggerType,
            deviceId: triggerDeviceId,
            deviceName: triggerDevice?.friendlyName,
          },
          actions: [
            {
              type: actionType as AutomationActionType,
              deviceId: actionDeviceId || '',
              deviceName: actionDevice?.friendlyName,
              params:
                actionType === AutomationActionType.TURN_ON
                  ? { duration: turnOnDuration }
                  : actionType === AutomationActionType.SET_BRIGHTNESS
                  ? { brightness }
                  : actionType === AutomationActionType.SET_COLOR_TEMP
                  ? { color_temp: colorTemp }
                  : actionType === AutomationActionType.SET_THERMOSTAT
                  ? { temperature: thermostatTemp }
                  : actionType === AutomationActionType.NOTIFY
                  ? { message: notificationMessage || t('automations.defaultNotification') }
                  : undefined,
            },
          ],
        };

        await simpleAutomationsService.update(automation.id, updateData);
        addNotification({
          type: 'success',
          title: t('automations.updated'),
          message: t('automations.updatedMessage'),
        });
      } else {
        // Mode création
        const createData: CreateAutomationDto = {
          name: name.trim(),
          description: description.trim() || undefined,
          trigger: {
            type: triggerType as AutomationTriggerType,
            deviceId: triggerDeviceId,
            deviceName: triggerDevice?.friendlyName,
          },
          actions: [
            {
              type: actionType as AutomationActionType,
              deviceId: actionDeviceId || '',
              deviceName: actionDevice?.friendlyName,
              params:
                actionType === AutomationActionType.TURN_ON
                  ? { duration: turnOnDuration }
                  : actionType === AutomationActionType.SET_BRIGHTNESS
                  ? { brightness }
                  : actionType === AutomationActionType.SET_COLOR_TEMP
                  ? { color_temp: colorTemp }
                  : actionType === AutomationActionType.SET_THERMOSTAT
                  ? { temperature: thermostatTemp }
                  : actionType === AutomationActionType.NOTIFY
                  ? { message: notificationMessage || t('automations.defaultNotification') }
                  : undefined,
            },
          ],
        };

        await simpleAutomationsService.create(createData);
        addNotification({
          type: 'success',
          title: t('automations.created'),
          message: t('automations.createdMessage'),
        });
      }
      handleReset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || (automation ? t('automations.updateError') : t('automations.createError')));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const getTriggerTypeLabel = (type: AutomationTriggerType) => {
    switch (type) {
      case AutomationTriggerType.MOTION:
        return t('automations.triggerMotion');
      case AutomationTriggerType.CONTACT:
        return t('automations.triggerContact');
      case AutomationTriggerType.TEMPERATURE:
        return t('automations.triggerTemperature');
      case AutomationTriggerType.BUTTON:
        return t('automations.triggerButton');
      case AutomationTriggerType.VIBRATION:
        return t('automations.triggerVibration');
      case AutomationTriggerType.ILLUMINANCE:
        return t('automations.triggerIlluminance');
      case AutomationTriggerType.HUMIDITY:
        return t('automations.triggerHumidity');
      case AutomationTriggerType.WATER_LEAK:
        return t('automations.triggerWaterLeak');
      case AutomationTriggerType.SMOKE:
        return t('automations.triggerSmoke');
      case AutomationTriggerType.GAS:
        return t('automations.triggerGas');
      case AutomationTriggerType.SUNRISE_SUNSET:
        return t('automations.triggerSunriseSunset');
      default:
        return type;
    }
  };

  const getActionTypeLabel = (type: AutomationActionType) => {
    switch (type) {
      case AutomationActionType.TURN_ON:
        return t('automations.actionTurnOn');
      case AutomationActionType.TURN_OFF:
        return t('automations.actionTurnOff');
      case AutomationActionType.TOGGLE:
        return t('automations.actionToggle');
      case AutomationActionType.SET_BRIGHTNESS:
        return t('automations.actionSetBrightness');
      case AutomationActionType.SET_COLOR:
        return t('automations.actionSetColor');
      case AutomationActionType.SET_COLOR_TEMP:
        return t('automations.actionSetColorTemp');
      case AutomationActionType.SET_THERMOSTAT:
        return t('automations.actionSetThermostat');
      case AutomationActionType.NOTIFY:
        return t('automations.actionNotify');
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{automation ? t('automations.editAutomation') : t('automations.createAutomation')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <TextField
            label={t('automations.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <TextField
            label={t('automations.description')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Étape 1: Choisir un déclencheur */}
          <Step>
            <StepLabel>{t('automations.stepTrigger')}</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('automations.stepTriggerDescription')}
              </Typography>
              <Stack spacing={1}>
                {/* Groupe Détection */}
                <Accordion defaultExpanded>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {t('automations.triggerGroupDetection')}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1}>
                      {[
                        AutomationTriggerType.MOTION,
                        AutomationTriggerType.CONTACT,
                        AutomationTriggerType.VIBRATION,
                        AutomationTriggerType.WATER_LEAK,
                        AutomationTriggerType.SMOKE,
                        AutomationTriggerType.GAS,
                      ].map((type) => (
                        <Chip
                          key={type}
                          label={getTriggerTypeLabel(type)}
                          onClick={() => {
                            setTriggerType(type);
                            setTriggerDeviceId('');
                            setError(null);
                          }}
                          color={triggerType === type ? 'primary' : 'default'}
                          variant={triggerType === type ? 'filled' : 'outlined'}
                          sx={{
                            justifyContent: 'flex-start',
                            height: 'auto',
                            py: 1.5,
                            ...(triggerType === type && {
                              bgcolor: 'primary.dark',
                              color: 'white',
                              '&:hover': {
                                bgcolor: 'primary.dark',
                              },
                            }),
                          }}
                        />
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* Groupe Environnement */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {t('automations.triggerGroupEnvironment')}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1}>
                      {[
                        AutomationTriggerType.TEMPERATURE,
                        AutomationTriggerType.ILLUMINANCE,
                        AutomationTriggerType.HUMIDITY,
                        AutomationTriggerType.SUNRISE_SUNSET,
                      ].map((type) => (
                        <Chip
                          key={type}
                          label={getTriggerTypeLabel(type)}
                          onClick={() => {
                            setTriggerType(type);
                            setTriggerDeviceId('');
                            setError(null);
                          }}
                          color={triggerType === type ? 'primary' : 'default'}
                          variant={triggerType === type ? 'filled' : 'outlined'}
                          sx={{
                            justifyContent: 'flex-start',
                            height: 'auto',
                            py: 1.5,
                            ...(triggerType === type && {
                              bgcolor: 'primary.dark',
                              color: 'white',
                              '&:hover': {
                                bgcolor: 'primary.dark',
                              },
                            }),
                          }}
                        />
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>

                {/* Groupe Interaction */}
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {t('automations.triggerGroupInteraction')}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1}>
                      {[AutomationTriggerType.BUTTON].map((type) => (
                        <Chip
                          key={type}
                          label={getTriggerTypeLabel(type)}
                          onClick={() => {
                            setTriggerType(type);
                            setTriggerDeviceId('');
                            setError(null);
                          }}
                          color={triggerType === type ? 'primary' : 'default'}
                          variant={triggerType === type ? 'filled' : 'outlined'}
                          sx={{
                            justifyContent: 'flex-start',
                            height: 'auto',
                            py: 1.5,
                            ...(triggerType === type && {
                              bgcolor: 'primary.dark',
                              color: 'white',
                              '&:hover': {
                                bgcolor: 'primary.dark',
                              },
                            }),
                          }}
                        />
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Stack>
              <Box sx={{ mt: 2 }}>
                {activeStep > 0 && (
                  <Button onClick={handleBack} size="small" sx={{ mr: 1 }}>
                    {t('common.back')}
                  </Button>
                )}
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!triggerType}
                >
                  {t('common.next')}
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Étape 2: Choisir un appareil déclencheur */}
          {triggerType !== AutomationTriggerType.SUNRISE_SUNSET && (
            <Step>
              <StepLabel>{t('automations.stepDevice')}</StepLabel>
              <StepContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {t('automations.stepDeviceDescription')}
                </Typography>
                {triggerType && (
                  <List>
                    {getAvailableTriggerDevices().map((device) => (
                      <ListItem key={device.ieeeAddress} disablePadding>
                        <ListItemButton
                          selected={triggerDeviceId === device.ieeeAddress}
                          onClick={() => {
                            setTriggerDeviceId(device.ieeeAddress);
                            setError(null);
                          }}
                        >
                          <ListItemText
                            primary={device.friendlyName || device.ieeeAddress}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                )}
                {triggerType && getAvailableTriggerDevices().length === 0 && (
                  <Alert severity="info">{t('automations.noDevicesAvailable')}</Alert>
                )}
                <Box sx={{ mt: 2 }}>
                  <Button onClick={handleBack} size="small">
                    {t('common.back')}
                  </Button>
                  <Button variant="contained" onClick={handleNext} sx={{ ml: 1 }} disabled={!triggerDeviceId}>
                    {t('common.next')}
                  </Button>
                </Box>
              </StepContent>
            </Step>
          )}

          {/* Étape 3: Choisir une action */}
          <Step>
            <StepLabel>{t('automations.stepAction')}</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('automations.stepActionDescription')}
              </Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>
                {Object.values(AutomationActionType).map((type) => (
                  <Box key={type}>
                    <Chip
                      label={getActionTypeLabel(type)}
                      onClick={() => {
                        setActionType(type);
                        setActionDeviceId('');
                        setError(null);
                      }}
                      color={actionType === type ? 'primary' : 'default'}
                      variant={actionType === type ? 'filled' : 'outlined'}
                      sx={{
                        justifyContent: 'flex-start',
                        height: 'auto',
                        py: 1.5,
                        width: '100%',
                        ...(actionType === type && {
                          bgcolor: 'primary.dark',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'primary.dark',
                          },
                        }),
                      }}
                    />
                    {type === AutomationActionType.TURN_ON && actionType === type && (
                      <Box sx={{ mt: 2, ml: 2, mb: 1 }}>
                        <TextField
                          type="number"
                          label={t('automations.duration')}
                          value={turnOnDuration}
                          onChange={(e) => setTurnOnDuration(Math.max(0, parseInt(e.target.value) || 0))}
                          inputProps={{ min: 0, step: 1 }}
                          size="small"
                          sx={{ width: 200 }}
                          helperText={turnOnDuration === 0 ? t('automations.durationInfinite') : t('automations.durationSeconds', { seconds: turnOnDuration })}
                        />
                      </Box>
                    )}
                  </Box>
                ))}
              </Stack>

              {actionType && actionType !== AutomationActionType.NOTIFY && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('automations.selectActionDevice')}
                  </Typography>
                  <List>
                    {getAvailableActionDevices().map((device) => (
                      <ListItem key={device.ieeeAddress} disablePadding>
                        <ListItemButton
                          selected={actionDeviceId === device.ieeeAddress}
                          onClick={() => {
                            setActionDeviceId(device.ieeeAddress);
                            setError(null);
                          }}
                        >
                          <ListItemText
                            primary={device.friendlyName || device.ieeeAddress}
                            secondary={device.model || device.type}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </>
              )}

              {actionType === AutomationActionType.SET_BRIGHTNESS && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('automations.brightness')}
                  </Typography>
                  <Slider
                    value={brightness}
                    onChange={(_, value) => setBrightness(value as number)}
                    min={1}
                    max={100}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}%`}
                  />
                </>
              )}

              {actionType === AutomationActionType.SET_COLOR_TEMP && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('automations.colorTemp')}
                  </Typography>
                  <Slider
                    value={colorTemp}
                    onChange={(_, value) => setColorTemp(value as number)}
                    min={153}
                    max={500}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}K`}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    {t('automations.colorTempDescription')}
                  </Typography>
                </>
              )}

              {actionType === AutomationActionType.SET_THERMOSTAT && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('automations.thermostatTemp')}
                  </Typography>
                  <TextField
                    type="number"
                    label={t('automations.temperature')}
                    value={thermostatTemp}
                    onChange={(e) => setThermostatTemp(parseFloat(e.target.value) || 20)}
                    inputProps={{ min: 5, max: 35, step: 0.5 }}
                    size="small"
                    sx={{ width: 200 }}
                    helperText={t('automations.thermostatTempDescription')}
                  />
                </>
              )}

              {actionType === AutomationActionType.NOTIFY && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <TextField
                    label={t('automations.notificationMessage')}
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    fullWidth
                    multiline
                    rows={3}
                    placeholder={t('automations.defaultNotification')}
                  />
                </>
              )}

              <Box sx={{ mt: 2 }}>
                <Button onClick={handleBack} size="small">
                  {t('common.back')}
                </Button>
                <Button
                  variant="contained"
                  onClick={handleCreate}
                  sx={{ ml: 1 }}
                  disabled={loading || !actionType || (actionType !== AutomationActionType.NOTIFY && !actionDeviceId)}
                >
                  {loading ? t('common.loading') : automation ? t('common.save') : t('automations.create')}
                </Button>
              </Box>
            </StepContent>
          </Step>
        </Stepper>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

