import { useCallback, useEffect, useState } from 'react';
import { Calculator, CircleArrowRight, Save } from 'lucide-react';
import { api } from '../../api/client';
import { SearchSelect } from '../SearchSelect';
import { DateField } from '../ui/DateField';
import { NumberInput } from '../ui/NumberInput';
import { cardCls, inputCls, tableWrapCls, tdCls, tdNumCls, thCls, thNumCls, trCls } from '../ui/classes';
import type { MarketRateRow, PriceSettings } from '../../types';

// PRC-05 LME 계산기 — 동 시세와 팔 때 환율로 A동·상동·중동 참고단가를 낸다(다문산업 전용, 검토의견 ⑥).
// 19,000원 기준은 A동 금액으로 견준다(검토의견 ⑫). 기준값은 모두 설정으로 두어 배포 없이 바꾼다.

interface Target {
  vendorId: string;
  vendorName: string;
  items: { id: string; vendorItemName: string }[];
}

interface Calc {
  base: number;
  aDong: number;
  sangDong: number;
  jungDong: number;
  threshold: number;
  aRate: number;
}

const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

export function LmeTab() {
  const [rateDate, setRateDate] = useState(today());
  const [value, setValue] = useState('');
  const [fxRate, setFxRate] = useState('');
  const [memo, setMemo] = useState('LME 기준');
  const [calc, setCalc] = useState<Calc | null>(null);
  const [rows, setRows] = useState<MarketRateRow[]>([]);
  const [settings, setSettings] = useState<PriceSettings | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [targetVendorId, setTargetVendorId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<{ rows: MarketRateRow[]; settings: PriceSettings }>('/api/market-rates').then((r) => {
      setRows(r.rows);
      setSettings(r.settings);
    });
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // 계산값을 받을 품목(A동·상동·중동)을 가진 업체를 찾아 둔다. 보통 한 곳(다문산업)뿐이다.
  useEffect(() => {
    api.get<Target[]>('/api/market-rates/targets').then((r) => {
      setTargets(r);
      setTargetVendorId((cur) => cur || r[0]?.vendorId || '');
    });
  }, []);

  const run = async () => {
    if (!value || !fxRate) return;
    const r = await api.get<Calc>(`/api/market-rates/calc?value=${Number(value)}&fxRate=${Number(fxRate)}`);
    setCalc(r);
  };

  const save = async () => {
    if (!calc) return;
    setBusy(true);
    try {
      await api.post('/api/market-rates', { rateDate, value: Number(value), fxRate: Number(fxRate), memo });
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // 엑셀에서 손으로 복사해 단가이력에 붙이던 단계 — 단추 하나로 참고단가에 쌓는다.
  const applyToPrices = async () => {
    if (!calc || !targetVendorId) return;
    const t = targets.find((x) => x.vendorId === targetVendorId);
    if (!confirm(`${t?.vendorName} A동 ${calc.aDong.toLocaleString()}원 · 상동 ${calc.sangDong.toLocaleString()}원 · 중동 ${calc.jungDong.toLocaleString()}원을 ${rateDate}자 참고단가로 반영합니다. 진행할까요?`)) return;
    setBusy(true);
    try {
      const r = await api.post<{ applied: { vendorItemName: string; price: number }[] }>('/api/market-rates/apply', {
        rateDate,
        value: Number(value),
        fxRate: Number(fxRate),
        vendorId: targetVendorId,
      });
      alert(`${r.applied.map((a) => `${a.vendorItemName} ${a.price.toLocaleString()}원`).join(' · ')}을 반영했습니다.`);
    } catch (e) {
      alert(e instanceof Error ? e.message : '반영하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const deduct = (kind: 'sang' | 'jung') => {
    if (!calc || !settings) return '';
    const high = calc.aDong >= calc.threshold;
    const n = settings[`lme.${kind}Deduct.${high ? 'high' : 'low'}`];
    return `A동 − ${n.toLocaleString()}`;
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={`${cardCls} p-4`}>
        <div className="mb-3 flex items-center gap-1.5 text-[14px] font-extrabold text-text-strong">
          <Calculator size={16} className="text-primary" /> 입력
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">기준일</span>
            <DateField value={rateDate} onChange={(e) => setRateDate(e.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">LME 동(Cu) 현시세 (USD/t)</span>
            <NumberInput value={value} onChange={setValue} decimals={2} aria-label="LME 시세" />
          </label>
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">팔 때 기준 환율 (원/USD)</span>
            <NumberInput value={fxRate} onChange={setFxRate} decimals={2} aria-label="환율" />
          </label>
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">비고</span>
            <input value={memo} onChange={(e) => setMemo(e.target.value)} className={inputCls} />
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={run}
              disabled={!value || !fxRate}
              className="inline-flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[8px] bg-primary px-3 text-[13px] font-bold text-white hover:brightness-110 disabled:opacity-40"
            >
              <Calculator size={14} /> 계산
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!calc || busy}
              className="inline-flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[8px] border border-border px-3 text-[13px] font-bold text-text-mid hover:bg-hover disabled:opacity-40"
            >
              <Save size={14} /> 누적기록에 저장
            </button>
          </div>
        </div>
      </div>

      {calc && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="w-[220px]">
            <span className="mb-1 block text-[12px] font-semibold text-text-sub">계산값을 받을 업체</span>
            <SearchSelect
              options={targets.map((t) => ({ value: t.vendorId, label: `${t.vendorName} (${t.items.length}품목)` }))}
              value={targetVendorId}
              onChange={setTargetVendorId}
              placeholder="A동·상동·중동 품목이 있는 업체"
              ariaLabel="계산값을 받을 업체"
            />
          </label>
          <button
            type="button"
            onClick={applyToPrices}
            disabled={busy || !targetVendorId}
            className="inline-flex h-[38px] items-center gap-1.5 rounded-[8px] border border-primary px-4 text-[13px] font-bold text-primary hover:bg-nav-hover disabled:opacity-40"
          >
            <CircleArrowRight size={14} /> A동 · 상동 · 중동 참고단가로 반영
          </button>
          {!targets.length && (
            <span className="text-[12px] text-warning">
              A동 · 상동 · 중동 품목이 등록된 업체가 없습니다. 업체품목에 먼저 등록해 주세요.
            </span>
          )}
        </div>
      )}

      {calc && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="기준금액" value={`${calc.base.toLocaleString()}원`} sub={`LME ${Number(value).toLocaleString()} × ${Number(fxRate).toLocaleString()} ÷ 1,000`} />
          <Stat label="A동 참고단가" value={`${calc.aDong.toLocaleString()}원`} sub={`기준금액 × ${Math.round(calc.aRate * 100)}%`} tone="#38bdf8" />
          <Stat label="상동 참고단가" value={`${calc.sangDong.toLocaleString()}원`} sub={deduct('sang')} />
          <Stat label="중동 참고단가" value={`${calc.jungDong.toLocaleString()}원`} sub={deduct('jung')} />
        </div>
      )}

      <div className={`${cardCls} p-4 text-[12.5px] leading-relaxed text-text-sub`}>
        <div className="mb-1 font-bold text-text-strong">계산식</div>
        기준금액 = LME × 팔 때 기준 환율 ÷ 1,000
        <br />A동 = 기준금액 × {settings ? Math.round(settings['lme.aRate'] * 100) : 97}%
        <br />
        상동 = A동 − (A동 {settings?.['lme.threshold'].toLocaleString() ?? '19,000'}원 이상이면{' '}
        {settings?.['lme.sangDeduct.high'].toLocaleString() ?? '1,000'} / 미만이면{' '}
        {settings?.['lme.sangDeduct.low'].toLocaleString() ?? '500'})
        <br />
        중동 = A동 − (A동 {settings?.['lme.threshold'].toLocaleString() ?? '19,000'}원 이상이면{' '}
        {settings?.['lme.jungDeduct.high'].toLocaleString() ?? '2,000'} / 미만이면{' '}
        {settings?.['lme.jungDeduct.low'].toLocaleString() ?? '1,000'})
        <div className="mt-1.5 text-text-faint">
          ※ 기준 19,000원은 A동 금액 기준입니다(검토의견 ⑫). 97% · 19,000원 · 차감액은 설정값이라 배포 없이 바꿀 수
          있습니다.
        </div>
      </div>

      <div>
        <div className="mb-2 text-[14px] font-extrabold text-text-strong">LME 누적기록</div>
        <div className={tableWrapCls}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className={thCls}>기준일</th>
                <th className={thNumCls}>LME 동</th>
                <th className={thNumCls}>팔 때 환율</th>
                <th className={thNumCls}>기준금액</th>
                <th className={thNumCls}>A동</th>
                <th className={thNumCls}>상동</th>
                <th className={thNumCls}>중동</th>
                <th className={thCls}>비고</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={trCls}>
                  <td className={tdCls}>{r.rateDate}</td>
                  <td className={tdNumCls}>{r.value.toLocaleString()}</td>
                  <td className={tdNumCls}>{r.fxRate.toLocaleString()}</td>
                  <td className={tdNumCls}>{r.base.toLocaleString()}</td>
                  <td className={`${tdNumCls} font-bold text-text-strong`}>{r.aDong.toLocaleString()}</td>
                  <td className={tdNumCls}>{r.sangDong.toLocaleString()}</td>
                  <td className={tdNumCls}>{r.jungDong.toLocaleString()}</td>
                  <td className={tdCls}>{r.memo ?? '-'}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-[13px] text-text-faint">
                    저장된 시세가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`${cardCls} p-3.5`}>
      <div className="text-[12.5px] font-semibold text-text-faint">{label}</div>
      <div className="tabular mt-0.5 text-[22px] font-extrabold text-text-strong" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[12px] text-text-sub">{sub}</div>}
    </div>
  );
}
