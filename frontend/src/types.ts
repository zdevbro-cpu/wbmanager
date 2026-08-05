export interface Vendor {
  id: string;
  name: string;
  vendorType?: string | null;
  isTemporary: boolean;
}

export interface ItemMaster {
  id: string;
  itemCode: string;
  category: string;
  subCategory?: string | null;
  itemName: string;
  basePrice?: string | null;
  isTemporary: boolean;
}

export interface Project {
  id: string;
  roundName: string;
  buyerId?: string | null;
  status: string;
}

export interface Inbound {
  id: string;
  projectId: string;
  inboundDate: string;
  unloadingPoint?: string | null;
  vehicleType?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  grossWeight: string;
  tareWeight: string;
  lossWeight?: string | null;
  netWeight: string;
  stockWeight?: string | null;
  memo?: string | null;
  project?: Project;
  item?: ItemMaster;
  attachments?: Attachment[];
}

export interface WasteInbound {
  id: string;
  projectId: string;
  receiveDate: string;
  handoverDate?: string | null;
  olbaroReported: boolean;
  dischargerName?: string | null;
  unloadingPoint?: string | null;
  vehicleType?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  grossWeight: string;
  tareWeight: string;
  lossWeight?: string | null;
  netWeight: string;
  memo?: string | null;
  project?: Project;
  item?: ItemMaster;
  attachments?: Attachment[];
}

export interface OutboundSale {
  id: string;
  projectId: string;
  itemCode: string;
  outboundDate: string;
  buyerId?: string | null;
  loadingPoint?: string | null;
  vehicleType?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  unitPrice?: string | null;
  grossWeight?: string | null;
  tareWeight?: string | null;
  actualWeight?: string | null;
  preLossWeight?: string | null;
  lossWeight?: string | null;
  settledWeight: string;
  stockWeight?: string | null;
  amount?: string | null;
  vatAmount?: string | null;
  category?: string | null;
  isSubsidiary?: boolean;
  memo?: string | null;
  paidDate?: string | null;
  project?: Project;
  item?: ItemMaster;
  buyer?: Vendor;
  attachments?: Attachment[];
}

export interface WasteOutbound {
  id: string;
  projectId: string;
  outboundDate: string;
  buyerId?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  dischargerName?: string | null;
  transporterName?: string | null;
  loadingPoint?: string | null;
  vehicleType?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  grossWeight?: string | null;
  tareWeight?: string | null;
  actualWeight?: string | null;
  preLossWeight?: string | null;
  lossWeight?: string | null;
  weight: string;
  unitPrice?: string | null;
  cubicMeter?: string | null;
  amount?: string | null;
  category?: string | null;
  memo?: string | null;
  isSubsidiary?: boolean;
  transferDate?: string | null;
  olbaroReported: boolean;
  handoverDate?: string | null;
  olbaroMemo?: string | null;
  project?: Project;
  buyer?: Vendor;
  attachments?: Attachment[];
}

export interface Vehicle {
  id: string;
  vehicleNo: string;
  vehicleType?: string | null;
  inspectionExpiry?: string | null;
  currentSite?: string | null;
}

export interface CommonCode {
  id: string;
  group: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface EmployeeCertification {
  id: string;
  employeeId: string;
  certName: string;
  acquiredDate?: string | null;
  expiryDate?: string | null;
}

export interface EmployeeTraining {
  id: string;
  employeeId: string;
  trainingName: string;
  trainingDate?: string | null;
}

export interface Employee {
  id: string;
  name: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  hireDate?: string | null;
  certifications?: EmployeeCertification[];
  trainings?: EmployeeTraining[];
}

export interface VehicleMaintenance {
  id: string;
  vehicleId: string;
  maintenanceDate: string;
  description?: string | null;
  cost?: string | null;
  attachments?: Attachment[];
}

export interface ExpiringItem {
  type: 'vehicle_inspection' | 'certification';
  targetId: string;
  targetName: string;
  expiryDate: string;
  daysLeft: number;
  status: 'overdue' | 'imminent';
}

export interface ExpiringAlerts {
  threshold: number;
  overdue: ExpiringItem[];
  imminent: ExpiringItem[];
}

export type LedgerType = 'inbound' | 'waste_inbound' | 'sorting' | 'outbound_sale' | 'waste_outbound';

export interface LedgerRow {
  type: LedgerType;
  id: string;
  date: string;
  projectId: string;
  projectName: string | null;
  vendorId: string | null;
  vendorName: string | null;
  itemCode: string | null;
  itemName: string | null;
  weight: string;
  amount: string | null;
  attachmentCount: number;
}

export interface Attachment {
  id: string;
  driveFileId: string;
  fileName?: string | null;
  fileType?: string | null;
  webViewLink?: string | null;
  uploadedAt: string;
}

export interface LedgerDetail {
  id: string;
  attachments?: Attachment[];
  project?: Project;
  item?: ItemMaster;
  buyer?: Vendor;
  [key: string]: unknown;
}

export interface AggregationGroup {
  key: string;
  label: string;
  inbound: number;
  waste_inbound: number;
  sorting: number;
  outbound_sale: number;
  waste_outbound: number;
  amount: number;
  count: number;
}

export interface Aggregation {
  byProject: AggregationGroup[];
  byVendor: AggregationGroup[];
  byItem: AggregationGroup[];
  totals: Omit<AggregationGroup, 'key' | 'label' | 'count'>;
}

export interface DailyReport {
  date: string;
  rows: LedgerRow[];
  totalWeight: number;
  totalAmount: number;
  count: number;
}

export interface InventorySnapshotRow {
  projectId: string;
  projectName: string | null;
  itemCode: string;
  itemName: string | null;
  inWeight: number;
  outWeight: number;
  remaining: number;
}

export interface InventoryValuationRow extends InventorySnapshotRow {
  unitPrice: number;
  priceSource: 'project' | 'global' | 'base';
  valuationAmount: number;
}

export interface InventoryValuation {
  rows: InventoryValuationRow[];
  totalValuation: number;
}

export interface LedgerEntryDetail {
  place?: string | null;         // 입고=하차지, 출고=상차지
  counterparty?: string | null;  // 거래처 / 배출자 / 선별 상대품목
  vehicleType?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  grossWeight?: string | null;
  tareWeight?: string | null;
  lossWeight?: string | null;
  memo?: string | null;
}

export interface LedgerEntry {
  id: string;
  direction: 'IN' | 'OUT';
  weight: string;
  ledgerDate: string;
  refType: string | null;
  refId: string | null;
  detail?: LedgerEntryDetail | null;
}

export interface ProjectPnl {
  projectId: string;
  roundName: string;
  purchaseCost: number;
  salesRevenue: number;
  wasteCost: number;
  transportCost: number;
  laborCost: number;
  totalCost: number;
  realizedPnl: number;
  inventoryValuation: number;
  expectedFinalPnl: number;
  inventoryDetail: InventoryValuationRow[];
}
