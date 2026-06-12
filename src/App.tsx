import { Routes, Route, Navigate } from 'react-router';
import MemberConnectionsPage from '@/pages/MemberConnectionsPage';
import LeaderConnectionsPage from '@/pages/LeaderConnectionsPage';
import GalaxyPage from '@/pages/GalaxyPage';
import HeatmapPage from '@/pages/HeatmapPage';
import HierarchyPage from '@/pages/HierarchyPage';
import TimelinePage from '@/pages/TimelinePage';

export default function App() {
  return (
    <Routes>
      <Route path="/leader" element={<LeaderConnectionsPage />} />
      <Route path="/" element={<MemberConnectionsPage />} />
      <Route path="/member" element={<MemberConnectionsPage />} />
      <Route path="/galaxy" element={<GalaxyPage />} />
      <Route path="/heatmap" element={<HeatmapPage />} />
      <Route path="/hierarchy" element={<HierarchyPage />} />
      <Route path="/timeline" element={<TimelinePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
