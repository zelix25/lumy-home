import { Routes, Route, Navigate } from 'react-router-dom';
import { Box } from '@mui/material';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import SetupChecker from './components/SetupChecker';
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
import NotificationSnackbar from './components/NotificationSnackbar';

function App() {
  return (
    <Routes>
      {/* Routes publiques */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />

      {/* Routes protégées - nécessitent une authentification */}
      <Route
        path="/*"
        element={
          <SetupChecker>
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
                    <Route path="/store" element={<StoreConnectPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Box>
                <NotificationSnackbar />
              </Layout>
            </ProtectedRoute>
          </SetupChecker>
        }
      />
    </Routes>
  );
}

export default App;
