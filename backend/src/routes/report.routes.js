import { Router } from 'express';
import { queryLedger } from '../lib/ledgerQuery.js';
import { buildAggregation } from '../lib/aggregation.js';
import { prisma } from '../lib/prisma.js';
import { getProjectPnl } from '../lib/pnl.js';
import { buildPnlReport, buildDailyReport } from '../lib/reportBuilder.js';
import { buildPnlXlsx, buildDailyXlsx } from '../lib/xlsxBuilder.js';
import { toISO } from '../lib/date.js';

const router = Router();

// from~to 사이의 날짜를 하루씩 늘어놓는다. 구간 보고서가 날짜별 블록을 만들 때 쓴다.
function eachDate(from, to) {
  const out = [];
  const cur = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  while (cur <= last) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

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
  const { reportType, projectId, date, from, to } = req.body;
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
        // 워드 문서를 언제든 같은 내용으로 다시 만들 수 있게 발행 시점 값을 남긴다.
        payload: { ...pnl, reportDate },
      },
      include: { project: true },
    });
    return res.status(201).json(saved);
  }

  if (reportType === 'daily') {
    // 하루만 낼 때는 date, 구간으로 낼 때는 from~to를 받는다.
    const start = from ?? date;
    const end = to ?? date ?? from;
    if (!start) return res.status(400).json({ error: '일일보고는 date 또는 from~to가 필요합니다.' });
    if (start > end) return res.status(400).json({ error: '시작일이 종료일보다 늦습니다.' });

    const buildDay = async (d) => {
      const rows = await queryLedger({ from: d, to: d, projectId });
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
      const extras = extraIds.length ? await prisma.project.findMany({ where: { id: { in: extraIds } } }) : [];

      return {
        date: d,
        groups: [...projects, ...extras].map((p) => ({
          projectId: p.id,
          projectName: p.roundName,
          siteName: p.siteName ?? null,
          rows: outboundRows.filter((r) => r.projectId === p.id),
        })),
      };
    };

    const days = [];
    for (const d of eachDate(start, end)) days.push(await buildDay(d));

    const isRange = start !== end;
    if (!isRange) {
      const built = buildDailyReport(days[0]);
      const saved = await prisma.report.create({
        data: {
          reportType,
          projectId: projectId || null,
          reportDate: toISO(start),
          title: built.title,
          content: built.content,
          summary: built.summary,
          payload: { date: start, groups: days[0].groups, summary: built.summary },
        },
        include: { project: true },
      });
      return res.status(201).json(saved);
    }

    // 구간 보고서 — 날짜별 보고서를 이어 붙이고, 엑셀은 날짜별 블록으로 찍는다.
    const parts = days.map((d) => buildDailyReport(d));
    const summary = parts.reduce(
      (acc, p) => ({
        count: acc.count + p.summary.count,
        totalWeight: acc.totalWeight + p.summary.totalWeight,
        totalAmount: acc.totalAmount + p.summary.totalAmount,
        projectCount: Math.max(acc.projectCount, p.summary.projectCount),
        activeProjectCount: Math.max(acc.activeProjectCount, p.summary.activeProjectCount),
        dayCount: acc.dayCount + (p.summary.count > 0 ? 1 : 0),
      }),
      { count: 0, totalWeight: 0, totalAmount: 0, projectCount: 0, activeProjectCount: 0, dayCount: 0 },
    );
    const title = `${start} ~ ${end} 출고보고`;
    const content = [
      `[${title}]`,
      '',
      `- 출고일 ${summary.dayCount}일 / 총 ${summary.count}건`,
      `- ${Math.round(summary.totalWeight).toLocaleString()}kg / ${Math.round(summary.totalAmount).toLocaleString()}원`,
      '',
      ...parts.map((p) => p.content),
    ].join('\n');

    const saved = await prisma.report.create({
      data: {
        reportType,
        projectId: projectId || null,
        reportDate: toISO(end),
        title,
        content,
        summary,
        payload: { from: start, to: end, days, summary },
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

// 엑셀 문서 — 대표이사 보고 양식으로 내려받는다. 표를 그대로 편집·재집계할 수 있다.
router.get('/published/:id/xlsx', async (req, res) => {
  const report = await prisma.report.findUnique({ where: { id: req.params.id } });
  if (!report) return res.status(404).json({ error: 'not found' });

  try {
    let payload = report.payload;
    // 양식 데이터 없이 발행된 예전 손익보고는 현재 데이터로 다시 계산해 문서를 만든다.
    if (!payload && report.reportType === 'pnl' && report.projectId) {
      const pnl = await getProjectPnl(report.projectId);
      payload = pnl ? { ...pnl, reportDate: report.reportDate.toISOString().slice(0, 10) } : null;
    }
    if (!payload) {
      return res.status(409).json({ error: '이 보고서는 양식 데이터 없이 발행되어 다시 발행해야 합니다.' });
    }

    const buffer = report.reportType === 'pnl' ? await buildPnlXlsx(payload) : await buildDailyXlsx(payload);

    const encodedName = encodeURIComponent(`${report.title}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="report.xlsx"; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', String(buffer.length));
    // Express의 본문 변환을 거치지 않도록 바이너리를 그대로 내보낸다.
    res.end(buffer);
  } catch (err) {
    console.error('[report] 엑셀 생성 실패:', err);
    res.status(500).json({ error: '엑셀 문서를 만들지 못했습니다. 보고서를 다시 발행해 주세요.' });
  }
});

// 다이어리 화면용 — 한 달치 일자별 출고 요약과 그날 발행된 보고서를 함께 준다.
router.get('/daily-diary', async (req, res) => {
  const { month, projectId } = req.query;
  if (!month) return res.status(400).json({ error: 'month는 필수입니다(YYYY-MM).' });

  const [y, m] = month.split('-').map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

  const [rows, reports] = await Promise.all([
    queryLedger({ from, to, projectId }),
    prisma.report.findMany({
      where: { reportType: 'daily', reportDate: { gte: new Date(from), lte: new Date(`${to}T23:59:59`) } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const outboundRows = rows.filter((r) => r.type === 'outbound_sale' || r.type === 'waste_outbound');

  const byDate = new Map();
  for (const r of outboundRows) {
    const key = new Date(r.date).toISOString().slice(0, 10);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(r);
  }

  const days = [];
  const last = new Date(to);
  for (const cur = new Date(from); cur <= last; cur.setDate(cur.getDate() + 1)) {
    const date = cur.toISOString().slice(0, 10);
    const dayRows = byDate.get(date) ?? [];
    const sum = (list, key) => list.reduce((acc, r) => acc + Number(r[key] ?? 0), 0);
    const sales = dayRows.filter((r) => r.type === 'outbound_sale');
    const wastes = dayRows.filter((r) => r.type === 'waste_outbound');

    const projectMap = new Map();
    for (const r of dayRows) {
      const key = r.projectName ?? '-';
      if (!projectMap.has(key)) projectMap.set(key, { projectName: key, count: 0, weight: 0, amount: 0 });
      const e = projectMap.get(key);
      e.count += 1;
      e.weight += Number(r.weight ?? 0);
      e.amount += Number(r.amount ?? 0);
    }

    days.push({
      date,
      weekday: cur.getDay(),
      count: dayRows.length,
      totalWeight: sum(dayRows, 'weight'),
      totalAmount: sum(dayRows, 'amount'),
      saleCount: sales.length,
      saleWeight: sum(sales, 'weight'),
      wasteCount: wastes.length,
      wasteWeight: sum(wastes, 'weight'),
      byProject: [...projectMap.values()].sort((a, b) => b.weight - a.weight),
      reports: reports
        .filter((rep) => rep.reportDate.toISOString().slice(0, 10) === date)
        .map((rep) => ({ id: rep.id, title: rep.title, createdAt: rep.createdAt })),
    });
  }

  res.json({ month, days });
});

router.delete('/published/:id', async (req, res) => {
  const deleted = await prisma.report.delete({ where: { id: req.params.id } });
  res.json(deleted);
});

export default router;
