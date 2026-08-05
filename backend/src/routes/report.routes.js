import { Router } from 'express';
import { queryLedger } from '../lib/ledgerQuery.js';
import { buildAggregation } from '../lib/aggregation.js';
import { prisma } from '../lib/prisma.js';
import { getProjectPnl } from '../lib/pnl.js';
import { buildPnlReport, buildDailyReport } from '../lib/reportBuilder.js';
import { toISO } from '../lib/date.js';

const router = Router();

// 갑지 자동 집계 — 기간/프로젝트/거래처/품목 기준 소계 (F-SDUKJY, S-TCUYZO)
router.get('/aggregation', async (req, res) => {
  const rows = await queryLedger(req.query);
  res.json(buildAggregation(rows));
});

const TYPE_LABEL = {
  inbound: '입고',
  waste_inbound: '폐기물입고',
  sorting: '선별',
  outbound_sale: '매각',
  waste_outbound: '폐기물반출',
};

// 일일 출고보고 — 특정 일자의 매각/폐기물반출 내역 + 합계 (F-KLJXKW)
router.get('/daily', async (req, res) => {
  const { date, projectId } = req.query;
  if (!date) return res.status(400).json({ error: 'date는 필수입니다.' });

  const rows = await queryLedger({ from: date, to: date, projectId });
  const outboundRows = rows.filter((r) => r.type === 'outbound_sale' || r.type === 'waste_outbound');

  const totalWeight = outboundRows.reduce((sum, r) => sum + Number(r.weight ?? 0), 0);
  const totalAmount = outboundRows.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

  res.json({ date, rows: outboundRows, totalWeight, totalAmount, count: outboundRows.length });
});

// 일일 출고보고 카톡 공유용 텍스트/CSV 내보내기 (S-LPSDYR)
router.get('/daily/export', async (req, res) => {
  const { date, projectId, format } = req.query;
  if (!date) return res.status(400).json({ error: 'date는 필수입니다.' });

  const rows = await queryLedger({ from: date, to: date, projectId });
  const outboundRows = rows.filter((r) => r.type === 'outbound_sale' || r.type === 'waste_outbound');
  const totalWeight = outboundRows.reduce((sum, r) => sum + Number(r.weight ?? 0), 0);

  if (format === 'text') {
    const lines = [`[${date} 출고현황 보고]`, ''];
    outboundRows.forEach((r, i) => {
      lines.push(
        `${i + 1}. ${r.projectName ?? '-'} / ${TYPE_LABEL[r.type]} / ${r.vendorName ?? '-'} / ${r.itemName ?? '-'} / ${r.weight}kg`,
      );
    });
    lines.push('', `총 ${outboundRows.length}건, 합계 ${totalWeight}kg`);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="daily_report_${date}.txt"`);
    res.send(lines.join('\n'));
    return;
  }

  const escapeCsv = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = ['일자', '구분', '프로젝트', '거래처', '품목', '중량(kg)', '금액'];
  const lines = [header.map(escapeCsv).join(',')];
  outboundRows.forEach((r) => {
    lines.push(
      [date, TYPE_LABEL[r.type], r.projectName, r.vendorName, r.itemName, r.weight, r.amount].map(escapeCsv).join(','),
    );
  });
  lines.push(['', '', '', '', '합계', totalWeight, ''].map(escapeCsv).join(','));

  const csv = '﻿' + lines.join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="daily_report_${date}.csv"`);
  res.send(csv);
});

// ── 보고서 발행·보관 ──────────────────────────────────────────
// 화면에서 매번 텍스트를 뽑던 것을 발행 시점 그대로 저장해 목록에서 다시 열람·전달한다.
router.post('/publish', async (req, res) => {
  const { reportType, projectId, date } = req.body;
  if (!reportType) return res.status(400).json({ error: 'reportType은 필수입니다.' });

  if (reportType === 'pnl') {
    if (!projectId) return res.status(400).json({ error: '손익보고는 projectId가 필요합니다.' });
    const pnl = await getProjectPnl(projectId);
    if (!pnl) return res.status(404).json({ error: 'project not found' });

    const reportDate = date ?? new Date().toISOString().slice(0, 10);
    const built = buildPnlReport(pnl, { reportDate });
    const saved = await prisma.report.create({
      data: {
        reportType,
        projectId,
        reportDate: toISO(reportDate),
        title: built.title,
        content: built.content,
        summary: built.summary,
      },
      include: { project: true },
    });
    return res.status(201).json(saved);
  }

  if (reportType === 'daily') {
    if (!date) return res.status(400).json({ error: '일일보고는 date가 필요합니다.' });

    const rows = await queryLedger({ from: date, to: date, projectId });
    const outboundRows = rows.filter((r) => r.type === 'outbound_sale' || r.type === 'waste_outbound');

    // 그날 출고가 있었는지와 무관하게 진행 중인 프로젝트를 모두 싣는다.
    const projects = await prisma.project.findMany({
      where: { ...(projectId ? { id: projectId } : { status: '진행' }) },
      orderBy: { roundName: 'asc' },
    });
    // 종료된 차수라도 그날 출고가 있으면 빠뜨리지 않는다.
    const extraIds = [...new Set(outboundRows.map((r) => r.projectId))].filter(
      (id) => id && !projects.some((p) => p.id === id),
    );
    const extras = extraIds.length
      ? await prisma.project.findMany({ where: { id: { in: extraIds } } })
      : [];

    const groups = [...projects, ...extras].map((p) => ({
      projectId: p.id,
      projectName: p.roundName,
      siteName: p.siteName ?? null,
      rows: outboundRows.filter((r) => r.projectId === p.id),
    }));

    const built = buildDailyReport({ date, groups });
    const saved = await prisma.report.create({
      data: {
        reportType,
        projectId: projectId || null,
        reportDate: toISO(date),
        title: built.title,
        content: built.content,
        summary: built.summary,
      },
      include: { project: true },
    });
    return res.status(201).json(saved);
  }

  return res.status(400).json({ error: 'reportType은 daily 또는 pnl이어야 합니다.' });
});

router.get('/published', async (req, res) => {
  const { reportType, projectId, from, to } = req.query;
  const range = {};
  if (from) range.gte = new Date(from);
  if (to) range.lte = new Date(to);

  const reports = await prisma.report.findMany({
    where: {
      ...(reportType ? { reportType } : {}),
      ...(projectId ? { projectId } : {}),
      ...(Object.keys(range).length ? { reportDate: range } : {}),
    },
    include: { project: true },
    orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(reports);
});

router.get('/published/:id', async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id }, include: { project: true } });
  if (!report) return res.status(404).json({ error: 'not found' });
  res.json(report);
});

router.get('/published/:id/export', async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ error: 'not found' });

  const encodedName = encodeURIComponent(`${report.title}.txt`);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="report.txt"; filename*=UTF-8''${encodedName}`);
  res.send(report.content);
});

router.delete('/published/:id', async (req, res) => {
  const deleted = await prisma.report.delete({ where: { id: req.params.id } });
  res.json(deleted);
});

export default router;
