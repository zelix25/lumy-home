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
  Card,
  CardContent,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import WindowIcon from '@mui/icons-material/Window';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import SecurityIcon from '@mui/icons-material/Security';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
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
  const [automationCategory, setAutomationCategory] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<AutomationTriggerType | ''>('');
  const [triggerDeviceId, setTriggerDeviceId] = useState<string>('');
  const [actionType, setActionType] = useState<AutomationActionType | ''>('');
  const [actionDeviceId, setActionDeviceId] = useState<string>('');
  const [actionDeviceIds, setActionDeviceIds] = useState<string[]>([]); // Support multiple devices
  const [brightness, setBrightness] = useState(100);
  const [colorTemp, setColorTemp] = useState(370);
  const [thermostatTemp, setThermostatTemp] = useState(20);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [turnOnDuration, setTurnOnDuration] = useState<number>(0);

  const handleReset = () => {
    setActiveStep(0);
    setAutomationCategory('');
    setName('');
    setDescription('');
    setTriggerType('');
    setTriggerDeviceId('');
    setActionType('');
    setActionDeviceId('');
    setActionDeviceIds([]);
    setBrightness(100);
    setColorTemp(370);
    setThermostatTemp(20);
    setNotificationMessage('');
    setTurnOnDuration(0);
    setError(null);
  };

  // Catégories d'automation
  const automationCategories = [
    {
      id: 'lights',
      label: t('automations.categoryLights'),
      icon: <LightbulbIcon />,
      description: t('automations.categoryLightsDescription'),
      suggestedTriggers: [
        AutomationTriggerType.MOTION,
        AutomationTriggerType.BUTTON,
        AutomationTriggerType.SUNRISE_SUNSET,
        AutomationTriggerType.ILLUMINANCE,
      ],
      suggestedActions: [
        AutomationActionType.TURN_ON,
        AutomationActionType.TURN_OFF,
        AutomationActionType.SET_BRIGHTNESS,
        AutomationActionType.SET_COLOR_TEMP,
      ],
    },
    {
      id: 'shutters',
      label: t('automations.categoryShutters'),
      icon: <WindowIcon />,
      description: t('automations.categoryShuttersDescription'),
      suggestedTriggers: [
        AutomationTriggerType.SUNRISE_SUNSET,
        AutomationTriggerType.BUTTON,
        AutomationTriggerType.ILLUMINANCE,
      ],
      suggestedActions: [
        AutomationActionType.TURN_ON,
        AutomationActionType.TURN_OFF,
        AutomationActionType.TOGGLE,
      ],
    },
    {
      id: 'temperature',
      label: t('automations.categoryTemperature'),
      icon: <ThermostatIcon />,
      description: t('automations.categoryTemperatureDescription'),
      suggestedTriggers: [
        AutomationTriggerType.TEMPERATURE,
        AutomationTriggerType.BUTTON,
        AutomationTriggerType.SUNRISE_SUNSET,
      ],
      suggestedActions: [
        AutomationActionType.SET_THERMOSTAT,
        AutomationActionType.TURN_ON,
        AutomationActionType.TURN_OFF,
      ],
    },
    {
      id: 'security',
      label: t('automations.categorySecurity'),
      icon: <SecurityIcon />,
      description: t('automations.categorySecurityDescription'),
      suggestedTriggers: [
        AutomationTriggerType.MOTION,
        AutomationTriggerType.CONTACT,
        AutomationTriggerType.VIBRATION,
        AutomationTriggerType.SMOKE,
        AutomationTriggerType.GAS,
        AutomationTriggerType.WATER_LEAK,
      ],
      suggestedActions: [
        AutomationActionType.NOTIFY,
        AutomationActionType.TURN_ON,
        AutomationActionType.TURN_OFF,
      ],
    },
    {
      id: 'other',
      label: t('automations.categoryOther'),
      icon: <MoreHorizIcon />,
      description: t('automations.categoryOtherDescription'),
      suggestedTriggers: Object.values(AutomationTriggerType),
      suggestedActions: Object.values(AutomationActionType),
    },
  ];

  // Charger les données de l'automation si on est en mode édition
  useEffect(() => {
    if (automation && open) {
      setName(automation.name);
      setDescription(automation.description || '');
      setTriggerType(automation.trigger.type);
      setTriggerDeviceId(automation.trigger.deviceId || '');
      setActionType(automation.actions[0]?.type || '');
      setActionDeviceId(automation.actions[0]?.deviceId || '');
      // Charger tous les appareils d'action
      const deviceIds = automation.actions.map((action) => action.deviceId).filter(Boolean);
      setActionDeviceIds(deviceIds);
      setBrightness(automation.actions[0]?.params?.brightness || 100);
      setColorTemp(automation.actions[0]?.params?.color_temp || 370);
      setThermostatTemp(automation.actions[0]?.params?.temperature || 20);
      setNotificationMessage(automation.actions[0]?.params?.message || '');
      setTurnOnDuration(automation.actions[0]?.params?.duration || 0);
      // Définir l'étape active selon les données chargées
      if (automation.trigger.type) {
        if (automation.trigger.deviceId || automation.trigger.type === AutomationTriggerType.SUNRISE_SUNSET) {
          if (automation.actions[0]?.type) {
            setActiveStep(4); // Toutes les étapes sont complètes (étape 4 = action + devices)
          } else {
            setActiveStep(3); // Trigger et device sont sélectionnés, aller à l'étape action
          }
        } else {
          setActiveStep(1); // Seulement le trigger est sélectionné
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
    // Étape 0 : Vérifier la catégorie
    if (activeStep === 0 && !automationCategory) {
      setError(t('automations.selectCategory'));
      return;
    }
    // Étape 1 : Vérifier le déclencheur
    if (activeStep === 1 && !triggerType) {
      setError(t('automations.selectTrigger'));
      return;
    }
    // Si le déclencheur est SUNRISE_SUNSET, on saute l'étape de sélection d'appareil déclencheur
    if (activeStep === 1 && triggerType === AutomationTriggerType.SUNRISE_SUNSET) {
      setError(null);
      setActiveStep(3); // Passer directement à l'étape 3 (action)
      return;
    }
    // Étape 2 : Vérifier l'appareil déclencheur
    if (activeStep === 2 && !triggerDeviceId) {
      setError(t('automations.selectTriggerDevice'));
      return;
    }
    // Étape 3 : Vérifier l'action
    if (activeStep === 3 && !actionType) {
      setError(t('automations.selectAction'));
      return;
    }
    // Étape 4 : Vérifier l'appareil d'action
    if (activeStep === 4 && actionType !== AutomationActionType.NOTIFY && actionDeviceIds.length === 0) {
      setError(t('automations.selectActionDevice'));
      return;
    }
    setError(null);
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError(null);
    // Si on revient en arrière depuis l'étape 3 (action) et que le déclencheur est SUNRISE_SUNSET,
    // on revient directement à l'étape 1 (déclencheur) car l'étape 2 (appareil déclencheur) est sautée
    if (activeStep === 3 && triggerType === AutomationTriggerType.SUNRISE_SUNSET) {
      setActiveStep(1);
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

      // Support multiple action devices
      const actionDevices = actionDeviceIds.length > 0 
        ? devices.filter((d) => actionDeviceIds.includes(d.ieeeAddress))
        : actionDeviceId 
        ? [devices.find((d) => d.ieeeAddress === actionDeviceId)].filter(Boolean)
        : [];

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
          actions: actionDevices.length > 0
            ? actionDevices.map((device) => ({
                type: actionType as AutomationActionType,
                deviceId: device?.ieeeAddress || '',
                deviceName: device?.friendlyName,
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
              }))
            : [
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
          actions: actionDevices.length > 0
            ? actionDevices.map((device) => ({
                type: actionType as AutomationActionType,
                deviceId: device?.ieeeAddress || '',
                deviceName: device?.friendlyName,
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
              }))
            : [
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
          {/* Étape 0: Choisir la catégorie d'automation */}
          <Step>
            <StepLabel>{t('automations.stepCategory')}</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('automations.stepCategoryDescription')}
              </Typography>
              <Stack spacing={2}>
                {automationCategories.map((category) => (
                  <Card
                    key={category.id}
                    sx={{
                      cursor: 'pointer',
                      border: automationCategory === category.id ? 2 : 1,
                      borderColor: automationCategory === category.id ? 'primary.main' : 'divider',
                      bgcolor: automationCategory === category.id ? 'primary.light' : 'background.paper',
                      '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: automationCategory === category.id ? 'primary.light' : 'action.hover',
                      },
                      transition: 'all 0.2s',
                    }}
                    onClick={() => {
                      setAutomationCategory(category.id);
                      setTriggerType('');
                      setActionType('');
                      setError(null);
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ color: automationCategory === category.id ? 'primary.main' : 'text.secondary' }}>
                          {category.icon}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 500 }}>
                            {category.label}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {category.description}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!automationCategory}
                >
                  {t('common.next')}
                </Button>
              </Box>
            </StepContent>
          </Step>

          {/* Étape 1: Choisir un déclencheur */}
          {automationCategory && (
            <Step>
              <StepLabel>{t('automations.stepTrigger')}</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('automations.stepTriggerDescription')}
              </Typography>
              {(() => {
                const selectedCategory = automationCategories.find((c) => c.id === automationCategory);
                const availableTriggers = selectedCategory?.suggestedTriggers || Object.values(AutomationTriggerType);
                
                return (
                  <Stack spacing={1}>
                    {availableTriggers.map((type) => (
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
                          width: '100%',
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
                );
              })()}
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
          )}

          {/* Étape 2: Choisir un appareil déclencheur */}
          {automationCategory && triggerType && triggerType !== AutomationTriggerType.SUNRISE_SUNSET && (
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
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body1">
                                  {device.friendlyName || device.ieeeAddress}
                                </Typography>
                                {device.room && (
                                  <Chip 
                                    label={device.room} 
                                    size="small" 
                                    variant="outlined"
                                    sx={{ height: 20, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                            }
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
          {automationCategory && triggerType && (
            <Step>
              <StepLabel>{t('automations.stepAction')}</StepLabel>
              <StepContent>
              {triggerType === AutomationTriggerType.SUNRISE_SUNSET && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                    {t('automations.sunriseSunsetInfoTitle')}
                  </Typography>
                  <Typography variant="body2">
                    {t('automations.sunriseSunsetInfo')}
                  </Typography>
                </Alert>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('automations.stepActionDescription')}
              </Typography>
              {(() => {
                const selectedCategory = automationCategories.find((c) => c.id === automationCategory);
                const availableActions = selectedCategory?.suggestedActions || Object.values(AutomationActionType);
                
                return (
                  <Stack spacing={1} sx={{ mb: 3 }}>
                    {availableActions.map((type) => (
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
              );
            })()}

              {actionType && actionType !== AutomationActionType.NOTIFY && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('automations.selectActionDevices')}
                  </Typography>
                  <List>
                    {getAvailableActionDevices().map((device) => {
                      const isSelected = actionDeviceIds.includes(device.ieeeAddress) || actionDeviceId === device.ieeeAddress;
                      return (
                        <ListItem key={device.ieeeAddress} disablePadding>
                          <ListItemButton
                            selected={isSelected}
                            onClick={() => {
                              if (actionDeviceIds.includes(device.ieeeAddress)) {
                                setActionDeviceIds(actionDeviceIds.filter((id) => id !== device.ieeeAddress));
                              } else {
                                setActionDeviceIds([...actionDeviceIds, device.ieeeAddress]);
                                setActionDeviceId(device.ieeeAddress); // Garder pour compatibilité
                              }
                              setError(null);
                            }}
                          >
                            <ListItemText
                              primary={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="body1">
                                    {device.friendlyName || device.ieeeAddress}
                                  </Typography>
                                  {device.room && (
                                    <Chip 
                                      label={device.room} 
                                      size="small" 
                                      variant="outlined"
                                      sx={{ height: 20, fontSize: '0.7rem' }}
                                    />
                                  )}
                                </Box>
                              }
                              secondary={device.model || device.type}
                            />
                            {isSelected && (
                              <Chip label={t('common.selected')} size="small" color="primary" />
                            )}
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </List>
                  {actionDeviceIds.length > 0 && (
                    <Alert severity="info" sx={{ mt: 1 }}>
                      {t('automations.selectedDevicesCount', { count: actionDeviceIds.length })}
                    </Alert>
                  )}
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
                  disabled={loading || !actionType || (actionType !== AutomationActionType.NOTIFY && actionDeviceIds.length === 0 && !actionDeviceId)}
                >
                  {loading ? t('common.loading') : automation ? t('common.save') : t('automations.create')}
                </Button>
              </Box>
            </StepContent>
          </Step>
          )}
        </Stepper>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

