import { useEffect, useState, useMemo, useRef } from 'react';
import Chart from 'react-apexcharts';
import { Box, Typography, CircularProgress, Chip, Stack, useTheme } from '@mui/material';
import { sensorHistoryService, SensorType } from '../services/sensor-history.service';
import { ApexOptions } from 'apexcharts';

interface MultiSensorChartProps {
  deviceId: string;
  availableSensors: Array<{
    type: SensorType;
    label: string;
    unit: string;
  }>;
}

// Couleurs de la charte graphique scandinave
const SENSOR_COLORS: Record<string, string> = {
  temperature: '#C4A5A5', // Rouge doux (error du thème)
  humidity: '#86A6A0', // Vert-gris nordique (primary)
  pressure: '#D0BFAE', // Bois clair (secondary)
  illuminance: '#9BBEB7', // Vert-gris clair (primary light)
  battery: '#6B8A84', // Vert-gris foncé (primary dark)
  voltage: '#B8A896', // Bois foncé (secondary dark)
  power: '#F44336', // Aligné DeviceChartModal (énergie)
  current: '#2196F3',
  linkquality: '#5A5A5A', // Gris texte secondaire
};

export default function MultiSensorChart({ deviceId, availableSensors }: MultiSensorChartProps) {
  const theme = useTheme();
  const chartRef = useRef<any>(null);
  const chartInstanceRef = useRef<any>(null);
  const [sensorDataMap, setSensorDataMap] = useState<Record<string, Array<{ timestamp: string; value: number }>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitialLoad = useRef(true);
  // État pour suivre quelles courbes sont visibles (toutes visibles par défaut)
  const [visibleSensors, setVisibleSensors] = useState<Set<SensorType>>(
    new Set(availableSensors.map((s) => s.type))
  );

  useEffect(() => {
    const fetchAllSensorData = async () => {
      const wasInitialLoad = isInitialLoad.current;
      try {
        // Ne mettre loading à true que lors du chargement initial
        if (wasInitialLoad) {
          setLoading(true);
        }
        setError(null);

        // Récupérer les données historiques des 7 derniers jours
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        // Récupérer les données pour chaque capteur
        const promises = availableSensors.map(async (sensor) => {
          try {
            const response = await sensorHistoryService.getHistory({
              deviceId,
              sensorType: sensor.type,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              limit: 1000,
            });
            return {
              type: sensor.type,
              data: response.items.map((item) => ({
                timestamp: item.timestamp,
                value: item.value,
              })),
            };
          } catch (err) {
            console.error(`Erreur lors de la récupération des données ${sensor.type}:`, err);
            return {
              type: sensor.type,
              data: [],
            };
          }
        });

        const results = await Promise.all(promises);
        const dataMap: Record<string, Array<{ timestamp: string; value: number }>> = {};
        results.forEach((result) => {
          dataMap[result.type] = result.data;
        });

        setSensorDataMap(dataMap);
        isInitialLoad.current = false;
      } catch (err: any) {
        console.error('Erreur lors de la récupération des données:', err);
        setError('Impossible de charger les données des capteurs');
      } finally {
        if (wasInitialLoad) {
          setLoading(false);
        }
      }
    };

    if (deviceId && availableSensors.length > 0) {
      fetchAllSensorData();
    }
  }, [deviceId, availableSensors]);

  // Réinitialiser les capteurs visibles quand les capteurs disponibles changent
  useEffect(() => {
    setVisibleSensors(new Set(availableSensors.map((s) => s.type)));
  }, [availableSensors]);

  // Ajuster la position du tooltip pour éviter qu'il soit coupé à droite
  useEffect(() => {
    const adjustTooltipPosition = () => {
      const tooltip = document.querySelector('.apexcharts-tooltip') as HTMLElement;
      if (tooltip) {
        const rect = tooltip.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        
        // Si le tooltip dépasse à droite de l'écran, le décaler vers la gauche
        if (rect.right > windowWidth - 20) {
          const offset = rect.right - windowWidth + 20;
          const currentLeft = parseFloat(tooltip.style.left) || 0;
          tooltip.style.left = `${currentLeft - offset}px`;
        }
      }
    };

    // Observer les changements du DOM pour détecter l'apparition/mouvement du tooltip
    const observer = new MutationObserver(() => {
      setTimeout(adjustTooltipPosition, 10);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    // Ajuster aussi lors du mouvement de la souris sur le graphique
    const handleMouseMove = () => {
      setTimeout(adjustTooltipPosition, 10);
    };

    const chartContainer = document.querySelector('.apexcharts-canvas-container');
    if (chartContainer) {
      chartContainer.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      observer.disconnect();
      if (chartContainer) {
        chartContainer.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, []);

  // Gestionnaire pour masquer/afficher une courbe
  const toggleSensorVisibility = (sensorType: SensorType) => {
    setVisibleSensors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sensorType)) {
        newSet.delete(sensorType);
      } else {
        newSet.add(sensorType);
      }
      return newSet;
    });
  };

  // Préparer les séries pour ApexCharts (format Irregular Timeseries)
  const chartSeries = useMemo(() => {
    return availableSensors
      .filter((sensor) => visibleSensors.has(sensor.type))
      .map((sensor) => {
        const data = sensorDataMap[sensor.type] || [];
        const color = SENSOR_COLORS[sensor.type] || theme.palette.primary.main;
        
        // Filtrer pour ne garder que les données des 7 derniers jours
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);
        
        const filteredData = data
          .filter((item) => new Date(item.timestamp).getTime() >= sevenDaysAgo.getTime())
          .map((item) => [new Date(item.timestamp).getTime(), item.value] as [number, number]);

        return {
          name: sensor.label,
          data: filteredData,
          color: color,
        };
      });
  }, [availableSensors, visibleSensors, sensorDataMap, theme]);

  // Mettre à jour le graphique de manière transparente sans re-render complet
  useEffect(() => {
    if (chartInstanceRef.current && !isInitialLoad.current && chartSeries.length > 0) {
      try {
        chartInstanceRef.current.updateSeries(chartSeries, false);
      } catch (err) {
        console.error('Erreur lors de la mise à jour du graphique:', err);
      }
    }
  }, [chartSeries]);

  // Obtenir l'instance ApexCharts après le montage
  useEffect(() => {
    const getChartInstance = () => {
      if (chartRef.current) {
        // Accéder à l'instance ApexCharts via le DOM
        const chartElement = chartRef.current.querySelector('.apexcharts-canvas');
        if (chartElement) {
          // L'instance est stockée dans l'élément parent ou dans window.ApexCharts
          const instance = (chartElement as any).__apexcharts__ || 
                          (chartElement.parentElement as any)?.__apexcharts__;
          if (instance) {
            chartInstanceRef.current = instance;
            return true;
          }
        }
      }
      return false;
    };

    // Essayer immédiatement
    if (!getChartInstance()) {
      // Si pas trouvé, attendre un peu et réessayer
      const timeout = setTimeout(() => {
        getChartInstance();
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [chartSeries.length > 0, !isInitialLoad.current]);

  // Configuration ApexCharts
  const chartOptions: ApexOptions = useMemo(() => {
    return {
      chart: {
        type: 'line',
        height: 500,
        toolbar: {
          show: false,
        },
        zoom: {
          enabled: true,
          type: 'x',
        },
        animations: {
          enabled: false,
        },
        fontFamily: theme.typography.fontFamily,
        events: {
          dataPointMouseEnter: function(event: any, chartContext: any) {
            // Ajuster la position du tooltip dynamiquement pour éviter qu'il soit coupé
            setTimeout(() => {
              const tooltipEl = document.querySelector('.apexcharts-tooltip') as HTMLElement;
              if (tooltipEl && event && event.clientX) {
                const chartWidth = chartContext.svgWidth || 0;
                const clientX = event.clientX;
                const chartRect = chartContext.el?.getBoundingClientRect();
                const relativeX = chartRect ? clientX - chartRect.left : clientX;
                
                let offsetX = 0;
                // Si on est dans les 30% de droite du graphique, décaler plus à gauche
                if (relativeX > chartWidth * 0.7) {
                  offsetX = -180;
                } else if (relativeX > chartWidth * 0.5) {
                  offsetX = -100;
                } else {
                  offsetX = -50;
                }
                tooltipEl.style.transform = `translateX(${offsetX}px)`;
              }
            }, 10);
          },
        },
      },
      stroke: {
        curve: 'smooth',
        width: 3,
      },
      dataLabels: {
        enabled: false,
      },
      markers: {
        size: 0,
        hover: {
          size: 6,
        },
      },
      xaxis: {
        type: 'datetime',
        labels: {
          style: {
            colors: theme.palette.text.secondary,
            fontSize: '11px',
            fontFamily: theme.typography.fontFamily,
          },
          format: 'dd/MM HH:mm',
        },
        axisBorder: {
          color: theme.palette.divider,
        },
        axisTicks: {
          color: theme.palette.divider,
        },
      },
      yaxis: {
        labels: {
          style: {
            colors: theme.palette.text.secondary,
            fontSize: '11px',
            fontFamily: theme.typography.fontFamily,
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
        fixed: {
          enabled: false,
        },
        followCursor: true,
        offsetX: -50,
        offsetY: 10,
        custom: ({ seriesIndex, dataPointIndex }) => {
          const sensor = availableSensors.find((s) => visibleSensors.has(s.type) && 
            chartSeries.findIndex((cs) => cs.name === s.label) === seriesIndex);
          if (!sensor || !chartSeries[seriesIndex]) return '';
          
          const dataPoint = chartSeries[seriesIndex].data[dataPointIndex];
          if (!dataPoint) return '';
          
          const [timestamp, value] = dataPoint;
          const date = new Date(timestamp);
          const formattedDate = date.toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
          
          // Calculer la position pour éviter que le tooltip soit coupé
          /*let offsetX = 0;
          if (w && w.globals) {
            const chartWidth = w.globals.svgWidth || 0;
            const clientX = w.globals.clientX || 0;
            // Si on est dans les 30% de droite du graphique, décaler plus à gauche
            if (clientX > chartWidth * 0.7) {
              offsetX = -180;
            } else if (clientX > chartWidth * 0.5) {
              offsetX = -100;
            } else {
              offsetX = -50;
            }
          }*/
          
          return `
            <div style="padding: 8px 12px; background: white; border: 1px solid ${theme.palette.divider}; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
              <div style="font-weight: 500; margin-bottom: 8px; color: ${theme.palette.text.primary};">
                ${formattedDate}
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${chartSeries[seriesIndex].color};"></div>
                <span style="color: ${theme.palette.text.secondary};">
                  ${sensor.label}: 
                  <span style="font-weight: 500; color: ${theme.palette.text.primary};">
                    ${typeof value === 'number' ? value.toFixed(1) : value} ${sensor.unit}
                  </span>
                </span>
              </div>
            </div>
          `;
        },
        onDatasetHover: {
          highlightDataSeries: true,
        },
      },
      legend: {
        show: false, // On utilise notre légende personnalisée
      },
    };
  }, [availableSensors, visibleSensors, chartSeries, theme]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress size={40} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="body2" color="error" sx={{ textAlign: 'center', py: 4 }}>
          {error}
        </Typography>
      </Box>
    );
  }

  const hasData = Object.values(sensorDataMap).some((data) => data.length > 0);

  if (!hasData) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          Aucune donnée disponible pour les 7 derniers jours
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, color: theme.palette.text.primary }}>
            Graphique des capteurs
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            {availableSensors.map((sensor) => {
              const color = SENSOR_COLORS[sensor.type] || theme.palette.primary.main;
              return (
                <Chip
                  key={sensor.type}
                  label={`${sensor.label} (${sensor.unit})`}
                  size="small"
                  sx={{
                    backgroundColor: `${color}15`,
                    color: color,
                    border: `1px solid ${color}30`,
                    fontWeight: 500,
                    fontSize: '0.75rem',
                  }}
                />
              );
            })}
          </Stack>
        </Box>

        <Box sx={{ mb: 3 }} ref={chartRef}>
          <Chart
            options={chartOptions}
            series={chartSeries}
            type="line"
            height={500}
          />
        </Box>

        {/* Légende personnalisée */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            flexWrap: 'wrap',
            gap: 2,
            paddingTop: '20px',
            paddingBottom: '20px',
          }}
        >
          {availableSensors.map((sensor) => {
            const isVisible = visibleSensors.has(sensor.type);
            const color = SENSOR_COLORS[sensor.type] || theme.palette.primary.main;
            
            return (
              <Box
                key={sensor.type}
                onClick={() => toggleSensorVisibility(sensor.type)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  opacity: isVisible ? 1 : 0.4,
                  padding: '4px 8px',
                  borderRadius: 1,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
              >
                <Box
                  sx={{
                    width: 14,
                    height: 3,
                    backgroundColor: color,
                    borderRadius: 1,
                    opacity: isVisible ? 1 : 0.5,
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '12px',
                    color: isVisible ? theme.palette.text.secondary : theme.palette.text.disabled,
                    textDecoration: isVisible ? 'none' : 'line-through',
                    userSelect: 'none',
                  }}
                >
                  {sensor.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
    </Box>
  );
}
