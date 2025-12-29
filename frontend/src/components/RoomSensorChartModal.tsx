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
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import Chart from 'react-apexcharts';
import { sensorHistoryService, SensorType } from '../services/sensor-history.service';
import { Device } from '../services/devices.service';
import { ApexOptions } from 'apexcharts';
import { translateRoomName } from '../utils/roomTranslations';

interface RoomSensorChartModalProps {
  open: boolean;
  onClose: () => void;
  roomName: string;
  devices: Device[];
  sensorType: SensorType;
  sensorLabel: string;
  sensorUnit: string;
  sensorColor: string;
}

// Couleurs de la charte graphique scandinave
/*const SENSOR_COLORS: Record<string, string> = {
  temperature: '#C4A5A5', // Rouge doux
  humidity: '#86A6A0', // Vert-gris nordique
  illuminance: '#9BBEB7', // Vert-gris clair
};*/

export default function RoomSensorChartModal({
  open,
  onClose,
  roomName,
  devices,
  sensorType,
  sensorLabel,
  sensorUnit,
  sensorColor,
}: RoomSensorChartModalProps) {
  const theme = useTheme();
  const [sensorData, setSensorData] = useState<Array<{ timestamp: string; value: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtrer les appareils qui ont ce type de capteur
  const devicesWithSensor = useMemo(() => {
    return devices.filter((device) => {
      if (device.status !== 'online') return false;
      if (sensorType === SensorType.TEMPERATURE) {
        return device.state?.temperature !== undefined;
      }
      if (sensorType === SensorType.HUMIDITY) {
        return device.state?.humidity !== undefined;
      }
      if (sensorType === SensorType.ILLUMINANCE) {
        return device.state?.illuminance !== undefined;
      }
      return false;
    });
  }, [devices, sensorType]);

  useEffect(() => {
    const fetchSensorData = async () => {
      if (!open || devicesWithSensor.length === 0) {
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

        // Récupérer les données pour tous les appareils de la pièce avec ce capteur
        const promises = devicesWithSensor.map(async (device) => {
          try {
            const response = await sensorHistoryService.getHistory({
              deviceId: device.ieeeAddress,
              sensorType,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              limit: 1000,
            });
            return response.items.map((item) => ({
              timestamp: item.timestamp,
              value: item.value,
              deviceName: device.friendlyName,
            }));
          } catch (err) {
            console.error(`Erreur lors de la récupération des données pour ${device.ieeeAddress}:`, err);
            return [];
          }
        });

        const results = await Promise.all(promises);
        // Fusionner toutes les données et trier par timestamp
        const allData = results.flat().sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        setSensorData(allData);
      } catch (err: any) {
        console.error('Erreur lors de la récupération des données:', err);
        setError('Impossible de charger les données');
      } finally {
        setLoading(false);
      }
    };

    fetchSensorData();
  }, [open, devicesWithSensor, sensorType]);

  // Préparer les séries pour ApexCharts
  const chartSeries = useMemo(() => {
    if (sensorData.length === 0) return [];

    const chartData = sensorData.map((item) => [
      new Date(item.timestamp).getTime(),
      item.value,
    ] as [number, number]);

    return [
      {
        name: sensorLabel,
        data: chartData,
        color: sensorColor,
      },
    ];
  }, [sensorData, sensorLabel, sensorColor]);

  // Configuration ApexCharts
  const chartOptions: ApexOptions = useMemo(() => {
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
        },
        title: {
          text: `${sensorLabel} (${sensorUnit})`,
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
            return `${value.toFixed(1)} ${sensorUnit}`;
          },
        },
      },
      legend: {
        show: false,
      },
    };
  }, [sensorLabel, sensorUnit, theme]);

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
          <Typography variant="h6" sx={{ fontWeight: 500 }}>
            {sensorLabel} - {translateRoomName(roomName)}
          </Typography>
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
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Dernières 24 heures
        </Typography>
      </DialogTitle>
      <DialogContent>
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
            <Chart
              options={chartOptions}
              series={chartSeries}
              type="line"
              height={400}
            />
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

