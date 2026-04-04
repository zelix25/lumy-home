import { useEffect, useState, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  CircularProgress,
  useTheme,
  Tabs,
  Tab,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Chart from 'react-apexcharts';
import { sensorHistoryService, SensorType } from '../services/sensor-history.service';
import { Device } from '../services/devices.service';
import { ApexOptions } from 'apexcharts';
import i18n from '@/i18n';

interface DeviceChartModalProps {
  open: boolean;
  onClose: () => void;
  device: Device | null;
}

// Couleurs pour les différents types de capteurs
const SENSOR_COLORS: Record<string, string> = {
  temperature: '#C4A5A5', // Rouge doux
  humidity: '#86A6A0', // Vert-gris nordique
  illuminance: '#9BBEB7', // Vert-gris clair
  voltage: '#FF9800', // Orange
  power: '#F44336', // Rouge
  current: '#2196F3', // Bleu
  battery: '#4CAF50', // Vert
  pressure: '#9C27B0', // Violet
};

// Déterminer les types de capteurs disponibles pour l'appareil
const getAvailableSensorTypes = (device: Device | null): Array<{
  type: SensorType;
  label: string;
  unit: string;
  color: string;
}> => {
  if (!device || !device.state) return [];

  const sensors: Array<{
    type: SensorType;
    label: string;
    unit: string;
    color: string;
  }> = [];

  if (device.state.temperature !== undefined) {
    sensors.push({
      type: SensorType.TEMPERATURE,
      label: i18n.t('devices.temperature'),
      unit: '°C',
      color: SENSOR_COLORS.temperature,
    });
  }

  if (device.state.humidity !== undefined) {
    sensors.push({
      type: SensorType.HUMIDITY,
      label: i18n.t('devices.humidity'),
      unit: '%',
      color: SENSOR_COLORS.humidity,
    });
  }

  if (device.state.illuminance !== undefined) {
    sensors.push({
      type: SensorType.ILLUMINANCE,
      label: i18n.t('devices.illuminance'),
      unit: 'lx',
      color: SENSOR_COLORS.illuminance,
    });
  }

  if (device.state.pressure !== undefined) {
    sensors.push({
      type: SensorType.PRESSURE,
      label: i18n.t('devices.pressure'),
      unit: 'hPa',
      color: SENSOR_COLORS.pressure,
    });
  }

  if (device.state.voltage !== undefined) {
    sensors.push({
      type: SensorType.VOLTAGE,
      label: i18n.t('devices.voltage'),
      unit: device.type === 'energy' || device.type === 'switch' ? 'V' : 'V',
      color: SENSOR_COLORS.voltage,
    });
  }

  const powerReading =
    device.state.power ??
    device.state.instantaneous_power ??
    device.state.power_w;
  if (powerReading !== undefined && powerReading !== null) {
    sensors.push({
      type: SensorType.POWER,
      label: i18n.t('devices.power'),
      unit: 'W',
      color: SENSOR_COLORS.power,
    });
  }

  if (device.state.current !== undefined) {
    sensors.push({
      type: SensorType.CURRENT,
      label: i18n.t('devices.current'),
      unit: 'A',
      color: SENSOR_COLORS.current,
    });
  }

  if (device.state.battery !== undefined) {
    sensors.push({
      type: SensorType.BATTERY,
      label: i18n.t('devices.battery'),
      unit: '%',
      color: SENSOR_COLORS.battery,
    });
  }

  return sensors;
};

export default function DeviceChartModal({
  open,
  onClose,
  device,
}: DeviceChartModalProps) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [sensorData, setSensorData] = useState<Array<{ timestamp: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const availableSensors = useMemo(() => getAvailableSensorTypes(device), [device]);
  const currentSensor = availableSensors[activeTab] || null;

  useEffect(() => {
    const fetchSensorData = async () => {
      if (!open || !device || !currentSensor) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Récupérer les données des 24 dernières heures
        const endDate = new Date();
        const startDate = new Date();
        startDate.setHours(startDate.getHours() - 24);

        const response = await sensorHistoryService.getHistory({
          deviceId: device.ieeeAddress,
          sensorType: currentSensor.type as SensorType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          limit: 1000,
        });

        // Transformer les données selon le type de capteur et d'appareil
        let data = response.items.map((item) => {
          let value = item.value;
          
          // Pour la tension, corriger l'affichage selon le type d'appareil
          if (currentSensor.type === SensorType.VOLTAGE) {
            // Pour les appareils "energy" et "switch", la valeur devrait être en volts (230, pas 0.230)
            // Si la valeur est < 10, c'est probablement en millivolts convertis en volts (0.230 au lieu de 230)
            // Multiplier par 1000 pour obtenir la valeur correcte en volts
            if (device.type === 'energy' || device.type === 'switch') {
              // Si la valeur est < 10, multiplier par 1000 pour convertir de 0.230 à 230
              if (value < 10 && value > 0) {
                value = value * 1000;
              }
            }
            // Pour les autres appareils, la valeur est déjà en volts (convertie de mV dans le backend)
            // Pas de transformation nécessaire
            // Arrondir à 2 décimales
            value = Math.round(value * 100) / 100;
          }
          
          // Arrondir à 2 décimales pour la puissance et l'intensité
          if (currentSensor.type === SensorType.POWER || currentSensor.type === SensorType.CURRENT) {
            value = Math.round(value * 100) / 100;
          }
          
          return {
            timestamp: item.timestamp,
            value: value,
          };
        });

        // Pour les appareils "energy", grouper les données par minute
        if (device.type === 'energy') {
          // Créer un Map pour grouper par minute (clé: timestamp arrondi à la minute)
          const groupedByMinute = new Map<string, number[]>();
          
          data.forEach((item) => {
            const date = new Date(item.timestamp);
            // Arrondir à la minute (mettre les secondes et millisecondes à 0)
            date.setSeconds(0, 0);
            const minuteKey = date.toISOString();
            
            if (!groupedByMinute.has(minuteKey)) {
              groupedByMinute.set(minuteKey, []);
            }
            groupedByMinute.get(minuteKey)!.push(item.value);
          });
          
          // Calculer la moyenne pour chaque minute
          data = Array.from(groupedByMinute.entries()).map(([timestamp, values]) => {
            const average = values.reduce((sum, val) => sum + val, 0) / values.length;
            // Arrondir à 2 décimales pour tension, puissance et intensité
            let roundedValue = average;
            if (currentSensor.type === SensorType.VOLTAGE || 
                currentSensor.type === SensorType.POWER || 
                currentSensor.type === SensorType.CURRENT) {
              roundedValue = Math.round(average * 100) / 100;
            }
            return {
              timestamp,
              value: roundedValue,
            };
          });
          
          // Trier par timestamp
          data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }

        setSensorData(data);
      } catch (err: any) {
        console.error('Erreur lors de la récupération des données:', err);
        setError('Impossible de charger les données');
      } finally {
        setLoading(false);
      }
    };

    fetchSensorData();
  }, [open, device, currentSensor, activeTab]);

  // Préparer les séries pour ApexCharts
  const chartSeries = useMemo(() => {
    if (sensorData.length === 0 || !currentSensor) return [];

    const chartData = sensorData.map((item) => [
      new Date(item.timestamp).getTime(),
      item.value,
    ] as [number, number]);

    return [
      {
        name: currentSensor.label,
        data: chartData,
        color: currentSensor.color,
      },
    ];
  }, [sensorData, currentSensor]);

  // Configuration ApexCharts
  const chartOptions: ApexOptions = useMemo(() => {
    if (!currentSensor) return {};

    return {
      chart: {
        type: 'line',
        height: 400,
        toolbar: {
          show: true,
        },
        zoom: {
          enabled: true,
          type: 'x',
        },
        animations: {
          enabled: true,
          easing: 'easeinout',
          speed: 300,
        },
        fontFamily: theme.typography.fontFamily,
      },
      stroke: {
        curve: 'smooth',
        width: 3,
      },
      dataLabels: {
        enabled: false,
      },
      markers: {
        size: 4,
        hover: {
          size: 6,
        },
      },
      xaxis: {
        type: 'datetime',
        labels: {
          style: {
            colors: theme.palette.text.secondary,
            fontSize: '12px',
            fontFamily: theme.typography.fontFamily,
          },
          format: 'HH:mm',
        },
        axisBorder: {
          color: theme.palette.divider,
        },
        axisTicks: {
          color: theme.palette.divider,
        },
        title: {
          text: 'Heure',
          style: {
            color: theme.palette.text.secondary,
            fontSize: '12px',
          },
        },
      },
      yaxis: {
        labels: {
          style: {
            colors: theme.palette.text.secondary,
            fontSize: '12px',
            fontFamily: theme.typography.fontFamily,
          },
          formatter: (value: number) => {
            // Arrondir à 2 décimales pour tension, puissance et intensité
            if (currentSensor.type === SensorType.VOLTAGE || 
                currentSensor.type === SensorType.POWER || 
                currentSensor.type === SensorType.CURRENT) {
              return value.toFixed(2);
            }
            // Pour les autres types, utiliser le formatage par défaut
            if (currentSensor.type === SensorType.TEMPERATURE) {
              return value.toFixed(1);
            }
            return value.toFixed(0);
          },
        },
        title: {
          text: `${currentSensor.label} (${currentSensor.unit})`,
          style: {
            color: theme.palette.text.secondary,
            fontSize: '12px',
          },
        },
      },
      grid: {
        borderColor: theme.palette.divider,
        strokeDashArray: 3,
        xaxis: {
          lines: {
            show: false,
          },
        },
        yaxis: {
          lines: {
            show: true,
          },
        },
        padding: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
      },
      tooltip: {
        theme: 'light',
        style: {
          fontSize: '12px',
          fontFamily: theme.typography.fontFamily,
        },
        x: {
          format: 'dd/MM/yyyy HH:mm',
        },
        y: {
          formatter: (value: number) => {
            // Déterminer le nombre de décimales selon le type de capteur
            let decimals = 0;
            if (currentSensor.type === SensorType.TEMPERATURE) {
              decimals = 1;
            } else if (currentSensor.type === SensorType.VOLTAGE || 
                       currentSensor.type === SensorType.POWER || 
                       currentSensor.type === SensorType.CURRENT) {
              decimals = 2;
            } else if (currentSensor.type === SensorType.HUMIDITY || 
                       currentSensor.type === SensorType.BATTERY) {
              decimals = 0;
            } else if (currentSensor.type === SensorType.ILLUMINANCE) {
              decimals = 0;
            } else if (currentSensor.type === SensorType.PRESSURE) {
              decimals = 0;
            }
            return `${value.toFixed(decimals)} ${currentSensor.unit}`;
          },
        },
      },
      legend: {
        show: false,
      },
    };
  }, [currentSensor, theme]);

  if (!device) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              {device.friendlyName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {i18n.t('devices.lastUpdate')}: {device.updatedAt ? new Date(device.updatedAt).toLocaleTimeString('fr-FR') : '-'}
            </Typography>
          </Box>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={{
              color: theme.palette.text.secondary,
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        {availableSensors.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            Aucune donnée de capteur disponible pour cet appareil
          </Typography>
        ) : (
          <>
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => {
                setActiveTab(newValue);
                setSensorData([]);
              }}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
            >
              {availableSensors.map((sensor, index) => (
                <Tab
                  key={index}
                  label={sensor.label}
                  sx={{
                    textTransform: 'none',
                    minWidth: 'auto',
                    px: 2,
                  }}
                />
              ))}
            </Tabs>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <CircularProgress size={40} />
              </Box>
            ) : error ? (
              <Typography variant="body2" color="error" sx={{ textAlign: 'center', py: 4 }}>
                {error}
              </Typography>
            ) : sensorData.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Aucune donnée disponible pour les 24 dernières heures
              </Typography>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Dernières 24 heures
                </Typography>
                <Chart
                  options={chartOptions}
                  series={chartSeries}
                  type="line"
                  height={400}
                />
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

