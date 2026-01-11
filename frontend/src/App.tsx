import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import GlobalSetupChecker from './components/GlobalSetupChecker';
import HomePage from './pages/HomePage';
import DevicesPage from './pages/DevicesPage';
import DeviceDetailPage from './pages/DeviceDetailPage';
import ScenesPage from './pages/ScenesPage';
import AssistantPage from './pages/AssistantPage';
import HistoryPage from './pages/HistoryPage';
import PlanPage from './pages/PlanPage';
import DebugPage from './pages/DebugPage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import AccountPage from './pages/AccountPage';
import SettingsPage from './pages/SettingsPage';
import StoreConnectPage from './pages/StoreConnectPage';
import StorePage from './pages/StorePage';
import NotificationSnackbar from './components/NotificationSnackbar';
import UpdateNotification from './components/UpdateNotification';
import { usePluginRoutes } from './hooks/usePluginRoutes';

function App() {
  // Charger les routes des plugins dynamiquement
  const pluginRoutes = usePluginRoutes();

  return (
    <GlobalSetupChecker>
      <Routes>
        {/* Routes publiques */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />

        {/* Routes protégées - nécessitent une authentification */}
        <Route
          path="/*"
          element={
            <ProtectedRoute requireAuth={true}>
              <Layout>
                <Box sx={{ flexGrow: 1, p: 3 }}>
                  <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/appareils" element={<DevicesPage />} />
                    <Route path="/appareils/:ieeeAddress" element={<DeviceDetailPage />} />
                    <Route path="/scenes" element={<ScenesPage />} />
                    <Route path="/assistant" element={<AssistantPage />} />
                    <Route path="/historique" element={<HistoryPage />} />
                    <Route path="/plan" element={<PlanPage />} />
                    <Route path="/debug" element={<DebugPage />} />
                    <Route path="/account" element={<AccountPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/store" element={<StorePage />} />
                    <Route path="/store/connect" element={<StoreConnectPage />} />
                    {/* Routes dynamiques des plugins */}
                    {pluginRoutes.map((route) => (
                      <Route
                        key={route.path}
                        path={route.path}
                        element={route.element}
                      />
                    ))}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Box>
                <NotificationSnackbar />
                <UpdateNotification />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </GlobalSetupChecker>
  );
}

export default App;
