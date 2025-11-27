import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Button,
  Paper,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SendIcon from '@mui/icons-material/Send';
import { useWebSocket } from '../hooks/useWebSocket';
import { devicesService } from '../services/devices.service';

interface MqttLogEntry {
  id: string;
  timestamp: Date;
  topic: string;
  payload: any;
  direction: 'incoming' | 'outgoing';
}

export default function DebugPage() {
  const { isConnected, socket } = useWebSocket();
  const [logs, setLogs] = useState<MqttLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<MqttLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [isPaused, setIsPaused] = useState(false);
  const [maxLogs, setMaxLogs] = useState(500);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const [sendTopic, setSendTopic] = useState('');
  const [sendPayload, setSendPayload] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [rawDataView, setRawDataView] = useState<'formatted' | 'raw'>('formatted');
  const [mqttStatus, setMqttStatus] = useState<{
    connected: boolean;
    brokerUrl: string;
    clientId: string;
    messagesReceived: number;
    messagesSent: number;
    lastMessageReceived?: string;
    lastMessageSent?: string;
    subscribedTopics: string[];
  } | null>(null);

  // Charger le statut MQTT périodiquement
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await devicesService.getMqttStatus();
        setMqttStatus(status);
      } catch (error) {
        console.error('Erreur récupération statut MQTT:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Toutes les 5 secondes

    return () => clearInterval(interval);
  }, []);

  // Écouter les messages MQTT via WebSocket
  useEffect(() => {
    if (!isConnected || !socket) return;

    const handleMqttMessage = (data: any) => {
      if (isPaused) return;

      const entry: MqttLogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(data.timestamp || new Date()),
        topic: data.topic,
        payload: data.payload,
        direction: 'incoming',
      };

      setLogs((prev) => {
        const newLogs = [entry, ...prev].slice(0, maxLogs);
        return newLogs;
      });
    };

    socket.on('mqtt:message', handleMqttMessage);

    return () => {
      socket.off('mqtt:message', handleMqttMessage);
    };
  }, [isConnected, socket, isPaused, maxLogs]);

  // Filtrer les logs
  useEffect(() => {
    let filtered = logs;

    // Filtre par recherche
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.topic.toLowerCase().includes(searchLower) ||
          JSON.stringify(log.payload).toLowerCase().includes(searchLower),
      );
    }

    // Filtre par topic
    if (topicFilter !== 'all') {
      filtered = filtered.filter((log) => log.topic.includes(topicFilter));
    }

    setFilteredLogs(filtered);
  }, [logs, searchTerm, topicFilter]);

  // Auto-scroll
  useEffect(() => {
    if (autoScrollRef.current && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [filteredLogs]);

  const handleClearLogs = () => {
    setLogs([]);
    setFilteredLogs([]);
  };

  const uniqueTopics = Array.from(
    new Set(logs.map((log) => log.topic)),
  ).sort();

  const formatTimestamp = (date: Date) => {
    const d = new Date(date);
    const timeString = d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const milliseconds = d.getMilliseconds().toString().padStart(3, '0');
    return `${timeString}.${milliseconds}`;
  };

  const formatPayload = (payload: any): string => {
    if (typeof payload === 'string') {
      try {
        const parsed = JSON.parse(payload);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return payload;
      }
    }
    return JSON.stringify(payload, null, 2);
  };

  const getRawDataString = (): string => {
    if (filteredLogs.length === 0) return '';
    
    if (rawDataView === 'raw') {
      // Format brut : une ligne par message, JSON compact
      return filteredLogs.map((log) => {
        const raw = {
          t: log.timestamp.toISOString(),
          d: log.direction,
          topic: log.topic,
          payload: typeof log.payload === 'string' ? log.payload : log.payload,
        };
        return JSON.stringify(raw);
      }).join('\n');
    } else {
      // Format formaté : JSON indenté avec séparateurs
      return filteredLogs.map((log, index) => {
        const raw = {
          timestamp: log.timestamp.toISOString(),
          direction: log.direction,
          topic: log.topic,
          payload: log.payload,
        };
        const json = JSON.stringify(raw, null, 2);
        return index > 0 ? '\n' + '='.repeat(80) + '\n' + json : json;
      }).join('');
    }
  };

  const getTopicColor = (topic: string): string => {
    if (topic.includes('bridge')) return '#9c27b0';
    if (topic.includes('state')) return '#2196f3';
    if (topic.includes('set')) return '#ff9800';
    if (topic.includes('event')) return '#f44336';
    return '#757575';
  };

  const handleSendMessage = async () => {
    if (!sendTopic.trim()) {
      setSendError('Le topic est requis');
      return;
    }

    setSending(true);
    setSendError(null);

    try {
      let payload: any = '';
      
      if (sendPayload.trim()) {
        try {
          // Essayer de parser comme JSON
          payload = JSON.parse(sendPayload);
        } catch {
          // Si ce n'est pas du JSON valide, utiliser comme string
          payload = sendPayload;
        }
      }

      await devicesService.sendMqttMessage(sendTopic, payload);
      
      // Ajouter le message envoyé aux logs
      const entry: MqttLogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        topic: sendTopic,
        payload: payload,
        direction: 'outgoing',
      };
      setLogs((prev) => [entry, ...prev].slice(0, maxLogs));
      
      // Réinitialiser le formulaire
      setSendTopic('');
      setSendPayload('');
    } catch (error: any) {
      setSendError(error.message || 'Erreur lors de l\'envoi du message');
      console.error('Erreur envoi MQTT:', error);
    } finally {
      setSending(false);
    }
  };

  const loadPreset = (preset: { topic: string; payload: string }) => {
    setSendTopic(preset.topic);
    setSendPayload(preset.payload);
  };

  const presets = [
    {
      name: 'Liste des appareils',
      topic: 'zigbee2mqtt/bridge/config/devices/get',
      payload: '',
    },
    {
      name: 'Activer détection (5 min)',
      topic: 'zigbee2mqtt/bridge/request/permit_join',
      payload: JSON.stringify({ value: true, time: 300 }, null, 2),
    },
    {
      name: 'Désactiver détection',
      topic: 'zigbee2mqtt/bridge/request/permit_join',
      payload: JSON.stringify({ value: false }, null, 2),
    },
    {
      name: 'État du bridge',
      topic: 'zigbee2mqtt/bridge/config/state/get',
      payload: '',
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 500, mb: 1 }}>
          Debug - Communication Zigbee2MQTT
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Visualisez en temps réel tous les messages MQTT échangés avec Zigbee2MQTT.
        </Typography>
      </Box>

      {/* Statut et contrôles */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Chip
                label={isConnected ? 'WebSocket: Connecté' : 'WebSocket: Déconnecté'}
                color={isConnected ? 'success' : 'error'}
                size="small"
              />
              <Chip
                label={mqttStatus?.connected ? 'MQTT: Connecté' : 'MQTT: Déconnecté'}
                color={mqttStatus?.connected ? 'success' : 'error'}
                size="small"
              />
              <Chip
                label={`📥 ${mqttStatus?.messagesReceived || 0} reçus`}
                color="info"
                size="small"
              />
              <Chip
                label={`📤 ${mqttStatus?.messagesSent || 0} envoyés`}
                color="secondary"
                size="small"
              />
              <Chip
                label={`${logs.length} dans logs`}
                color="primary"
                size="small"
              />
              <Chip
                label={isPaused ? 'En pause' : 'En direct'}
                color={isPaused ? 'warning' : 'success'}
                size="small"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={isPaused ? <PlayArrowIcon /> : <PauseIcon />}
                onClick={() => setIsPaused(!isPaused)}
                size="small"
              >
                {isPaused ? 'Reprendre' : 'Pause'}
              </Button>
              <Button
                variant="outlined"
                startIcon={<DeleteIcon />}
                onClick={handleClearLogs}
                size="small"
                color="error"
              >
                Effacer
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Informations de connexion */}
      {mqttStatus && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, mb: 2 }}>
              État de la connexion MQTT
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Broker MQTT
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                    {mqttStatus.brokerUrl}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Client ID
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                    {mqttStatus.clientId}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Topics abonnés
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {mqttStatus.subscribedTopics.length > 0 ? (
                      mqttStatus.subscribedTopics.map((topic, index) => (
                        <Chip
                          key={index}
                          label={topic}
                          size="small"
                          sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}
                        />
                      ))
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Aucun topic abonné
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Dernier message reçu
                  </Typography>
                  <Typography variant="body1">
                    {mqttStatus.lastMessageReceived
                      ? new Date(mqttStatus.lastMessageReceived).toLocaleString('fr-FR')
                      : 'Jamais'}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Dernier message envoyé
                  </Typography>
                  <Typography variant="body1">
                    {mqttStatus.lastMessageSent
                      ? new Date(mqttStatus.lastMessageSent).toLocaleString('fr-FR')
                      : 'Jamais'}
                  </Typography>
                </Box>
                {!mqttStatus.connected && (
                  <Alert severity="error" sx={{ mt: 2 }}>
                    ⚠️ La connexion MQTT n'est pas établie. Vérifiez la configuration du broker.
                  </Alert>
                )}
                {mqttStatus.connected && mqttStatus.subscribedTopics.length === 0 && (
                  <Alert 
                    severity="error" 
                    sx={{ mt: 2 }}
                    action={
                      <Button
                        color="inherit"
                        size="small"
                        onClick={async () => {
                          try {
                            await devicesService.reconnectMqtt();
                            // Rafraîchir le statut après un court délai
                            setTimeout(async () => {
                              const status = await devicesService.getMqttStatus();
                              setMqttStatus(status);
                            }, 2000);
                          } catch (error) {
                            console.error('Erreur réabonnement:', error);
                          }
                        }}
                      >
                        Réabonner
                      </Button>
                    }
                  >
                    ⚠️ Aucun topic n'est abonné ! Cliquez sur "Réabonner" pour forcer l'abonnement.
                  </Alert>
                )}
                {mqttStatus.connected && mqttStatus.subscribedTopics.length > 0 && mqttStatus.messagesReceived === 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    ⚠️ Aucun message reçu depuis la connexion. Vérifiez que Zigbee2MQTT publie bien des messages.
                  </Alert>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {!isConnected && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          WebSocket non connecté. Les messages ne seront pas affichés en temps réel.
        </Alert>
      )}

      {/* Formulaire d'envoi de message */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Envoyer un message MQTT
          </Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
              Presets rapides
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {presets.map((preset, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  size="small"
                  onClick={() => loadPreset(preset)}
                >
                  {preset.name}
                </Button>
              ))}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              label="Topic MQTT"
              placeholder="Ex: zigbee2mqtt/bridge/config/devices/get"
              value={sendTopic}
              onChange={(e) => setSendTopic(e.target.value)}
              sx={{ fontFamily: 'monospace' }}
            />
            
            <TextField
              fullWidth
              label="Payload (JSON ou texte)"
              placeholder='Ex: {"value": true} ou texte simple'
              value={sendPayload}
              onChange={(e) => setSendPayload(e.target.value)}
              multiline
              rows={4}
              sx={{ fontFamily: 'monospace' }}
              helperText="Laissez vide pour envoyer une chaîne vide, ou entrez du JSON ou du texte"
            />

            {sendError && (
              <Alert severity="error" onClose={() => setSendError(null)}>
                {sendError}
              </Alert>
            )}

            <Button
              variant="contained"
              startIcon={<SendIcon />}
              onClick={handleSendMessage}
              disabled={sending || !sendTopic.trim()}
              sx={{ alignSelf: 'flex-start' }}
            >
              {sending ? 'Envoi...' : 'Envoyer le message'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              placeholder="Rechercher dans les messages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchTerm && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchTerm('')}>
                      <ClearIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ flexGrow: 1, minWidth: 200 }}
            />
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel>Filtrer par topic</InputLabel>
              <Select
                value={topicFilter}
                label="Filtrer par topic"
                onChange={(e) => setTopicFilter(e.target.value)}
              >
                <MenuItem value="all">Tous les topics</MenuItem>
                {uniqueTopics.map((topic) => (
                  <MenuItem key={topic} value={topic}>
                    {topic}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Max messages"
              type="number"
              value={maxLogs}
              onChange={(e) => setMaxLogs(parseInt(e.target.value) || 500)}
              sx={{ width: 120 }}
              size="small"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Zone de données brutes */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 500 }}>
              Données brutes d'échange MQTT
            </Typography>
            <Tabs
              value={rawDataView}
              onChange={(_, newValue) => setRawDataView(newValue)}
              sx={{ minHeight: 'auto' }}
            >
              <Tab label="Formaté" value="formatted" sx={{ minHeight: 'auto', py: 1 }} />
              <Tab label="Brut" value="raw" sx={{ minHeight: 'auto', py: 1 }} />
            </Tabs>
          </Box>
          
          <Paper
            sx={{
              maxHeight: '50vh',
              overflow: 'auto',
              bgcolor: '#1e1e1e',
              p: 2,
              borderRadius: 1,
            }}
          >
            {filteredLogs.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                Aucun message à afficher
              </Typography>
            ) : (
              <Box sx={{ position: 'relative' }}>
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: '#d4d4d4',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    lineHeight: 1.5,
                  }}
                >
                  {getRawDataString()}
                </Box>
                <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      navigator.clipboard.writeText(getRawDataString());
                    }}
                    sx={{ bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}
                  >
                    Copier
                  </Button>
                </Box>
              </Box>
            )}
          </Paper>
        </CardContent>
      </Card>

      {/* Liste des messages */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, mb: 2 }}>
            Messages MQTT ({filteredLogs.length})
          </Typography>
          <Paper
            sx={{
              maxHeight: '70vh',
              overflow: 'auto',
              bgcolor: '#1e1e1e',
              p: 2,
              borderRadius: 1,
            }}
          >
            {filteredLogs.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                {logs.length === 0
                  ? 'Aucun message reçu. Attendez que Zigbee2MQTT envoie des données.'
                  : 'Aucun message ne correspond aux filtres.'}
              </Typography>
            ) : (
              filteredLogs.map((log) => (
                <Box
                  key={log.id}
                  sx={{
                    mb: 2,
                    p: 2,
                    bgcolor: '#2d2d2d',
                    borderRadius: 1,
                    borderLeft: `4px solid ${getTopicColor(log.topic)}`,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        label={log.direction === 'incoming' ? '📥 Reçu' : '📤 Envoyé'}
                        size="small"
                        color={log.direction === 'incoming' ? 'primary' : 'secondary'}
                      />
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          color: getTopicColor(log.topic),
                          fontWeight: 500,
                        }}
                      >
                        {log.topic}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatTimestamp(log.timestamp)}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 1.5,
                      bgcolor: '#1e1e1e',
                      borderRadius: 1,
                      overflow: 'auto',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      color: '#d4d4d4',
                      maxHeight: 200,
                    }}
                  >
                    {formatPayload(log.payload)}
                  </Box>
                </Box>
              ))
            )}
            <div ref={logsEndRef} />
          </Paper>
        </CardContent>
      </Card>
    </Box>
  );
}

