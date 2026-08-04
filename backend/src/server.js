import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import projectRoutes from './routes/project.routes.js';
import inboundRoutes from './routes/inbound.routes.js';
import outboundRoutes from './routes/outbound.routes.js';
import sortingRoutes from './routes/sorting.routes.js';
import wasteOutboundRoutes from './routes/wasteOutbound.routes.js';
import vendorRoutes from './routes/vendor.routes.js';
import itemMasterRoutes from './routes/itemMaster.routes.js';
import attachmentRoutes from './routes/attachment.routes.js';
import ledgerRoutes from './routes/ledger.routes.js';
import reportRoutes from './routes/report.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import transportRoutes from './routes/transport.routes.js';
import laborRoutes from './routes/labor.routes.js';
import pnlRoutes from './routes/pnl.routes.js';
import vehicleRoutes from './routes/vehicle.routes.js';
import employeeRoutes from './routes/employee.routes.js';
import alertRoutes from './routes/alert.routes.js';
import authRoutes from './routes/auth.routes.js';
import { requireAuth } from './middleware/auth.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);

app.use('/api/projects', projectRoutes);
app.use('/api/inbounds', inboundRoutes);
app.use('/api/outbounds', outboundRoutes);
app.use('/api/sortings', sortingRoutes);
app.use('/api/waste-outbounds', wasteOutboundRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/item-masters', itemMasterRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/transports', transportRoutes);
app.use('/api/labors', laborRoutes);
app.use('/api/projects', pnlRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/alerts', alertRoutes);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`wbmanager API listening on port ${port}`);
});
