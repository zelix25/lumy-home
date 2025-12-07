import { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Save as SaveIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  FitScreen as FitScreenIcon,
} from '@mui/icons-material';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  NodeTypes,
  BackgroundVariant,
  Position,
  ReactFlowProvider,
  useReactFlow,
  MarkerType,
  ConnectionLineType,
  Handle,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTranslation } from 'react-i18next';
import { useDevices } from '../hooks/useDevices';
import {
  AutomationTriggerType,
  AutomationActionType,
  CreateAutomationDto,
  simpleAutomationsService,
} from '../services/simple-automations.service';
import { useNotification } from '../hooks/useNotification';

interface NodeEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  automation?: any;
}

// Types de noeuds personnalisés
interface TriggerNodeData {
  label: string;
  triggerType: AutomationTriggerType;
  deviceId?: string;
  deviceName?: string;
  operator?: '>' | '<' | '>=' | '<=' | '=';
  value?: number;
}

interface ActionNodeData {
  label: string;
  actionType: AutomationActionType;
  deviceId?: string;
  deviceName?: string;
  params?: Record<string, any>;
}

interface ConditionNodeData {
  label: string;
  condition: 'AND' | 'OR';
}

// Composants de noeuds personnalisés
const TriggerNode = ({ data }: { data: TriggerNodeData }) => {
  return (
    <Paper
      sx={{
        p: 2,
        minWidth: 180,
        bgcolor: '#E3F2FD',
        border: '2px solid #2196F3',
        borderRadius: 2,
        position: 'relative',
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {data.label}
      </Typography>
      {data.deviceName && (
        <Chip label={data.deviceName} size="small" sx={{ mt: 0.5 }} />
      )}
      {/* Handle de sortie à droite */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#2196F3',
          width: 12,
          height: 12,
          border: '2px solid #fff',
        }}
      />
    </Paper>
  );
};

const ActionNode = ({ data }: { data: ActionNodeData }) => {
  return (
    <Paper
      sx={{
        p: 2,
        minWidth: 180,
        bgcolor: '#F3E5F5',
        border: '2px solid #9C27B0',
        borderRadius: 2,
        position: 'relative',
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
        {data.label}
      </Typography>
      {data.deviceName && (
        <Chip label={data.deviceName} size="small" sx={{ mt: 0.5 }} />
      )}
      {/* Handle d'entrée à gauche */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#9C27B0',
          width: 12,
          height: 12,
          border: '2px solid #fff',
        }}
      />
      {/* Handle de sortie à droite (pour chaîner les actions) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#9C27B0',
          width: 12,
          height: 12,
          border: '2px solid #fff',
        }}
      />
    </Paper>
  );
};

const ConditionNode = ({ data }: { data: ConditionNodeData }) => {
  return (
    <Paper
      sx={{
        p: 2,
        minWidth: 150,
        bgcolor: '#FFF3E0',
        border: '2px solid #FF9800',
        borderRadius: 2,
        textAlign: 'center',
        position: 'relative',
      }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
        {data.label}
      </Typography>
      <Chip label={data.condition} size="small" sx={{ mt: 1 }} color="warning" />
      {/* Handle d'entrée à gauche */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#FF9800',
          width: 12,
          height: 12,
          border: '2px solid #fff',
        }}
      />
      {/* Handle de sortie à droite */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#FF9800',
          width: 12,
          height: 12,
          border: '2px solid #fff',
        }}
      />
    </Paper>
  );
};

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
};

// Composant interne pour gérer l'ajout de noeuds avec conversion de coordonnées
function FlowContent({
  nodes,
  setNodes,
  edges,
  setEdges,
  onNodesChange,
  onEdgesChange,
  handleConnect,
  menuPosition,
  setMenuPosition,
  selectedNodeId,
  setSelectedNodeId,
  devices,
  t,
  defaultEdgeOptions,
}: {
  nodes: Node[];
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  edges: any[];
  setEdges: React.Dispatch<React.SetStateAction<any[]>>;
  onNodesChange: any;
  onEdgesChange: any;
  handleConnect: (params: Connection) => void;
  menuPosition: { x: number; y: number } | null;
  setMenuPosition: (pos: { x: number; y: number } | null) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  devices: any[];
  t: (key: string) => string;
  defaultEdgeOptions: any;
}) {
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);
  const { screenToFlowPosition } = useReactFlow();

  const handleAddNode = useCallback(
    (type: 'trigger' | 'action' | 'condition', screenPosition: { x: number; y: number }) => {
      // Convertir les coordonnées de l'écran en coordonnées du flow
      const flowPosition = screenToFlowPosition({ x: screenPosition.x, y: screenPosition.y });
      const newNodeId = `${type}-${Date.now()}`;
      let newNode: Node;

      if (type === 'trigger') {
        newNode = {
          id: newNodeId,
          type: 'trigger',
          position: flowPosition,
          data: {
            label: t('automations.triggerMotion'),
            triggerType: AutomationTriggerType.MOTION,
          },
          sourcePosition: Position.Right,
        };
      } else if (type === 'action') {
        newNode = {
          id: newNodeId,
          type: 'action',
          position: flowPosition,
          data: {
            label: t('automations.actionTurnOn'),
            actionType: AutomationActionType.TURN_ON,
          },
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
        };
      } else {
        newNode = {
          id: newNodeId,
          type: 'condition',
          position: flowPosition,
          data: {
            label: t('automations.nodeEditor.condition'),
            condition: 'AND' as const,
          },
          targetPosition: Position.Left,
          sourcePosition: Position.Right,
        };
      }

      setNodes((nds) => [...nds, newNode]);
      setMenuPosition(null);
    },
    [t, setNodes, screenToFlowPosition],
  );

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setMenuPosition({ x: event.clientX, y: event.clientY });
    },
    [setMenuPosition],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNodeId(node.id);
    },
    [setSelectedNodeId],
  );

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
      <Menu
        open={!!menuPosition}
        onClose={() => setMenuPosition(null)}
        anchorReference="anchorPosition"
        anchorPosition={menuPosition ? { top: menuPosition.y, left: menuPosition.x } : undefined}
      >
        <MenuItem
          onClick={() => {
            if (menuPosition) {
              handleAddNode('trigger', menuPosition);
            }
          }}
        >
          {t('automations.nodeEditor.addTrigger')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuPosition) {
              handleAddNode('action', menuPosition);
            }
          }}
        >
          {t('automations.nodeEditor.addAction')}
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuPosition) {
              handleAddNode('condition', menuPosition);
            }
          }}
        >
          {t('automations.nodeEditor.addCondition')}
        </MenuItem>
      </Menu>
    </>
  );
}

export default function NodeEditorDialog({
  open,
  onClose,
  onSuccess,
}: NodeEditorDialogProps) {
  const { t } = useTranslation();
  const { devices } = useDevices();
  const { addNotification } = useNotification();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Initialiser les noeuds avec un noeud trigger par défaut
  const initialNodes: Node[] = useMemo(
    () => [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 100 },
        data: {
          label: t('automations.triggerMotion'),
          triggerType: AutomationTriggerType.MOTION,
        },
        sourcePosition: Position.Right,
      },
    ],
    [t],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  
  // Obtenir le node sélectionné depuis le tableau nodes
  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Styles personnalisés pour les edges (connexions)
  const defaultEdgeOptions = useMemo(
    () => ({
      style: {
        strokeWidth: 2,
        stroke: '#6366f1',
      },
      type: 'smoothstep' as ConnectionLineType,
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#6366f1',
      },
    }),
    [],
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      // Créer un edge avec les options par défaut
      const newEdge = {
        ...params,
        id: `edge-${params.source}-${params.target}-${Date.now()}`,
        type: defaultEdgeOptions.type,
        animated: defaultEdgeOptions.animated,
        style: defaultEdgeOptions.style,
        markerEnd: defaultEdgeOptions.markerEnd,
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, defaultEdgeOptions],
  );


  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((node) => node.id !== nodeId));
      setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      setSelectedNodeId(null);
    },
    [setNodes, setEdges],
  );

  const handleSave = async () => {
    if (!name.trim()) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: t('automations.nameRequired'),
      });
      return;
    }

    // Convertir le flux de noeuds en automation
    const triggerNodes = nodes.filter((n) => n.type === 'trigger');
    const actionNodes = nodes.filter((n) => n.type === 'action');

    if (triggerNodes.length === 0) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: t('automations.nodeEditor.noTriggerNode'),
      });
      return;
    }

    if (actionNodes.length === 0) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: t('automations.nodeEditor.noActionNode'),
      });
      return;
    }

    // Prendre le premier noeud trigger (on peut améliorer pour supporter plusieurs triggers)
    const triggerNode = triggerNodes[0];
    const triggerData = triggerNode.data as TriggerNodeData;

    // Trouver les actions connectées au trigger
    const connectedActionIds = edges
      .filter((e) => e.source === triggerNode.id)
      .map((e) => e.target);

    // Si des conditions sont présentes, suivre les connexions
    const finalActionIds = connectedActionIds.filter((id) => {
      const node = nodes.find((n) => n.id === id);
      return node?.type === 'action';
    });

    if (finalActionIds.length === 0) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: t('automations.nodeEditor.noConnectedActions'),
      });
      return;
    }

    // Créer les actions
    const actions = finalActionIds.map((actionId) => {
      const actionNode = nodes.find((n) => n.id === actionId);
      const actionData = actionNode?.data as ActionNodeData;
      return {
        type: actionData.actionType,
        deviceId: actionData.deviceId || '',
        deviceName: actionData.deviceName,
        params: actionData.params,
      };
    });

    try {
      const createData: CreateAutomationDto = {
        name: name.trim(),
        description: description.trim() || undefined,
        trigger: {
          type: triggerData.triggerType,
          deviceId: triggerData.deviceId,
          deviceName: triggerData.deviceName,
          condition: triggerData.operator && triggerData.value !== undefined
            ? {
                operator: triggerData.operator,
                value: triggerData.value,
              }
            : undefined,
        },
        actions,
      };

      await simpleAutomationsService.create(createData);
      addNotification({
        type: 'success',
        title: t('automations.created'),
        message: t('automations.createdMessage'),
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      addNotification({
        type: 'error',
        title: t('automations.error'),
        message: error.message || t('automations.createError'),
      });
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setNodes(initialNodes);
    setEdges([]);
    setSelectedNodeId(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{t('automations.nodeEditor.title')}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton size="small" onClick={() => {/* Zoom in */}}>
              <ZoomInIcon />
            </IconButton>
            <IconButton size="small" onClick={() => {/* Zoom out */}}>
              <ZoomOutIcon />
            </IconButton>
            <IconButton size="small" onClick={() => {/* Fit screen */}}>
              <FitScreenIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
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

        <Box sx={{ height: 600, border: '1px solid #e0e0e0', borderRadius: 1 }}>
          <ReactFlowProvider>
            <FlowContent
              nodes={nodes}
              setNodes={setNodes}
              edges={edges}
              setEdges={setEdges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              handleConnect={handleConnect}
              menuPosition={menuPosition}
              setMenuPosition={setMenuPosition}
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
              devices={devices}
              t={t}
              defaultEdgeOptions={defaultEdgeOptions}
            />
          </ReactFlowProvider>
        </Box>

        {selectedNode && (
          <Paper sx={{ mt: 2, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {t('automations.nodeEditor.nodeSettings')}
              </Typography>
              <IconButton
                size="small"
                color="error"
                onClick={() => selectedNodeId && handleDeleteNode(selectedNodeId)}
              >
                <DeleteIcon />
              </IconButton>
            </Box>
            {selectedNode.type === 'trigger' && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>{t('automations.nodeEditor.triggerType')}</InputLabel>
                  <Select
                    value={(selectedNode.data as TriggerNodeData).triggerType}
                    label={t('automations.nodeEditor.triggerType')}
                    onChange={(e) => {
                      const triggerType = e.target.value as AutomationTriggerType;
                      const triggerLabels: Record<AutomationTriggerType, string> = {
                        [AutomationTriggerType.MOTION]: t('automations.triggerMotion'),
                        [AutomationTriggerType.CONTACT]: t('automations.triggerContact'),
                        [AutomationTriggerType.TEMPERATURE]: t('automations.triggerTemperature'),
                        [AutomationTriggerType.BUTTON]: t('automations.triggerButton'),
                        [AutomationTriggerType.VIBRATION]: t('automations.triggerVibration'),
                        [AutomationTriggerType.ILLUMINANCE]: t('automations.triggerIlluminance'),
                        [AutomationTriggerType.HUMIDITY]: t('automations.triggerHumidity'),
                        [AutomationTriggerType.WATER_LEAK]: t('automations.triggerWaterLeak'),
                        [AutomationTriggerType.SMOKE]: t('automations.triggerSmoke'),
                        [AutomationTriggerType.GAS]: t('automations.triggerGas'),
                        [AutomationTriggerType.SUNRISE_SUNSET]: t('automations.triggerSunriseSunset'),
                        [AutomationTriggerType.TIME]: t('automations.triggerTime'),
                        [AutomationTriggerType.MANUAL]: t('automations.triggerManual'),
                      };
                      setNodes((nds) =>
                        nds.map((node) =>
                          node.id === selectedNodeId
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  triggerType,
                                  label: triggerLabels[triggerType] || triggerType,
                                },
                              }
                            : node,
                        ),
                      );
                    }}
                  >
                    {Object.values(AutomationTriggerType).map((type) => {
                      const triggerLabels: Record<AutomationTriggerType, string> = {
                        [AutomationTriggerType.MOTION]: t('automations.triggerMotion'),
                        [AutomationTriggerType.CONTACT]: t('automations.triggerContact'),
                        [AutomationTriggerType.TEMPERATURE]: t('automations.triggerTemperature'),
                        [AutomationTriggerType.BUTTON]: t('automations.triggerButton'),
                        [AutomationTriggerType.VIBRATION]: t('automations.triggerVibration'),
                        [AutomationTriggerType.ILLUMINANCE]: t('automations.triggerIlluminance'),
                        [AutomationTriggerType.HUMIDITY]: t('automations.triggerHumidity'),
                        [AutomationTriggerType.WATER_LEAK]: t('automations.triggerWaterLeak'),
                        [AutomationTriggerType.SMOKE]: t('automations.triggerSmoke'),
                        [AutomationTriggerType.GAS]: t('automations.triggerGas'),
                        [AutomationTriggerType.SUNRISE_SUNSET]: t('automations.triggerSunriseSunset'),
                        [AutomationTriggerType.TIME]: t('automations.triggerTime'),
                        [AutomationTriggerType.MANUAL]: t('automations.triggerManual'),
                      };
                      return (
                        <MenuItem key={type} value={type}>
                          {triggerLabels[type] || type}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>{t('automations.selectTriggerDevice')}</InputLabel>
                  <Select
                    value={selectedNode ? ((selectedNode.data as TriggerNodeData).deviceId || '') : ''}
                    label={t('automations.selectTriggerDevice')}
                    onChange={(e) => {
                      const device = devices.find((d) => d.ieeeAddress === e.target.value);
                      setNodes((nds) =>
                        nds.map((node) =>
                          node.id === selectedNodeId
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  deviceId: e.target.value,
                                  deviceName: device?.friendlyName,
                                },
                              }
                            : node,
                        ),
                      );
                    }}
                  >
                    <MenuItem value="">{t('common.none')}</MenuItem>
                    {devices
                      .filter((d) => {
                        const triggerType = selectedNode ? (selectedNode.data as TriggerNodeData).triggerType : AutomationTriggerType.MOTION;
                        // Filtrer selon le type de déclencheur
                        if (triggerType === AutomationTriggerType.MOTION) {
                          return d.type === 'motion' || d.type === 'sensor';
                        }
                        if (triggerType === AutomationTriggerType.CONTACT) {
                          return d.type === 'door' || d.type === 'window';
                        }
                        if (triggerType === AutomationTriggerType.BUTTON) {
                          return d.type === 'button' || d.type === 'switch';
                        }
                        if (triggerType === AutomationTriggerType.TEMPERATURE || 
                            triggerType === AutomationTriggerType.ILLUMINANCE || 
                            triggerType === AutomationTriggerType.HUMIDITY) {
                          return d.type === 'sensor' || d.type === 'temperature' || d.type === 'illuminance' || d.type === 'humidity';
                        }
                        return true;
                      })
                      .map((device) => (
                        <MenuItem key={device.ieeeAddress} value={device.ieeeAddress}>
                          {device.friendlyName || device.ieeeAddress}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
                {/* Inputs pour les valeurs (température, luminosité, humidité) */}
                {(selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.TEMPERATURE ||
                (selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.ILLUMINANCE ||
                (selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.HUMIDITY ? (
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <FormControl sx={{ minWidth: 100 }}>
                      <InputLabel>{t('automations.operator')}</InputLabel>
                      <Select
                        value={(selectedNode?.data as TriggerNodeData)?.operator || '>'}
                        label={t('automations.operator')}
                        onChange={(e) => {
                          setNodes((nds) =>
                            nds.map((node) =>
                              node.id === selectedNodeId
                                ? {
                                    ...node,
                                    data: {
                                      ...node.data,
                                      operator: e.target.value as '>' | '<' | '>=' | '<=' | '=',
                                    },
                                  }
                                : node,
                            ),
                          );
                        }}
                      >
                        <MenuItem value=">">{'>'}</MenuItem>
                        <MenuItem value="<">{'<'}</MenuItem>
                        <MenuItem value=">=">{'>='}</MenuItem>
                        <MenuItem value="<=">{'<='}</MenuItem>
                        <MenuItem value="=">{'='}</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      type="number"
                      label={
                        (selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.TEMPERATURE
                          ? t('automations.value') + ' (°C)'
                          : (selectedNode?.data as TriggerNodeData)?.triggerType === AutomationTriggerType.ILLUMINANCE
                          ? t('automations.value') + ' (lux)'
                          : t('automations.value') + ' (%)'
                      }
                      value={(selectedNode?.data as TriggerNodeData)?.value || ''}
                      onChange={(e) => {
                        const numValue = e.target.value ? parseFloat(e.target.value) : undefined;
                        setNodes((nds) =>
                          nds.map((node) =>
                            node.id === selectedNodeId
                              ? {
                                  ...node,
                                  data: {
                                    ...node.data,
                                    value: numValue,
                                  },
                                }
                              : node,
                          ),
                        );
                      }}
                      sx={{ flex: 1 }}
                      inputProps={{ step: '0.1' }}
                    />
                  </Box>
                ) : null}
              </Stack>
            )}
            {selectedNode && selectedNode.type === 'action' && (
              <Stack spacing={2}>
                <FormControl fullWidth>
                  <InputLabel>{t('automations.nodeEditor.actionType')}</InputLabel>
                  <Select
                    value={selectedNode ? (selectedNode.data as ActionNodeData).actionType : AutomationActionType.TURN_ON}
                    label={t('automations.nodeEditor.actionType')}
                    onChange={(e) => {
                      const actionType = e.target.value as AutomationActionType;
                      const actionLabels: Record<AutomationActionType, string> = {
                        [AutomationActionType.TURN_ON]: t('automations.actionTurnOn'),
                        [AutomationActionType.TURN_OFF]: t('automations.actionTurnOff'),
                        [AutomationActionType.TOGGLE]: t('automations.actionToggle'),
                        [AutomationActionType.SET_BRIGHTNESS]: t('automations.actionSetBrightness'),
                        [AutomationActionType.SET_COLOR]: t('automations.actionSetColor'),
                        [AutomationActionType.SET_COLOR_TEMP]: t('automations.actionSetColorTemp'),
                        [AutomationActionType.SET_THERMOSTAT]: t('automations.actionSetThermostat'),
                        [AutomationActionType.NOTIFY]: t('automations.actionNotify'),
                      };
                      setNodes((nds) =>
                        nds.map((node) =>
                          node.id === selectedNodeId
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  actionType,
                                  label: actionLabels[actionType] || actionType,
                                },
                              }
                            : node,
                        ),
                      );
                    }}
                  >
                    {Object.values(AutomationActionType).map((type) => {
                      const actionLabels: Record<AutomationActionType, string> = {
                        [AutomationActionType.TURN_ON]: t('automations.actionTurnOn'),
                        [AutomationActionType.TURN_OFF]: t('automations.actionTurnOff'),
                        [AutomationActionType.TOGGLE]: t('automations.actionToggle'),
                        [AutomationActionType.SET_BRIGHTNESS]: t('automations.actionSetBrightness'),
                        [AutomationActionType.SET_COLOR]: t('automations.actionSetColor'),
                        [AutomationActionType.SET_COLOR_TEMP]: t('automations.actionSetColorTemp'),
                        [AutomationActionType.SET_THERMOSTAT]: t('automations.actionSetThermostat'),
                        [AutomationActionType.NOTIFY]: t('automations.actionNotify'),
                      };
                      return (
                        <MenuItem key={type} value={type}>
                          {actionLabels[type] || type}
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <InputLabel>{t('automations.selectActionDevice')}</InputLabel>
                  <Select
                    value={selectedNode ? ((selectedNode.data as ActionNodeData).deviceId || '') : ''}
                    label={t('automations.selectActionDevice')}
                    onChange={(e) => {
                      const device = devices.find((d) => d.ieeeAddress === e.target.value);
                      setNodes((nds) =>
                        nds.map((node) =>
                          node.id === selectedNodeId
                            ? {
                                ...node,
                                data: {
                                  ...node.data,
                                  deviceId: e.target.value,
                                  deviceName: device?.friendlyName,
                                },
                              }
                            : node,
                        ),
                      );
                    }}
                  >
                    <MenuItem value="">{t('common.none')}</MenuItem>
                    {devices
                      .filter((d) => {
                        const actionType = (selectedNode.data as ActionNodeData).actionType;
                        // Filtrer selon le type d'action
                        if (actionType === AutomationActionType.TURN_ON || actionType === AutomationActionType.TURN_OFF) {
                          return d.type === 'light' || d.type === 'switch' || d.type === 'plug';
                        }
                        if (actionType === AutomationActionType.SET_BRIGHTNESS) {
                          return d.type === 'light';
                        }
                        return true;
                      })
                      .map((device) => (
                        <MenuItem key={device.ieeeAddress} value={device.ieeeAddress}>
                          {device.friendlyName || device.ieeeAddress}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Stack>
            )}
            {selectedNode && selectedNode.type === 'condition' && (
              <FormControl fullWidth>
                <InputLabel>{t('automations.nodeEditor.condition')}</InputLabel>
                <Select
                  value={(selectedNode.data as ConditionNodeData).condition}
                  label={t('automations.nodeEditor.condition')}
                  onChange={(e) => {
                    setNodes((nds) =>
                      nds.map((node) =>
                        node.id === selectedNodeId
                          ? {
                              ...node,
                              data: {
                                ...node.data,
                                condition: e.target.value as 'AND' | 'OR',
                              },
                            }
                          : node,
                      ),
                    );
                  }}
                >
                  <MenuItem value="AND">AND</MenuItem>
                  <MenuItem value="OR">OR</MenuItem>
                </Select>
              </FormControl>
            )}
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={handleSave} startIcon={<SaveIcon />}>
          {t('common.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

