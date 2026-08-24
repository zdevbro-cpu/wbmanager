export interface Vendor {
  id: string;
  name: string;
  vendorType?: string | null;
  isTemporary: boolean;
  // 세금계산서 발행 정보
  bizRegNo?: string | null;
  corpRegNo?: string | null;
  ceoName?: string | null;
  bizType?: string | null;
  bizItem?: string | null;
  address?: string | null;
  phone?: string | null;
  fax?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  memo?: string | null;
}

export interface ItemMaster {
  memo?: string | null;
  id: string;
  itemCode: string;
  category: string;
  subCategory?: string | null;
  itemName: string;
  basePrice?: string | null;
  isTemporary: boolean;
  // 식별·분류
  aliasNames?: string | null;
  minorCategory?: string | null;
  material?: string | null;
  grade?: string | null;
  // 단위·수량
  baseUnit?: string | null;
  weighUnit?: string | null;
  purchaseUnit?: string | null;
  salesUnit?: string | null;
  unitFactor?: string | null;
  qtyManaged?: boolean;
  // 스크랩 업종 특수
  usageType?: string | null;
  convertToItemCode?: string | null;
  expectedYield?: string | null;
  deductImpurity?: string | null;
  deductSoil?: string | null;
  deductMoisture?: string | null;
  zoneCode?: string | null;
  priceLinked?: boolean;
  priceRefCode?: string | null;
  // 세무·회계
  taxType?: string | null;
  recycleDeductible?: boolean;
  ecountItemCode?: string | null;
  accountCode?: string | null;
  // 상태
  isActive?: boolean;
  createdBy?: string | null;
}

export interface Project {
  id: string;
  projectCode?: string | null;
  roundName: string;
  roundNo?: string | null;
  ordererId?: string | null;
  orderer?: Vendor;
  contractorId?: string | null;
  contractor?: Vendor;
  siteName?: string | null;
  region?: string | null;
  buyerId?: string | null;
  buyer?: Vendor;
  contractAmount?: string | null;
  purchasePrice?: string | null;
  contractWeight?: string | null;
  vatIncluded?: boolean;
  deposit?: string | null;
  advancePayment?: string | null;
  settlementCycle?: string | null;
  managerEmpId?: string | null;
  manager?: Employee;
  dischargerName?: string | null;
  memo?: string | null;
  startDate?: string | null;
  endDate?: string | null;
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
  // 정산 항목 — 폐기물 반출과 같은 구성
  transporterName?: string | null;
  processorName?: string | null;
  actualWeight?: string | null;
  settledWeight?: string | null;
  cubicMeter?: string | null;
  unitPrice?: string | null;
  amount?: string | null;
  transferDate?: string | null;
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
  transportCost?: string | null;
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
  item?: ItemMaster;
  attachments?: Attachment[];
}

export interface ExternalDriver {
  id: string;
  name: string;
  phone?: string | null;
  memo?: string | null;
}

export interface Vehicle {
  id: string;
  vehicleNo: string;
  vehicleType?: string | null;
  inspectionExpiry?: string | null;
  currentSite?: string | null;
}

export interface AssetVehicleDetail {
  assetId: string;
  plateNo?: string | null;
  vin?: string | null;
  vehicleType?: string | null;
  fuelType?: string | null;
  yearModel?: string | null;
  loadCapacity?: string | null;
  currentMileage?: number | null;
  insuranceCompany?: string | null;
  insuranceEnd?: string | null;
  inspectionNext?: string | null;
  leaseCompany?: string | null;
  leaseEnd?: string | null;
}

export interface AssetEquipmentDetail {
  assetId: string;
  spec?: string | null;
  powerType?: string | null;
  requiresLicense?: boolean;
  licenseType?: string | null;
  isLegalInspection?: boolean;
  inspectionCycleMonth?: number | null;
  inspectionNext?: string | null;
  calibrationNext?: string | null;
  warrantyEnd?: string | null;
  quantity?: number | null;
}

export interface AssetSchedule {
  id: string;
  assetId: string;
  scheduleType: string;
  dueDate: string;
  alertDaysBefore: number;
  status: string;
  completedAt?: string | null;
  memo?: string | null;
}

export interface AssetMaintenance {
  id: string;
  assetId: string;
  maintType: string;
  vendorId?: string | null;
  vendor?: Vendor;
  requestedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  mileageAt?: number | null;
  hoursAt?: number | null;
  symptom?: string | null;
  action?: string | null;
  parts?: string | null;
  cost?: string | null;
  nextDueDate?: string | null;
  nextDueMileage?: number | null;
  status: string;
  asset?: Asset;
  attachments?: Attachment[];
}

export interface AssetMovement {
  id: string;
  assetId: string;
  moveDate: string;
  fromSite?: string | null;
  toSite?: string | null;
  memo?: string | null;
}

export interface Asset {
  id: string;
  assetNo: string;
  assetType: 'VEHICLE' | 'EQUIPMENT';
  category?: string | null;
  name: string;
  modelName?: string | null;
  manufacturer?: string | null;
  serialNo?: string | null;
  ownerDept?: string | null;
  managerEmpId?: string | null;
  manager?: Employee;
  location?: string | null;
  ownershipType?: string | null;
  /** 회사가 보유·관리하는 자산인지. 운송만 맡는 외부 차량은 false다. */
  isCompanyAsset?: boolean;
  createdAt?: string;
  acquiredAt?: string | null;
  acquireCost?: string | null;
  usefulLifeMonth?: number | null;
  status: string;
  disposedAt?: string | null;
  disposeReason?: string | null;
  memo?: string | null;
  vehicle?: AssetVehicleDetail | null;
  equipment?: AssetEquipmentDetail | null;
  schedules?: AssetSchedule[];
  maintenances?: AssetMaintenance[];
  movements?: AssetMovement[];
  attachments?: Attachment[];
}

export interface AuditLog {
  id: string;
  appUserId?: string | null;
  appUser?: { name?: string | null; email: string; role: string } | null;
  email?: string | null;
  action: string;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  summary?: string | null;
  createdAt: string;
}

export interface AuditIpSummary {
  ip: string;
  count: number;
  firstAt: string;
  lastAt: string;
  users: string[];
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
  certType?: string | null; // 국가기술자격 / 면허 / 교육이수증 / 기타
  acquiredDate?: string | null;
  expiryDate?: string | null;
}

export interface EmployeeTraining {
  id: string;
  employeeId: string;
  trainingName: string;
  trainingType?: string | null; // 의무 / 보수
  trainingDate?: string | null; // 이수일
  cycleMonths?: number | null; // 교육 주기(개월) — 이수일 + 주기 = 다음 예정일
  nextDueDate?: string | null; // 다음 교육 예정일
}

export interface Employee {
  employmentType?: string | null;
  id: string;
  empCode?: string | null; // 자동 채번 사번 — 근태 QR 식별자
  name: string;
  phone?: string | null;
  position?: string | null;
  companyName?: string | null;
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
  type: 'vehicle_inspection' | 'certification' | 'training' | 'asset_schedule';
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
  saleAmount?: number;
  wasteAmount?: number;
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
  bySite: AggregationGroup[];
  byVendor: AggregationGroup[];
  byItem: AggregationGroup[];
  byType: AggregationGroup[];
  byMonth: AggregationGroup[];
  byDay: AggregationGroup[];
  totals: Omit<AggregationGroup, 'key' | 'label' | 'count'>;
}

export interface SavedReport {
  id: string;
  reportType: 'daily' | 'pnl';
  projectId?: string | null;
  project?: Project;
  reportDate: string;
  title: string;
  content: string;
  summary?: Record<string, number> | null;
  createdAt: string;
}

export interface DiaryDay {
  date: string;
  weekday: number;
  count: number;
  totalWeight: number;
  totalAmount: number;
  saleCount: number;
  saleWeight: number;
  wasteCount: number;
  wasteWeight: number;
  byProject: { projectName: string; count: number; weight: number; amount: number }[];
  reports: { id: string; title: string; reportType: string; projectName: string | null; createdAt: string }[];
}

export interface DiaryResponse {
  month: string;
  days: DiaryDay[];
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

export interface PnlSalesItem {
  itemCode: string;
  itemName: string;
  category?: string | null;
  weight: number;
  amount: number;
  avgPrice: number;
  amountShare: number;
}

export interface ProjectPnl {
  projectId: string;
  roundName: string;
  roundNo?: string | null;
  contractWeight?: number | null;
  purchaseCost: number;
  salesRevenue: number;
  wasteCost: number;
  transportCost: number;
  laborCost: number;
  totalCost: number;
  realizedPnl: number;
  inventoryValuation: number;
  expectedFinalPnl: number;
  inboundWeight: number;
  soldWeight: number;
  wasteOutWeight: number;
  remainingWeight: number;
  recoveryRate: number;
  avgSalePrice: number;
  purchaseRecoveryGap: number;
  salesByItem: PnlSalesItem[];
  inventoryDetail: InventoryValuationRow[];
}
