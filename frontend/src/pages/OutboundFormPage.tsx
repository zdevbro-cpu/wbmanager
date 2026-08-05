import { useState } from 'react';
import { PackageMinus, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useProjects, useVendors, useItemMasters } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { FileUpload } from '../components/FileUpload';
import { pageTitleCls, cardPadCls, primaryBtnCls, inputCls } from '../components/ui/classes';
import type { OutboundSale } from '../types';

export function OutboundFormPage() {
  const { projects } = useProjects();
  const { vendors, quickCreate: quickCreateVendor } = useVendors();
  const { items, quickCreate: quickCreateItem } = useItemMasters();

  const [projectId, setProjectId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [outboundDate, setOutboundDate] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [lossWeight, setLossWeight] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [created, setCreated] = useState<OutboundSale | null>(null);
  const [error, setError] = useState('');

  const settledWeight =
    grossWeight && tareWeight
      ? (Number(grossWeight) - Number(tareWeight) - Number(lossWeight || 0)).toFixed(3)
      : '-';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const outbound = await api.post<OutboundSale>('/api/outbounds', {
        projectId,
        itemCode,
        buyerId: buyerId || undefined,
        outboundDate,
        grossWeight: grossWeight ? Number(grossWeight) : undefined,
        tareWeight: tareWeight ? Number(tareWeight) : undefined,
        lossWeight: lossWeight ? Number(lossWeight) : undefined,
        unitPrice: unitPrice ? Number(unitPrice) : undefined,
      });
      setCreated(outbound);
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    }
  };

  return (
    <div className="max-w-[720px]">
      <div className="mb-5 flex items-center gap-2">
        <PackageMinus size={20} className="text-primary" />
        <h1 className={pageTitleCls}>출고(매각) 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className={`${cardPadCls} space-y-4`}>
        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">프로젝트(차수)</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required className={inputCls}>
              <option value="">선택</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.roundName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">출고일</label>
            <input
              type="date"
              value={outboundDate}
              onChange={(e) => setOutboundDate(e.target.value)}
              required
              className={inputCls}
            />
          </div>

          <MasterSelect
            label="품목"
            options={items.map((i) => ({ value: i.itemCode, label: `${i.itemName} (${i.itemCode})`, isTemporary: i.isTemporary }))}
            value={itemCode}
            onChange={setItemCode}
            onQuickCreate={quickCreateItem}
          />

          <MasterSelect
            label="거래처(매각처)"
            options={vendors.map((v) => ({ value: v.id, label: v.name, isTemporary: v.isTemporary }))}
            value={buyerId}
            onChange={setBuyerId}
            onQuickCreate={quickCreateVendor}
          />

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">만차중량(kg)</label>
            <input type="number" step="0.001" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">공차중량(kg)</label>
            <input type="number" step="0.001" value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">감량(kg)</label>
            <input type="number" step="0.001" value={lossWeight} onChange={(e) => setLossWeight(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">단가</label>
            <input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className={inputCls} />
          </div>
        </div>

        <p className="text-[13px] text-text-sub">
          정산중량(자동계산): <span className="tabular font-bold text-text-strong">{settledWeight}</span> kg
        </p>

        {error && <p className="text-[13px] text-danger">{error}</p>}
        <button type="submit" className={primaryBtnCls}>
          등록
        </button>
      </form>

      {created && (
        <div className={`${cardPadCls} mt-4`}>
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-success">
            <CheckCircle2 size={15} /> 등록 완료. 계량증명서를 첨부하세요.
          </p>
          <FileUpload label="계량증명서" fileType="계량증명서" parentType="outbound_sale" parentId={created.id} />
        </div>
      )}
    </div>
  );
}
