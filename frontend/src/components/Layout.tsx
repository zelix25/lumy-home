import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import HomeIcon from '@mui/icons-material/Home';
import DevicesIcon from '@mui/icons-material/Devices';
import SceneIcon from '@mui/icons-material/AutoAwesome';
import HistoryIcon from '@mui/icons-material/History';
import MapIcon from '@mui/icons-material/Map';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SettingsIcon from '@mui/icons-material/Settings';
import ComputerIcon from '@mui/icons-material/Computer';
import LogoutIcon from '@mui/icons-material/Logout';
import StoreIcon from '@mui/icons-material/Store';
import LanguageSelector from './LanguageSelector';
import SystemNotifications from './SystemNotifications';
import QrCodeModal from './QrCodeModal';
//import UpdateModal from './UpdateModal';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { usePluginMenuItems } from '../hooks/usePluginRoutes';
//import { ServiceUpdateInfo } from '../services/updater.service';
import QrCodeIcon from '@mui/icons-material/QrCode';

const drawerWidth = 240; // Largeur sidebar selon guide scandinave
const LOGO_PATH = '/assets/logo.png';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

const getNavItems = (t: (key: string) => string): NavItem[] => [
  { label: t('common.home'), path: '/', icon: <HomeIcon /> },
  { label: t('common.devices'), path: '/appareils', icon: <DevicesIcon /> },
  { label: t('common.scenes'), path: '/scenes', icon: <SceneIcon /> },
  //{ label: t('common.assistant'), path: '/assistant', icon: <SmartToyIcon /> },
  { label: t('common.history'), path: '/historique', icon: <HistoryIcon /> },
  { label: t('common.plan'), path: '/plan', icon: <MapIcon /> },
  { label: t('menu.store'), path: '/store', icon: <StoreIcon /> },
  //{ label: t('common.debug'), path: '/debug', icon: <BugReportIcon /> },
];

export default function Layout({ children }: LayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [qrCodeModalOpen, setQrCodeModalOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { t } = useTranslation();
  const { logout, isAuthenticated, user } = useAuth();
  const pluginMenuItems = usePluginMenuItems();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleMenuClose();
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleAccount = () => {
    navigate('/account');
    handleMenuClose();
  };

  const handleSettings = () => {
    navigate('/settings');
    handleMenuClose();
  };

  const handleStore = () => {
    navigate('/store/connect');
    handleMenuClose();
  };

  const handleSystem = () => {
    navigate('/system');
    handleMenuClose();
  };

  const handleQrCode = () => {
    handleMenuClose();
    // Petit délai pour s'assurer que le menu est fermé avant d'ouvrir la modal
    setTimeout(() => {
      setQrCodeModalOpen(true);
    }, 100);
  };

  const drawer = (
    <Box>
      <Toolbar
        sx={{
          background: '#FFFFFF',
          color: '#1E1E1E',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          minHeight: '64px !important',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="img"
            src={LOGO_PATH}
            alt="Lumy Home"
            sx={{ height: 30, width: 'auto' }}
          />
        </Box>
      </Toolbar>
      <List sx={{ pt: 2 }}>
        {getNavItems(t).map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                mx: 1,
                mb: 0.5,
                borderRadius: 8,
                transition: 'all 0.15s ease-in-out',
                '&:hover': {
                  backgroundColor: 'rgba(0,0,0,0.04)',
                },
                '&.Mui-selected': {
                  backgroundColor: 'rgba(134, 166, 160, 0.1)',
                  color: '#1E1E1E',
                  '&:hover': {
                    backgroundColor: 'rgba(134, 166, 160, 0.15)',
                  },
                  '& .MuiListItemIcon-root': {
                    color: '#86A6A0',
                  },
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: location.pathname === item.path ? '#86A6A0' : 'text.secondary',
                  minWidth: 40,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: location.pathname === item.path ? 500 : 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
        {/* Éléments de menu des plugins */}
        {pluginMenuItems
          .sort((a, b) => (a.menuOrder ?? 999) - (b.menuOrder ?? 999))
          .map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                selected={location.pathname === item.menuPath}
                onClick={() => item.menuPath && handleNavigation(item.menuPath)}
                sx={{
                  mx: 1,
                  mb: 0.5,
                  borderRadius: 8,
                  transition: 'all 0.15s ease-in-out',
                  '&:hover': {
                    backgroundColor: 'rgba(0,0,0,0.04)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(134, 166, 160, 0.1)',
                    color: '#1E1E1E',
                    '&:hover': {
                      backgroundColor: 'rgba(134, 166, 160, 0.15)',
                    },
                    '& .MuiListItemIcon-root': {
                      color: '#86A6A0',
                    },
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: location.pathname === item.menuPath ? '#86A6A0' : 'text.secondary',
                    minWidth: 40,
                  }}
                >
                  {item.icon ? (
                    <Box component="span" sx={{ fontSize: 24 }}>
                      {item.icon}
                    </Box>
                  ) : (
                    <StoreIcon />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item.displayName}
                  primaryTypographyProps={{
                    fontWeight: location.pathname === item.menuPath ? 500 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          </Typography>
          {isAuthenticated && user && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
              <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {user.email}
              </Typography>
              <IconButton
                color="inherit"
                onClick={handleMenuOpen}
                size="small"
                aria-label="menu utilisateur"
              >
                <AccountCircleIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={handleAccount}>
                  <ListItemIcon>
                    <AccountCircleIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('menu.myAccount')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleSettings}>
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('menu.settings')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleStore}>
                  <ListItemIcon>
                    <StoreIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('menu.store')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleSystem}>
                  <ListItemIcon>
                    <ComputerIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('menu.system')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleQrCode}>
                  <ListItemIcon>
                    <QrCodeIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('menu.qrCode')}</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>{t('menu.logout')}</ListItemText>
                </MenuItem>
              </Menu>
            </Box>
          )}
          <SystemNotifications />
          <LanguageSelector />
        </Toolbar>
      </AppBar>
      <QrCodeModal open={qrCodeModalOpen} onClose={() => setQrCodeModalOpen(false)} />
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

