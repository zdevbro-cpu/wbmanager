import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { InboundListPage } from './pages/InboundListPage';
import { OutboundListPage } from './pages/OutboundListPage';
import { WasteInboundListPage } from './pages/WasteInboundListPage';
import { WasteOutboundListPage } from './pages/WasteOutboundListPage';
import { AssetManagementPage } from './pages/AssetManagementPage';
import { EmployeeManagementPage } from './pages/EmployeeManagementPage';
import { ProjectManagementPage } from './pages/ProjectManagementPage';
import { SystemAdminPage } from './pages/SystemAdminPage';
import { EntryPage } from './pages/EntryPage';
import { LedgerPage } from './pages/LedgerPage';
import { AggregationPage } from './pages/AggregationPage';
import { DailyReportPage } from './pages/DailyReportPage';
import { InventoryPage } from './pages/InventoryPage';
import { PnlPage } from './pages/PnlPage';
import { WasteManagementPage } from './pages/WasteManagementPage';
import { AdminAlertsPage } from './pages/AdminAlertsPage';

function Gate() {
  const { firebaseUser, appUser, loading } = useAuth();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-bg text-text-sub">불러오는 중...</div>;
  }

  if (!firebaseUser) return <LoginPage />;
  if (!appUser || appUser.status !== 'approved') return <PendingApprovalPage />;

  return (
    <Routes>
      {/* 시작 화면은 사이드바 없이 카드만 띄운다. */}
      <Route path="/" element={<EntryPage />} />
      <Route element={<Layout />}>
        <Route path="/inbound" element={<InboundListPage />} />
        <Route path="/outbound" element={<OutboundListPage />} />
        <Route path="/waste-inbound" element={<WasteInboundListPage />} />
        <Route path="/waste-outbound" element={<WasteOutboundListPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/aggregation" element={<AggregationPage />} />
        <Route path="/daily-report" element={<DailyReportPage />} />
        {/* 보고서 보관함은 출고보고 화면의 목록 보기로 합쳤다. */}
        <Route path="/reports" element={<Navigate to="/daily-report?view=list" replace />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/pnl" element={<PnlPage />} />
        <Route path="/waste" element={<WasteManagementPage />} />
        <Route path="/assets" element={<AssetManagementPage />} />
        <Route path="/projects" element={<ProjectManagementPage />} />
        <Route path="/maintenances" element={<Navigate to="/assets" replace />} />
        <Route path="/vehicles" element={<Navigate to="/assets" replace />} />
        <Route path="/employees" element={<EmployeeManagementPage />} />
        <Route path="/admin-alerts" element={<AdminAlertsPage />} />
        <Route path="/system" element={<SystemAdminPage />} />
        <Route path="/masters" element={<Navigate to="/system" replace />} />
        <Route path="/users" element={<Navigate to="/system?tab=users" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
