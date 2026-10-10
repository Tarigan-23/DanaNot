import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Borrowers from './pages/Borrowers';
import Loans from './pages/Loans';
import Payments from './pages/Payments';
import Reports from './pages/Reports';
import BorrowerDetail from './pages/BorrowerDetail';
import Settings from './pages/Settings';
import { initializeStorage } from './services/storage';
import { registerServiceWorker } from './services/pwa';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Ensure dark theme is permanently active
    document.documentElement.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');

    // Initialize IndexedDB storage & register Service Worker
    initializeStorage().then(() => {
      setReady(true);
    });
    registerServiceWorker();
  }, []);

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/borrowers" element={<Borrowers />} />
          <Route path="/borrowers/:id" element={<BorrowerDetail />} />
          <Route path="/loans" element={<Loans />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}

export default App;
