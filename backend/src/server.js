import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import projectRoutes from './routes/project.routes.js';
import inboundRoutes from './routes/inbound.routes.js';
import outboundRoutes from './routes/outbound.routes.js';
import sortingRoutes from './routes/sorting.routes.js';
import wasteInboundRoutes from './routes/wasteInbound.routes.js';
import wasteOutboundRoutes from './routes/wasteOutbound.routes.js';
import vendorRoutes from './routes/vendor.routes.js';
import itemMasterRoutes from './routes/itemMaster.routes.js';
import attachmentRoutes from './routes/attachment.routes.js';
import ledgerRoutes from './routes/ledger.routes.js';
import reportRoutes from './routes/report.routes.js';
import dmsRoutes from './routes/dms.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import transportRoutes from './routes/transport.routes.js';
import laborRoutes from './routes/labor.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import pnlRoutes from './routes/pnl.routes.js';
import vehicleRoutes from './routes/vehicle.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import externalDriverRoutes from './routes/externalDriver.routes.js';
import commonCodeRoutes from './routes/commonCode.routes.js';
import assetRoutes from './routes/asset.routes.js';
import assetMaintenanceRoutes from './routes/assetMaintenance.routes.js';
import alertRoutes from './routes/alert.routes.js';
import listExportRoutes from './routes/listExport.routes.js';
import ocrRoutes from './routes/ocr.routes.js';
import authRoutes from './routes/auth.routes.js';
import { requireAuth } from './middleware/auth.js';
import { auditMutations } from './middleware/audit.js';
import auditRoutes from './routes/audit.routes.js';

const app = express();
// Cloud Run 프록시 뒤라 실제 접속 IP는 X-Forwarded-For에서 읽는다.
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', ci: 'github-actions' });
});

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);
// 등록·수정·삭제는 누가 했는지 남긴다.
app.use('/api', auditMutations);

app.use('/api/projects', projectRoutes);
app.use('/api/inbounds', inboundRoutes);
app.use('/api/outbounds', outboundRoutes);
app.use('/api/sortings', sortingRoutes);
app.use('/api/waste-inbounds', wasteInboundRoutes);
app.use('/api/waste-outbounds', wasteOutboundRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/item-masters', itemMasterRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dms', dmsRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/transports', transportRoutes);
app.use('/api/labors', laborRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/projects', pnlRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/external-drivers', externalDriverRoutes);
app.use('/api/common-codes', commonCodeRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/asset-maintenances', assetMaintenanceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/list-exports', listExportRoutes);
app.use('/api/ocr', ocrRoutes);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`wbmanager API listening on port ${port}`);
});
