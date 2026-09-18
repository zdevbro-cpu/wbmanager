import { prisma } from './prisma.js';

// 단가 계산 규칙 — 엑셀 「단가조회」·「공지단가입력」의 수식을 그대로 옮긴 곳이다.
// 화면마다 따로 계산하면 엑셀처럼 시트끼리 값이 어긋난다. 그래서 한 곳에만 둔다.

// 담당자가 화면에서 바꾸기 전까지 쓰는 기본값. 엑셀 설명문에 적혀 있던 수치다.
export const DEFAULT_SETTINGS = {
  'lme.aRate': 0.97, // A동 = 기준금액 × 97%
  'lme.threshold': 19000, // 이 금액(A동 기준, 검토의견 ⑫)을 넘으면 차감액이 커진다
  'lme.sangDeduct.high': 1000,
  'lme.sangDeduct.low': 500,
  'lme.jungDeduct.high': 2000,
  'lme.jungDeduct.low': 1000,
  'warn.checkDays': 45, // 최근 실거래가 이만큼 지나면 「확인 권장」
  'warn.staleDays': 90, // 이만큼 지나면 「90일 초과」
};

export async function getSettings() {
  const rows = await prisma.priceSetting.findMany();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    const n = Number(r.value);
    if (!Number.isNaN(n)) out[r.key] = n;
  }
  return out;
}

export const dayOf = (d) => new Date(d).toISOString().slice(0, 10);
const num = (v) => (v == null ? null : Number(v));

// 날짜별 대표단가 — 같은 날 실제·참고가 함께 있으면 실제를 쓴다(검토의견 ④).
// 같은 구분이 두 번 있으면 나중에 적은 것을 쓴다. 엑셀도 그랬다.
export function byDate(rows) {
  const days = new Map();
  for (const r of [...rows].sort((a, b) => new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0))) {
    const key = dayOf(r.effectiveDate);
    const cur = days.get(key);
    if (!cur || r.priceType === '실제' || cur.priceType !== '실제') {
      days.set(key, { date: key, price: num(r.price), priceType: r.priceType, isFree: r.isFree, memo: r.memo });
    }
  }
  return [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

// 흐름 — 대표단가 최근 2회를 견준다. 2회가 안 되면 판단하지 않는다.
export function trendOf(series) {
  const s = series.filter((r) => !r.isFree);
  if (s.length < 2) return '자료 부족';
  const last = s[s.length - 1].price;
  const prev = s[s.length - 2].price;
  if (last < prev) return '하락';
  if (last > prev) return '상승';
  return '보합';
}

// 참고단가 — 최근 5회 값의 변동폭(4개)이 모두 100원 단위면 100원, 아니면 10원 단위로
// 최근단가를 반올림한 뒤 흐름 방향으로 한 단위 더하거나 뺀다.
export function suggestOf(series, trend) {
  const s = series.filter((r) => !r.isFree);
  if (!s.length) return null;
  const last5 = s.slice(-5).map((r) => r.price);
  const diffs = last5.slice(1).map((p, i) => p - last5[i]);
  const unit = diffs.length >= 4 && diffs.every((d) => d % 100 === 0) ? 100 : 10;
  const latest = s[s.length - 1].price;
  const rounded = Math.round(latest / unit) * unit;
  const step = trend === '하락' ? -unit : trend === '상승' ? unit : 0;
  const sign = step < 0 ? `− ${unit}` : step > 0 ? `+ ${unit}` : '± 0';
  return {
    price: rounded + step,
    unit,
    explain: `${latest.toLocaleString()} → ${rounded.toLocaleString()}(${unit}원 단위 반올림) ${sign} · ${trend}`,
  };
}

// 최근 3회 평균·범위. 무상(0원)은 평균을 끌어내리므로 뺀다(자료 3 회신).
export function statsOf(series) {
  const s = series.filter((r) => !r.isFree).slice(-3).map((r) => r.price);
  if (!s.length) return { count: 0, avg: null, min: null, max: null };
  return {
    count: s.length,
    avg: Math.round((s.reduce((a, b) => a + b, 0) / s.length) * 100) / 100,
    min: Math.min(...s),
    max: Math.max(...s),
  };
}

// 자료상태 — 무엇을 근거로 계산했는지 화면에 그대로 적어 준다.
export const dataStateOf = (stats) =>
  stats.count === 0 ? '자료 없음' : stats.count < 3 ? `실제자료 ${stats.count}회` : '최근 3회 기준';

// 경고 — 마지막 실제 거래로부터 며칠이 지났는지.
export function warnOf(lastRealDate, asOf, s) {
  if (!lastRealDate) return { days: null, level: 'none', label: '거래 없음' };
  const days = Math.floor((new Date(dayOf(asOf)) - new Date(dayOf(lastRealDate))) / 86400000);
  if (days > s['warn.staleDays']) return { days, level: 'stale', label: '90일 초과' };
  if (days > s['warn.checkDays']) return { days, level: 'check', label: '확인 권장' };
  return { days, level: 'ok', label: '최근 거래 기준' };
}

// 한 품목의 요약 — 조회 화면(PRC-02)과 최신단가(PRC-01)가 같은 값을 쓴다.
export function summarize(rows, asOf, s) {
  const series = byDate(rows.filter((r) => dayOf(r.effectiveDate) <= dayOf(asOf)));
  if (!series.length) return null;
  const latest = series[series.length - 1];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const trend = trendOf(series);
  const stats = statsOf(series);
  const lastReal = [...series].reverse().find((r) => r.priceType === '실제');
  const delta = prev ? Math.round((latest.price - prev.price) * 100) / 100 : null;
  return {
    latest,
    prev,
    delta,
    deltaRate: prev && prev.price ? Math.round((delta / prev.price) * 1000) / 10 : null,
    trend,
    stats,
    suggest: suggestOf(series, trend),
    dataState: dataStateOf(stats),
    lastRealDate: lastReal?.date ?? null,
    warn: warnOf(lastReal?.date, asOf, s),
    series,
  };
}

// LME 동 — 기준금액에서 A동을 내고, A동 금액을 기준으로 상동·중동을 깎는다(검토의견 ⑫).
export function lmeCalc({ value, fxRate }, s) {
  const base = Math.round((Number(value) * Number(fxRate)) / 1000);
  const aDong = Math.round(base * s['lme.aRate']);
  const high = aDong >= s['lme.threshold'];
  return {
    base,
    aDong,
    sangDong: aDong - (high ? s['lme.sangDeduct.high'] : s['lme.sangDeduct.low']),
    jungDong: aDong - (high ? s['lme.jungDeduct.high'] : s['lme.jungDeduct.low']),
    threshold: s['lme.threshold'],
    aRate: s['lme.aRate'],
  };
}

// 공지 대상 품목 — 전품목이면 그 업체의 같은 계열 전부, 지정이면 그 한 품목.
export async function noticeTargets({ vendorId, series, scope, targetVendorItemId }) {
  if (scope === '지정') {
    if (!targetVendorItemId) return [];
    const one = await prisma.vendorItem.findUnique({ where: { id: targetVendorItemId } });
    return one ? [one] : [];
  }
  return prisma.vendorItem.findMany({
    where: { vendorId, isActive: true, ...(series ? { series } : {}) },
    orderBy: { vendorItemName: 'asc' },
  });
}

// 공지 반영 미리보기 — 품목마다 「최근 적용단가 + 조정금액」을 미리 보여 준다.
// 실제 단가가 있으면 실제를 기준으로 삼는다(엑셀과 같다).
export async function noticePreview({ vendorId, series, scope, targetVendorItemId, adjustAmount, noticeDate }) {
  const items = await noticeTargets({ vendorId, series, scope, targetVendorItemId });
  if (!items.length) return [];
  const prices = await prisma.vendorPrice.findMany({
    where: {
      vendorItemId: { in: items.map((i) => i.id) },
      deletedAt: null,
      effectiveDate: { lte: new Date(`${dayOf(noticeDate)}T23:59:59.999Z`) },
    },
  });
  const adjust = Number(adjustAmount);
  return items.map((item) => {
    const series2 = byDate(prices.filter((p) => p.vendorItemId === item.id));
    const base = series2.length ? series2[series2.length - 1] : null;
    return {
      vendorItemId: item.id,
      vendorItemName: item.vendorItemName,
      series: item.series,
      basePrice: base?.price ?? null,
      baseDate: base?.date ?? null,
      basePriceType: base?.priceType ?? null,
      adjustAmount: adjust,
      nextPrice: base ? Math.round((base.price + adjust) * 100) / 100 : null,
    };
  });
}

// 단가 한 건 저장 — 같은 날 · 같은 품목 · 같은 구분이 이미 있으면 새로 쌓지 않고 그 줄을 고친다.
// 엑셀에서 같은 날 두 번 적혀 값이 갈린 9건이 여기서는 생기지 않는다.
export async function upsertPrice(input, userId) {
  const { vendorItemId, effectiveDate, priceType = '실제', isFree = false, source = '수기', memo, noticeId } = input;
  if (!vendorItemId) throw Object.assign(new Error('품목을 고르세요.'), { status: 400 });
  if (!effectiveDate) throw Object.assign(new Error('적용일을 고르세요.'), { status: 400 });
  const price = isFree ? 0 : Number(input.price);
  if (!isFree && !Number.isFinite(price)) throw Object.assign(new Error('단가를 숫자로 적어 주세요.'), { status: 400 });

  const day = new Date(`${dayOf(effectiveDate)}T00:00:00.000Z`);
  const found = await prisma.vendorPrice.findFirst({
    where: { vendorItemId, effectiveDate: day, priceType, deletedAt: null },
  });
  const data = { price, isFree, source, memo: memo ?? null, noticeId: noticeId ?? null };
  if (found) return prisma.vendorPrice.update({ where: { id: found.id }, data });
  return prisma.vendorPrice.create({
    data: { ...data, vendorItemId, effectiveDate: day, priceType, createdById: userId ?? null },
  });
}
