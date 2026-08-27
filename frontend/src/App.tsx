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
import { DmsPage } from './pages/DmsPage';
import { EntryPage } from './pages/EntryPage';
import { MobileWeighPage } from './pages/MobileWeighPage';
import { MobileAttendPage } from './pages/MobileAttendPage';
import { LedgerPage } from './pages/LedgerPage';
import { AggregationPage } from './pages/AggregationPage';
import { DailyReportPage } from './pages/DailyReportPage';
import { TransportCostPage } from './pages/TransportCostPage';
import { LaborPage } from './pages/LaborPage';
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
      {/* 현장에서 휴대폰으로 쓰는 화면 — 사이드바 없이 한 화면만 쓴다. */}
      {/* 현장에서 여는 첫 화면은 출퇴근이다. 계근 등록은 관리자만 들어간다. */}
      <Route path="/mobile" element={<MobileAttendPage />} />
      <Route
        path="/mobile/weigh"
        element={appUser.role === 'admin' ? <MobileWeighPage /> : <Navigate to="/mobile" replace />}
      />
      {/* 예전 주소로 저장해 둔 바로가기를 위해 남긴다. */}
      <Route path="/mobile/attend" element={<Navigate to="/mobile" replace />} />
      <Route element={<Layout />}>
        <Route path="/inbound" element={<InboundListPage />} />
        <Route path="/outbound" element={<OutboundListPage />} />
        <Route path="/waste-inbound" element={<WasteInboundListPage />} />
        <Route path="/waste-outbound" element={<WasteOutboundListPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/aggregation" element={<AggregationPage />} />
        <Route path="/daily-report" element={<DailyReportPage />} />
        {/* 보고서 보관함(보기)과 일일 출고보고(발행)는 같은 화면을 쓰고 경로로 갈린다. */}
        <Route path="/reports" element={<DailyReportPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/transports" element={<TransportCostPage />} />
        <Route path="/labors" element={<LaborPage />} />
        <Route path="/pnl" element={<PnlPage />} />
        <Route path="/waste" element={<WasteManagementPage />} />
        <Route path="/assets" element={<AssetManagementPage />} />
        <Route path="/projects" element={<ProjectManagementPage />} />
        <Route path="/maintenances" element={<Navigate to="/assets" replace />} />
        <Route path="/vehicles" element={<Navigate to="/assets" replace />} />
        <Route path="/employees" element={<EmployeeManagementPage />} />
        <Route path="/admin-alerts" element={<AdminAlertsPage />} />
        <Route path="/dms" element={<DmsPage />} />
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
