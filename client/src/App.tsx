import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ReportsView from './components/ReportsView';
import EmergencyPanel from './components/EmergencyPanel';
import { useSocket } from './hooks/useSocket';
import { useDiveStore } from './stores/diveStore';

export default function App() {
  // Initialize socket connection and event handlers
  useSocket();

  // Fetch active dive on startup
  const fetchActiveDive = useDiveStore((s) => s.fetchActiveDive);
  useEffect(() => {
    fetchActiveDive();
  }, [fetchActiveDive]);

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reports" element={<ReportsView />} />
        <Route path="/emergency" element={<EmergencyPanel />} />
      </Routes>
    </Layout>
  );
}
