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
  vehicleNo?: string | null;
  grossWeight: string;
  tareWeight: string;
  netWeight: string;
}

export interface OutboundSale {
  id: string;
  projectId: string;
  itemCode: string;
  outboundDate: string;
  buyerId?: string | null;
  settledWeight: string;
}

export interface WasteOutbound {
  id: string;
  projectId: string;
  outboundDate: string;
  buyerId?: string | null;
  itemCode?: string | null;
  itemName?: string | null;
  weight: string;
  olbaroReported: boolean;
  handoverDate?: string | null;
  olbaroMemo?: string | null;
  project?: Project;
  buyer?: Vendor;
}

export interface Vehicle {
  id: string;
  vehicleNo: string;
  vehicleType?: string | null;
  inspectionExpiry?: string | null;
  currentSite?: string | null;
}

export interface Employee {
  id: string;
  name: string;
  position?: string | null;
  department?: string | null;
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

export type LedgerType = 'inbound' | 'sorting' | 'outbound_sale' | 'waste_outbound';

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

export interface LedgerEntry {
  id: string;
  direction: 'IN' | 'OUT';
  weight: string;
  ledgerDate: string;
  refType: string | null;
  refId: string | null;
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
