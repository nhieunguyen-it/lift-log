import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import ExercisesPage from '@/pages/ExercisesPage';
import HistoryPage from '@/pages/HistoryPage';
import SettingsPage from '@/pages/SettingsPage';
import WorkoutPage from '@/pages/WorkoutPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<WorkoutPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="exercises" element={<ExercisesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
