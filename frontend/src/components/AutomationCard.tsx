import {
  Card,
  CardContent,
  Box,
  Typography,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Switch,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DeleteIcon from '@mui/icons-material/Delete';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Automation } from '../services/automations.service';

interface AutomationCardProps {
  automation: Automation;
  onToggleStatus: (id: string, status: 'active' | 'inactive') => void;
  onDelete: (id: string) => void;
}

export default function AutomationCard({
  automation,
  onToggleStatus,
  onDelete,
}: AutomationCardProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const formatTriggerText = (trigger: Automation['trigger']): string => {
    const triggerTypeMap: Record<string, string> = {
      motion: 'il y a du mouvement',
      contact: 'une porte ou fenêtre',
      temperature: 'la température change',
      button: 'un bouton est pressé',
      time: "l'heure spécifiée",
      manual: 'déclenchement manuel',
    };

    const baseText = triggerTypeMap[trigger.type] || trigger.type;

    if (trigger.deviceName) {
      return `${baseText} sur "${trigger.deviceName}"`;
    }

    return baseText;
  };

  const formatActionText = (action: Automation['actions'][0]): string => {
    const actionTypeMap: Record<string, string> = {
      turn_on: 'allumer',
      turn_off: 'éteindre',
      set_brightness: 'régler la luminosité de',
      set_color: 'changer la couleur de',
      notify: 'envoyer une notification pour',
    };

    const actionText = actionTypeMap[action.type] || action.type;
    const deviceName = action.deviceName || '';

    if (action.type === 'set_brightness' && action.params?.brightness) {
      return `${actionText} "${deviceName}" à ${action.params.brightness}%`;
    }

    return `${actionText} "${deviceName}"`;
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
              {automation.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {automation.description}
            </Typography>
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" component="span" sx={{ fontWeight: 500 }}>
                {t('assistant.when')}:{' '}
              </Typography>
              <Typography variant="body2" component="span">
                {formatTriggerText(automation.trigger)}
              </Typography>
            </Box>
            <Box>
              <Typography variant="body2" component="span" sx={{ fontWeight: 500 }}>
                {t('assistant.then')}:{' '}
              </Typography>
              <Typography variant="body2" component="span">
                {automation.actions.map(formatActionText).join(', ')}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch
              checked={automation.status === 'active'}
              onChange={(e) =>
                onToggleStatus(
                  automation.id,
                  e.target.checked ? 'active' : 'inactive',
                )
              }
              size="small"
            />
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVertIcon />
            </IconButton>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={automation.status === 'active' ? t('assistant.active') : t('assistant.inactive')}
            size="small"
            color={automation.status === 'active' ? 'success' : 'default'}
            sx={{ fontSize: '12px' }}
          />
        </Box>
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem
            onClick={() => {
              onDelete(automation.id);
              handleMenuClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1, fontSize: 20 }} />
            {t('assistant.delete')}
          </MenuItem>
        </Menu>
      </CardContent>
    </Card>
  );
}

