import ExcelJS from 'exceljs';
import { prisma } from './prisma.js';
import { attendDays } from './attendCode.js';

// 월 공수표를 A4 한 장에 담는다.
//
// 한 달 31일을 가로로 늘어놓으면 세로 A4로는 어림도 없다. 가로로 눕히고
// 축소 인쇄(fitToPage 1×1)를 켜서 날짜가 몇 개든 한 장에 들어가게 한다.
// 화면과 같은 값을 같은 차례로 적는다 — 종이와 화면이 다르면 둘 다 못 믿는다.

const ATTEND_SHORT = { 출근: '출', 반차: '반', 특근: '특', 연차: '연', 병가: '병', 결근: '결', 휴무: '휴' };
const THIN = { style: 'thin', color: { argb: 'FFBFBFBF' } };
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } };
const SUM_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

const num = (v) => (v == null || v === '' ? 0 : Number(v));
const daysInMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
const weekdayOf = (month, day) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, day).getDay();
};

export async function buildLaborWorkbook(month, projectId) {
  const [rows, employees, settlement] = await Promise.all([
    prisma.labor.findMany({
      where: { settleMonth: month, ...(projectId ? { projectId } : {}) },
      orderBy: [{ workDate: 'asc' }],
    }),
    prisma.employee.findMany({ orderBy: { name: 'asc' } }),
    prisma.laborSettlement.findUnique({ where: { month } }),
  ]);

  const days = daysInMonth(month);
  const order = ['정규직', '현장직', '계약직', '일용직', '프리랜서', '타사직원', '아르바이트'];
  const rank = (t) => {
    const i = order.indexOf(t ?? '');
    return i < 0 ? order.length : i;
  };

  // 사람을 모은다 — 임직원에 이어진 줄은 그 사람으로, 아닌 줄은 이름으로 묶는다.
  const people = new Map();
  const take = (key, name, type) => {
    if (!people.has(key)) {
      people.set(key, { name, type, cells: new Map(), presentDays: 0, manDays: 0, labor: 0, meal: 0, etc: 0 });
    }
    return people.get(key);
  };
  for (const e of employees) take(e.id, e.name, e.employmentType ?? '정규직');
  for (const r of rows) {
    const key = r.employeeId ?? `name:${r.workerName ?? '이름 없음'}`;
    const p = take(key, r.workerName ?? '이름 없음', r.workerType ?? '-');
    const day = Number(String(r.workDate.toISOString()).slice(8, 10));
    p.cells.set(day, r.attendCode ? (ATTEND_SHORT[r.attendCode] ?? r.attendCode.slice(0, 1)) : num(r.totalManDays) || '');
    p.presentDays += attendDays(r.attendCode);
    p.manDays += num(r.totalManDays);
    p.labor += num(r.laborCost);
    p.meal += num(r.mealCost);
    p.etc += num(r.toolCost) + num(r.fuelCost) + num(r.suppliesCost);
  }
  const list = [...people.values()].sort((a, b) => rank(a.type) - rank(b.type) || a.name.localeCompare(b.name));

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`${month} 공수표`, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  ws.columns = [
    { width: 12 },
    { width: 9 },
    ...Array.from({ length: days }, () => ({ width: 3.2 })),
    { width: 7 },
    { width: 7 },
    { width: 11 },
    { width: 9 },
    { width: 9 },
  ];
  const lastCol = 2 + days + 5;

  const title = ws.addRow([`${month} 공수표${settlement?.status === 'closed' ? ' (마감)' : ''}`]);
  ws.mergeCells(1, 1, 1, lastCol);
  title.getCell(1).font = { bold: true, size: 14 };
  title.getCell(1).alignment = { horizontal: 'center' };
  ws.addRow([]);

  // 머리 두 줄 — 날짜와 요일.
  const h1 = ws.addRow(['이름', '구분', ...Array.from({ length: days }, (_, i) => i + 1), '출근', '공수', '인건비', '식대', '기타']);
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const h2 = ws.addRow(['', '', ...Array.from({ length: days }, (_, i) => WEEK[weekdayOf(month, i + 1)]), '', '', '', '', '']);
  for (const [c, label] of [[1, '이름'], [2, '구분']]) {
    ws.mergeCells(h1.number, c, h2.number, c);
    h1.getCell(c).value = label;
  }
  for (let c = 3 + days; c <= lastCol; c++) {
    ws.mergeCells(h1.number, c, h2.number, c);
  }
  for (const row of [h1, h2]) {
    row.height = 14;
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = HEAD_FILL;
      cell.border = BORDER;
    }
  }

  const totals = { presentDays: 0, manDays: 0, labor: 0, meal: 0, etc: 0 };
  for (const p of list) {
    const row = ws.addRow([
      p.name,
      p.type,
      ...Array.from({ length: days }, (_, i) => p.cells.get(i + 1) ?? ''),
      p.presentDays || '',
      p.manDays || '',
      p.labor || '',
      p.meal || '',
      p.etc || '',
    ]);
    row.height = 13;
    for (let c = 1; c <= lastCol; c++) {
      const cell = row.getCell(c);
      cell.font = { size: 9 };
      cell.border = BORDER;
      cell.alignment = { horizontal: c <= 2 ? 'left' : c <= 2 + days ? 'center' : 'right', vertical: 'middle' };
      if (c > 2 + days) {
        cell.fill = SUM_FILL;
        if (c > 4 + days) cell.numFmt = '#,##0';
      }
      // 주말 칸은 옅게 깔아 눈으로 주를 끊는다.
      if (c > 2 && c <= 2 + days) {
        const w = weekdayOf(month, c - 2);
        if (w === 0 || w === 6) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F7' } };
      }
    }
    totals.presentDays += p.presentDays;
    totals.manDays += p.manDays;
    totals.labor += p.labor;
    totals.meal += p.meal;
    totals.etc += p.etc;
  }

  const foot = ws.addRow([
    '합계',
    '',
    ...Array.from({ length: days }, () => ''),
    totals.presentDays || '',
    totals.manDays || '',
    totals.labor || '',
    totals.meal || '',
    totals.etc || '',
  ]);
  foot.height = 15;
  for (let c = 1; c <= lastCol; c++) {
    const cell = foot.getCell(c);
    cell.font = { bold: true, size: 9 };
    cell.border = BORDER;
    cell.fill = SUM_FILL;
    cell.alignment = { horizontal: c <= 2 ? 'left' : c <= 2 + days ? 'center' : 'right', vertical: 'middle' };
    if (c > 4 + days) cell.numFmt = '#,##0';
  }

  // 인쇄해도 이름과 머리줄은 늘 보이게 한다.
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: h2.number }];
  ws.pageSetup.printTitlesRow = `${h1.number}:${h2.number}`;

  return { wb, fileName: `${month}_공수표.xlsx` };
}
