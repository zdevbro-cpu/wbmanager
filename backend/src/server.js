import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import projectRoutes from './routes/project.routes.js';
import inboundRoutes from './routes/inbound.routes.js';
import outboundRoutes from './routes/outbound.routes.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/projects', projectRoutes);
app.use('/api/inbounds', inboundRoutes);
app.use('/api/outbounds', outboundRoutes);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`wbmanager API listening on port ${port}`);
});
