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
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDevices } from '../hooks/useDevices';
import {
  simpleAutomationsService,
  AutomationTriggerType,
  AutomationActionType,
  CreateAutomationDto,
} from '../services/simple-automations.service';
import { useNotification } from '../hooks/useNotification';

interface CreateSimpleAutomationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

//const steps = ['trigger', 'device', 'action'];

export default function CreateSimpleAutomationDialog({
  open,
  onClose,
  onSuccess,
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
  const [notificationMessage, setNotificationMessage] = useState('');

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
        return devices.filter((d) => d.type === 'light' || d.type === 'switch' || d.type === 'plug');
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
    setActiveStep((prev) => prev - 1);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t('automations.nameRequired'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const triggerDevice = devices.find((d) => d.ieeeAddress === triggerDeviceId);
      const actionDevice = actionDeviceId ? devices.find((d) => d.ieeeAddress === actionDeviceId) : null;

      const automation: CreateAutomationDto = {
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
              actionType === AutomationActionType.SET_BRIGHTNESS
                ? { brightness }
                : actionType === AutomationActionType.NOTIFY
                ? { message: notificationMessage || t('automations.defaultNotification') }
                : undefined,
          },
        ],
      };

      await simpleAutomationsService.create(automation);
      addNotification({
        type: 'success',
        title: t('automations.created'),
        message: t('automations.createdMessage'),
      });
      handleReset();
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || t('automations.createError'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setName('');
    setDescription('');
    setTriggerType('');
    setTriggerDeviceId('');
    setActionType('');
    setActionDeviceId('');
    setBrightness(100);
    setNotificationMessage('');
    setError(null);
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
      case AutomationActionType.SET_BRIGHTNESS:
        return t('automations.actionSetBrightness');
      case AutomationActionType.SET_COLOR:
        return t('automations.actionSetColor');
      case AutomationActionType.NOTIFY:
        return t('automations.actionNotify');
      default:
        return type;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('automations.createAutomation')}</DialogTitle>
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
                 {Object.values(AutomationTriggerType)
                   .filter((type) => type !== AutomationTriggerType.TIME && type !== AutomationTriggerType.MANUAL)
                   .map((type) => (
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

          {/* Étape 3: Choisir une action */}
          <Step>
            <StepLabel>{t('automations.stepAction')}</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('automations.stepActionDescription')}
              </Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>
                {Object.values(AutomationActionType).map((type) => (
                  <Chip
                    key={type}
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
                      ...(actionType === type && {
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
                  {loading ? t('common.loading') : t('automations.create')}
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

