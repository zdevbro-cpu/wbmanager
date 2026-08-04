import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { InboundFormPage } from './pages/InboundFormPage';
import { OutboundFormPage } from './pages/OutboundFormPage';
import { WasteOutboundFormPage } from './pages/WasteOutboundFormPage';
import { MasterManagementPage } from './pages/MasterManagementPage';
import { LedgerPage } from './pages/LedgerPage';
import { AggregationPage } from './pages/AggregationPage';
import { DailyReportPage } from './pages/DailyReportPage';
import { InventoryPage } from './pages/InventoryPage';
import { PnlPage } from './pages/PnlPage';
import { WasteManagementPage } from './pages/WasteManagementPage';
import { AdminAlertsPage } from './pages/AdminAlertsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/inbound" replace />} />
          <Route path="/inbound" element={<InboundFormPage />} />
          <Route path="/outbound" element={<OutboundFormPage />} />
          <Route path="/waste-outbound" element={<WasteOutboundFormPage />} />
          <Route path="/ledger" element={<LedgerPage />} />
          <Route path="/aggregation" element={<AggregationPage />} />
          <Route path="/daily-report" element={<DailyReportPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/pnl" element={<PnlPage />} />
          <Route path="/waste" element={<WasteManagementPage />} />
          <Route path="/admin-alerts" element={<AdminAlertsPage />} />
          <Route path="/masters" element={<MasterManagementPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
