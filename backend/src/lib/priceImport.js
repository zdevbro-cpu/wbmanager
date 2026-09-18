import ExcelJS from 'exceljs';
import { prisma } from './prisma.js';
import { dayOf } from './pricing.js';

// 엑셀 「단가관리」 이관 — 담당자가 올린 파일을 읽어, 옮길 결과를 먼저 보여 주고
// 확인을 받은 뒤에만 저장한다. 확인 없이 옮기지 않는다(이관 계획 5장).
//
// 시트 구조(기준 파일 단가관리_26.09.11.xlsx)
//   품목관리        4행 머리글, 5행부터: 업체 · 품목 · 비고 · 계열 · 대표품목
//   단가이력        1행 머리글, 2행부터: 날짜 · 업체 · 품목 · 단가 · 비고 · 구분 · 계열 · 관리상태 · 대표품목
//   공지단가입력    35행 머리글, 36행부터 공지 누적기록: 공지일 · 업체 · 계열 · 적용범위 · 조정금액 · 공지내용
//                   23행 머리글, 24행부터 LME 누적기록(Q~X): 기준일 · LME · 환율 · 기준금액 · A동 · 상동 · 중동 · 비고

const text = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString();
    if ('result' in v) return String(v.result ?? '');
    if ('text' in v) return String(v.text ?? '');
    if ('richText' in v) return v.richText.map((t) => t.text).join('');
  }
  return String(v).trim();
};

const numOf = (v) => {
  const t = text(v).replace(/[,\s원]/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const dateOf = (v) => {
  if (v == null || v === '') return null;
  const raw = v instanceof Date ? v : typeof v === 'object' && v.result instanceof Date ? v.result : new Date(text(v));
  return Number.isNaN(raw.getTime()) ? null : dayOf(raw);
};

// 엑셀을 읽어 네 덩이로 나눈다. 아직 아무것도 저장하지 않는다.
export async function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const need = ['품목관리', '단가이력'];
  for (const name of need) {
    if (!wb.getWorksheet(name)) {
      throw Object.assign(new Error(`엑셀에 「${name}」 시트가 없습니다. 단가관리 원본 파일인지 확인해 주세요.`), {
        status: 400,
      });
    }
  }

  const itemSheet = wb.getWorksheet('품목관리');
  const items = [];
  itemSheet.eachRow((row, r) => {
    if (r < 5) return;
    const vendorName = text(row.getCell(1).value);
    const itemName = text(row.getCell(2).value);
    if (!vendorName || !itemName) return;
    items.push({
      vendorName,
      vendorItemName: itemName,
      definition: text(row.getCell(3).value) || null,
      series: text(row.getCell(4).value) || null,
      repItemName: text(row.getCell(5).value) || itemName,
    });
  });

  const priceSheet = wb.getWorksheet('단가이력');
  const prices = [];
  priceSheet.eachRow((row, r) => {
    if (r < 2) return;
    const date = dateOf(row.getCell(1).value);
    const vendorName = text(row.getCell(2).value);
    const itemName = text(row.getCell(3).value);
    if (!date || !vendorName || !itemName) return;
    const raw = row.getCell(4).value;
    const price = numOf(raw);
    prices.push({
      row: r,
      effectiveDate: date,
      vendorName,
      vendorItemName: itemName,
      // "무상"처럼 숫자가 아닌 값은 0원 · 무상으로 옮긴다(자료 3 회신).
      price: price ?? 0,
      isFree: price == null,
      rawPrice: text(raw),
      memo: text(row.getCell(5).value) || null,
      priceType: text(row.getCell(6).value) === '참고' ? '참고' : '실제',
      series: text(row.getCell(7).value) || null,
    });
  });

  const noticeSheet = wb.getWorksheet('공지단가입력');
  const notices = [];
  const rates = [];
  if (noticeSheet) {
    noticeSheet.eachRow((row, r) => {
      if (r >= 36) {
        const date = dateOf(row.getCell(1).value);
        const vendorName = text(row.getCell(2).value);
        const adjust = numOf(row.getCell(5).value);
        if (date && vendorName && adjust != null) {
          notices.push({
            noticeDate: date,
            vendorName,
            series: text(row.getCell(3).value) || null,
            scope: text(row.getCell(4).value) || '전품목',
            adjustAmount: adjust,
            content: text(row.getCell(6).value) || null,
          });
        }
      }
      if (r >= 24) {
        const date = dateOf(row.getCell(17).value);
        const value = numOf(row.getCell(18).value);
        const fx = numOf(row.getCell(19).value);
        if (date && value != null && fx != null) {
          rates.push({ rateDate: date, value, fxRate: fx, memo: text(row.getCell(24).value) || 'LME 기준' });
        }
      }
    });
  }
  return { items, prices, notices, rates };
}

// 옮길 결과를 미리 따져 본다 — 새로 만들 업체·품목, 합칠 중복, 값이 다른 줄.
export async function planImport(parsed) {
  const vendorNames = [...new Set([...parsed.items, ...parsed.prices, ...parsed.notices].map((r) => r.vendorName))];
  const vendors = await prisma.vendor.findMany({ where: { name: { in: vendorNames } }, select: { id: true, name: true } });
  const known = new Map(vendors.map((v) => [v.name, v.id]));

  const existingItems = await prisma.vendorItem.findMany({
    where: { vendorId: { in: [...known.values()] } },
    select: { id: true, vendorId: true, vendorItemName: true },
  });
  const itemKey = (vendorName, itemName) => `${vendorName}//${itemName}`;
  const haveItem = new Set(
    existingItems.map((i) => itemKey(vendors.find((v) => v.id === i.vendorId)?.name ?? '', i.vendorItemName)),
  );

  // 단가이력에만 있고 품목관리에는 없는 조합도 품목으로 만들어야 이력이 붙는다.
  const wantItems = new Map();
  for (const it of parsed.items) wantItems.set(itemKey(it.vendorName, it.vendorItemName), it);
  for (const p of parsed.prices) {
    const k = itemKey(p.vendorName, p.vendorItemName);
    if (!wantItems.has(k)) {
      wantItems.set(k, {
        vendorName: p.vendorName,
        vendorItemName: p.vendorItemName,
        series: p.series,
        repItemName: p.vendorItemName,
        definition: null,
        fromHistoryOnly: true,
      });
    }
  }

  // 같은 날 · 같은 품목 · 같은 구분이 두 번 적힌 줄 — 값이 같으면 합치고, 다르면 확인이 필요하다.
  const seen = new Map();
  const merged = [];
  const conflicts = [];
  for (const p of parsed.prices) {
    const k = `${p.vendorName}//${p.vendorItemName}//${p.effectiveDate}//${p.priceType}`;
    const prev = seen.get(k);
    if (!prev) {
      seen.set(k, p);
      continue;
    }
    if (prev.price === p.price && prev.isFree === p.isFree) merged.push({ ...p, keptRow: prev.row });
    else conflicts.push({ ...p, prevPrice: prev.price, prevRow: prev.row });
    // 엑셀은 나중에 적은 줄을 썼다. 옮길 때도 같은 기준을 쓴다.
    seen.set(k, p);
  }

  const newVendors = vendorNames.filter((n) => !known.has(n));
  const newItems = [...wantItems.values()].filter((i) => !haveItem.has(itemKey(i.vendorName, i.vendorItemName)));

  return {
    counts: {
      vendors: vendorNames.length,
      newVendors: newVendors.length,
      items: wantItems.size,
      newItems: newItems.length,
      itemsFromHistoryOnly: newItems.filter((i) => i.fromHistoryOnly).length,
      prices: parsed.prices.length,
      willInsert: seen.size,
      mergedSameValue: merged.length,
      conflicts: conflicts.length,
      free: parsed.prices.filter((p) => p.isFree).length,
      notices: parsed.notices.length,
      rates: parsed.rates.length,
    },
    newVendors,
    newItems: newItems.slice(0, 200).map((i) => ({
      vendorName: i.vendorName,
      vendorItemName: i.vendorItemName,
      series: i.series,
      fromHistoryOnly: Boolean(i.fromHistoryOnly),
    })),
    conflicts: conflicts.map((c) => ({
      effectiveDate: c.effectiveDate,
      vendorName: c.vendorName,
      vendorItemName: c.vendorItemName,
      priceType: c.priceType,
      prevPrice: c.prevPrice,
      price: c.price,
      keptPrice: c.price,
    })),
    free: parsed.prices.filter((p) => p.isFree).map((p) => ({
      effectiveDate: p.effectiveDate,
      vendorName: p.vendorName,
      vendorItemName: p.vendorItemName,
      rawPrice: p.rawPrice,
    })),
    rows: [...seen.values()],
  };
}

// 실제 이관 — 업체·품목·단가·공지·시세를 한 번에 옮긴다.
// 이미 있는 것은 건너뛰고, 같은 날·같은 구분은 한 건만 남긴다(나중 값).
export async function applyImport(parsed, userId) {
  const plan = await planImport(parsed);
  const result = { vendors: 0, items: 0, prices: 0, notices: 0, rates: 0, skipped: 0 };

  // 1) 업체 — 거래처 마스터에 없으면 임시 거래처로 만든다. 나중에 정리할 수 있게 표시를 남긴다.
  const names = [...new Set([...parsed.items, ...parsed.prices, ...parsed.notices].map((r) => r.vendorName))];
  const vendorId = new Map();
  for (const name of names) {
    const found = await prisma.vendor.findFirst({ where: { name } });
    if (found) {
      vendorId.set(name, found.id);
      continue;
    }
    const made = await prisma.vendor.create({ data: { name, vendorType: '매각처', isTemporary: true } });
    vendorId.set(name, made.id);
    result.vendors += 1;
  }

  // 2) 업체품목
  const itemId = new Map();
  const wantItems = new Map();
  for (const it of parsed.items) wantItems.set(`${it.vendorName}//${it.vendorItemName}`, it);
  for (const p of parsed.prices) {
    const k = `${p.vendorName}//${p.vendorItemName}`;
    if (!wantItems.has(k)) {
      wantItems.set(k, {
        vendorName: p.vendorName,
        vendorItemName: p.vendorItemName,
        series: p.series,
        repItemName: p.vendorItemName,
        definition: null,
      });
    }
  }
  for (const it of wantItems.values()) {
    const vid = vendorId.get(it.vendorName);
    const found = await prisma.vendorItem.findFirst({ where: { vendorId: vid, vendorItemName: it.vendorItemName } });
    if (found) {
      itemId.set(`${it.vendorName}//${it.vendorItemName}`, found.id);
      continue;
    }
    const made = await prisma.vendorItem.create({
      data: {
        vendorId: vid,
        vendorItemName: it.vendorItemName,
        series: it.series ?? null,
        repItemName: it.repItemName ?? it.vendorItemName,
        definition: it.definition ?? null,
        createdById: userId ?? null,
      },
    });
    itemId.set(`${it.vendorName}//${it.vendorItemName}`, made.id);
    result.items += 1;
  }

  // 3) 단가이력 — 출처를 「이관」으로 남겨 나중에 어디서 온 값인지 알 수 있게 한다.
  for (const p of plan.rows) {
    const vid = itemId.get(`${p.vendorName}//${p.vendorItemName}`);
    if (!vid) continue;
    const day = new Date(`${p.effectiveDate}T00:00:00.000Z`);
    const exists = await prisma.vendorPrice.findFirst({
      where: { vendorItemId: vid, effectiveDate: day, priceType: p.priceType, deletedAt: null },
    });
    if (exists) {
      result.skipped += 1;
      continue;
    }
    await prisma.vendorPrice.create({
      data: {
        vendorItemId: vid,
        effectiveDate: day,
        price: p.price,
        priceType: p.priceType,
        isFree: p.isFree,
        source: '이관',
        memo: p.memo,
        createdById: userId ?? null,
      },
    });
    result.prices += 1;
  }

  // 4) 공지 — 이미 옮긴 참고단가와 날짜·업체로 이어지므로 반영 시각을 함께 남긴다.
  for (const n of parsed.notices) {
    const vid = vendorId.get(n.vendorName);
    if (!vid) continue;
    const day = new Date(`${n.noticeDate}T00:00:00.000Z`);
    const exists = await prisma.priceNotice.findFirst({ where: { vendorId: vid, noticeDate: day, series: n.series } });
    if (exists) continue;
    await prisma.priceNotice.create({
      data: {
        vendorId: vid,
        noticeDate: day,
        series: n.series,
        scope: n.scope || '전품목',
        adjustAmount: n.adjustAmount,
        content: n.content,
        appliedAt: day,
        createdById: userId ?? null,
      },
    });
    result.notices += 1;
  }

  // 5) LME 누적기록
  for (const r of parsed.rates) {
    const day = new Date(`${r.rateDate}T00:00:00.000Z`);
    await prisma.marketRate.upsert({
      where: { rateDate_code: { rateDate: day, code: 'LME_CU' } },
      create: { rateDate: day, code: 'LME_CU', value: r.value, fxRate: r.fxRate, memo: r.memo, createdById: userId ?? null },
      update: { value: r.value, fxRate: r.fxRate, memo: r.memo },
    });
    result.rates += 1;
  }

  return { ...result, plan: plan.counts };
}
