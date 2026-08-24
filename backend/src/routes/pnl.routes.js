import { Router } from 'express';
import { getProjectPnl } from '../lib/pnl.js';

const router = Router();

// 차수(프로젝트) 손익 대시보드: 실현손익 + 재고평가(미실현) = 예상 최종손익 (F-YNTYEL)
router.get('/:projectId/pnl', async (req, res) => {
  const pnl = await getProjectPnl(req.params.projectId);
  if (!pnl) return res.status(404).json({ error: 'project not found' });
  res.json(pnl);
});

// 대표이사 손익보고 초안 텍스트 출력 (S-QQWGKS)
router.get('/:projectId/pnl/export', async (req, res) => {
  const pnl = await getProjectPnl(req.params.projectId);
  if (!pnl) return res.status(404).json({ error: 'project not found' });

  const fmt = (n) => Number(n).toLocaleString();
  const lines = [
    `[${pnl.roundName} 손익현황 보고]`,
    '',
    `1. 실현손익 = 매각수입(${fmt(pnl.salesRevenue)}) - 총지출(${fmt(pnl.totalCost)}) = ${fmt(pnl.realizedPnl)}`,
    `   - 매입비: ${fmt(pnl.purchaseCost)}`,
    `   - 폐기물비용: ${fmt(pnl.wasteCost)}`,
    `   - 운반비: ${fmt(pnl.transportCost)}`,
    `   - 인건비: ${fmt(pnl.laborCost)}`,
    '',
    `2. 재고평가(미실현) = ${fmt(pnl.inventoryValuation)}`,
    '',
    `3. 예상 최종손익 = 실현손익 + 재고평가 = ${fmt(pnl.expectedFinalPnl)}`,
  ];

  const encodedName = encodeURIComponent(`pnl_report_${pnl.roundName}.txt`);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="pnl_report.txt"; filename*=UTF-8''${encodedName}`);
  res.send(lines.join('\n'));
});

export default router;
