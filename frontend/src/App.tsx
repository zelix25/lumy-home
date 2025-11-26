import { Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import DevicesPage from './pages/DevicesPage';
import DeviceDetailPage from './pages/DeviceDetailPage';
import ScenesPage from './pages/ScenesPage';
import AssistantPage from './pages/AssistantPage';
import HistoryPage from './pages/HistoryPage';
import DebugPage from './pages/DebugPage';
import NotificationSnackbar from './components/NotificationSnackbar';

function App() {
  return (
    <Layout>
      <Box sx={{ flexGrow: 1, p: 3 }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/appareils" element={<DevicesPage />} />
          <Route path="/appareils/:ieeeAddress" element={<DeviceDetailPage />} />
          <Route path="/scenes" element={<ScenesPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/historique" element={<HistoryPage />} />
          <Route path="/debug" element={<DebugPage />} />
        </Routes>
      </Box>
      <NotificationSnackbar />
    </Layout>
  );
}

export default App;

