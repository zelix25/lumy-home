import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Switch,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  AccountTree as AccountTreeIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  Automation,
  AutomationTriggerType,
  AutomationActionType,
  AutomationStatus,
  simpleAutomationsService,
} from '../services/simple-automations.service';
import { useNotification } from '../hooks/useNotification';

interface SimpleAutomationCardProps {
  automation: Automation;
  onUpdate: () => void;
  onEdit?: (automation: Automation) => void;
  onEditNode?: (automation: Automation) => void;
}

export default function SimpleAutomationCard({
  automation,
  onUpdate,
  onEdit,
  onEditNode,
}: SimpleAutomationCardProps) {
  const { t } = useTranslation();
  const { addNotification } = useNotification();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleToggleStatus = async () => {
    setLoading(true);
    try {
      await simpleAutomationsService.toggleStatus(automation.id);
      addNotification({
        type: 'success',
        title: t('automations.updated'),
        message:
          automation.status === AutomationStatus.ACTIVE
            ? t('automations.deactivated')
            : t('automations.activated'),
      });
      onUpdate();
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: error.message || t('automations.updateError'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = () => {
    handleMenuClose();
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteDialogOpen(false);
    setLoading(true);
    try {
      await simpleAutomationsService.delete(automation.id);
      addNotification({
        type: 'success',
        title: t('automations.deleted'),
        message: t('automations.deletedMessage'),
      });
      onUpdate();
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: error.message || t('automations.deleteError'),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const getTriggerConditionText = (conditionType: AutomationTriggerType, deviceName?: string, condition?: Record<string, any>): string => {
    let baseText = '';
    switch (conditionType) {
      case AutomationTriggerType.MOTION:
        baseText = t('automations.whenMotion', { device: deviceName || '' });
        break;
      case AutomationTriggerType.CONTACT:
        baseText = t('automations.whenContact', { device: deviceName || '' });
        break;
      case AutomationTriggerType.TEMPERATURE:
        baseText = t('automations.whenTemperature', { device: deviceName || '' });
        if (condition?.operator && condition?.value !== undefined) {
          baseText += ` ${condition.operator} ${condition.value}°C`;
        }
        break;
      case AutomationTriggerType.BUTTON:
        baseText = t('automations.whenButton', { device: deviceName || '' });
        break;
      case AutomationTriggerType.VIBRATION:
        baseText = t('automations.whenVibration', { device: deviceName || '' });
        break;
      case AutomationTriggerType.ILLUMINANCE:
        baseText = t('automations.whenIlluminance', { device: deviceName || '' });
        if (condition?.operator && condition?.value !== undefined) {
          baseText += ` ${condition.operator} ${condition.value} ${t('automations.lux')}`;
        }
        break;
      case AutomationTriggerType.HUMIDITY:
        baseText = t('automations.whenHumidity', { device: deviceName || '' });
        if (condition?.operator && condition?.value !== undefined) {
          baseText += ` ${condition.operator} ${condition.value}%`;
        }
        break;
      case AutomationTriggerType.WATER_LEAK:
        baseText = t('automations.whenWaterLeak', { device: deviceName || '' });
        break;
      case AutomationTriggerType.SMOKE:
        baseText = t('automations.whenSmoke', { device: deviceName || '' });
        break;
      case AutomationTriggerType.GAS:
        baseText = t('automations.whenGas', { device: deviceName || '' });
        break;
      case AutomationTriggerType.SUNRISE_SUNSET:
        const sunriseSunsetType = trigger.sunriseSunsetType || 'sunrise';
        const offsetMinutes = trigger.offsetMinutes || 0;
        const offsetText = offsetMinutes !== 0 
          ? ` ${offsetMinutes > 0 ? '+' : ''}${offsetMinutes} ${t('automations.minutes')}`
          : '';
        baseText = sunriseSunsetType === 'sunrise' 
          ? `${t('automations.whenSunrise')}${offsetText}`
          : `${t('automations.whenSunset')}${offsetText}`;
        break;
      default:
        baseText = `${conditionType}: ${deviceName || ''}`;
    }
    return baseText;
  };

  const getTriggerDescription = () => {
    const trigger = automation.trigger;
    let mainTriggerText = getTriggerConditionText(
      trigger.type,
      trigger.deviceName || trigger.deviceId,
      trigger.condition
    );

    // Si des conditions supplémentaires existent, les ajouter
    if (trigger.additionalConditions && trigger.additionalConditions.length > 0) {
      const logicOperator = trigger.logicOperator || 'AND';
      const operatorText = logicOperator === 'AND' ? t('automations.and') : t('automations.or');
      
      const additionalConditionsTexts = trigger.additionalConditions.map((condition) => {
        return getTriggerConditionText(
          condition.type,
          condition.deviceName || condition.deviceId,
          condition.condition
        );
      });

      return `${mainTriggerText} ${operatorText} ${additionalConditionsTexts.join(` ${operatorText} `)}`;
    }

    return mainTriggerText;
  };

  const getActionDescription = () => {
    const action = automation.actions[0];
    if (!action) return '';

    switch (action.type) {
      case AutomationActionType.TURN_ON:
        const duration = action.params?.duration;
        if (duration && duration > 0) {
          return t('automations.thenTurnOnWithDuration', { 
            device: action.deviceName || action.deviceId,
            seconds: duration 
          });
        }
        return t('automations.thenTurnOn', { device: action.deviceName || action.deviceId });
      case AutomationActionType.TURN_OFF:
        return t('automations.thenTurnOff', { device: action.deviceName || action.deviceId });
      case AutomationActionType.TOGGLE:
        return t('automations.thenToggle', { device: action.deviceName || action.deviceId });
      case AutomationActionType.SET_BRIGHTNESS:
        return t('automations.thenSetBrightness', {
          device: action.deviceName || action.deviceId,
          brightness: action.params?.brightness || 100,
        });
      case AutomationActionType.SET_COLOR:
        return t('automations.thenSetColor', { device: action.deviceName || action.deviceId });
      case AutomationActionType.SET_COLOR_TEMP:
        return t('automations.thenSetColorTemp', {
          device: action.deviceName || action.deviceId,
          colorTemp: action.params?.color_temp || 370,
        });
      case AutomationActionType.SET_THERMOSTAT:
        return t('automations.thenSetThermostat', {
          device: action.deviceName || action.deviceId,
          temperature: action.params?.temperature || 20,
        });
      case AutomationActionType.OPEN_COVER:
        return t('automations.thenOpenCover', { device: action.deviceName || action.deviceId });
      case AutomationActionType.CLOSE_COVER:
        return t('automations.thenCloseCover', { device: action.deviceName || action.deviceId });
      case AutomationActionType.NOTIFY:
        return t('automations.thenNotify', { message: action.params?.message || '' });
      default:
        return `${action.type}: ${action.deviceName || action.deviceId}`;
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom>
              {automation.name}
            </Typography>
            {automation.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {automation.description}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch
              checked={automation.status === AutomationStatus.ACTIVE}
              onChange={handleToggleStatus}
              disabled={loading}
            />
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {getTriggerDescription()}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            → {getActionDescription()}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          <Chip
            label={automation.status === AutomationStatus.ACTIVE ? t('automations.active') : t('automations.inactive')}
            color={automation.status === AutomationStatus.ACTIVE ? 'success' : 'default'}
            size="small"
          />
          {automation.executionLog && automation.executionLog.length > 0 && (
            <Chip
              label={t('automations.executions', { count: automation.executionLog.length })}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          {onEdit && (
            <MenuItem
              onClick={() => {
                onEdit(automation);
                handleMenuClose();
              }}
            >
              <EditIcon sx={{ mr: 1 }} fontSize="small" />
              {t('common.edit')}
            </MenuItem>
          )}
          {onEditNode && (
            <MenuItem
              onClick={() => {
                onEditNode(automation);
                handleMenuClose();
              }}
            >
              <AccountTreeIcon sx={{ mr: 1 }} fontSize="small" />
              {t('automations.editNodeMode')}
            </MenuItem>
          )}
          <MenuItem onClick={handleDeleteClick}>
            <DeleteIcon sx={{ mr: 1 }} fontSize="small" />
            {t('common.delete')}
          </MenuItem>
        </Menu>

        {/* Modal de confirmation de suppression */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <DialogTitle id="delete-dialog-title">
            {t('automations.confirmDeleteTitle')}
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="delete-dialog-description">
              {t('automations.confirmDelete', { name: automation.name })}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} color="inherit">
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              color="error"
              variant="contained"
              disabled={loading}
            >
              {t('common.delete')}
            </Button>
          </DialogActions>
        </Dialog>
      </CardContent>
    </Card>
  );
}

