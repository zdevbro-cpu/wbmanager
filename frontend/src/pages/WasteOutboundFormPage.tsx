import { useState } from 'react';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useProjects, useVendors, useItemMasters } from '../hooks/useMasters';
import { MasterSelect } from '../components/MasterSelect';
import { FileUpload } from '../components/FileUpload';
import { pageTitleCls, cardPadCls, primaryBtnCls, inputCls } from '../components/ui/classes';
import type { WasteOutbound } from '../types';

export function WasteOutboundFormPage() {
  const { projects } = useProjects();
  const { vendors, quickCreate: quickCreateVendor } = useVendors();
  const { items, quickCreate: quickCreateItem } = useItemMasters();

  const [projectId, setProjectId] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [buyerId, setBuyerId] = useState('');
  const [outboundDate, setOutboundDate] = useState('');
  const [weight, setWeight] = useState('');
  const [amount, setAmount] = useState('');
  const [created, setCreated] = useState<WasteOutbound | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const wasteOutbound = await api.post<WasteOutbound>('/api/waste-outbounds', {
        projectId,
        itemCode: itemCode || undefined,
        buyerId: buyerId || undefined,
        outboundDate,
        weight: Number(weight),
        amount: amount ? Number(amount) : undefined,
      });
      setCreated(wasteOutbound);
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    }
  };

  return (
    <div className="max-w-[520px]">
      <div className="mb-5 flex items-center gap-2">
        <Trash2 size={20} className="text-primary" />
        <h1 className={pageTitleCls}>폐기물 반출 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className={`${cardPadCls} space-y-3.5`}>
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

        <MasterSelect
          label="품목(선택)"
          options={items.map((i) => ({ value: i.itemCode, label: `${i.itemName} (${i.itemCode})`, isTemporary: i.isTemporary }))}
          value={itemCode}
          onChange={setItemCode}
          onQuickCreate={quickCreateItem}
        />

        <MasterSelect
          label="거래처(폐기물업체)"
          options={vendors.map((v) => ({ value: v.id, label: v.name, isTemporary: v.isTemporary }))}
          value={buyerId}
          onChange={setBuyerId}
          onQuickCreate={quickCreateVendor}
        />

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">반출일</label>
          <input type="date" value={outboundDate} onChange={(e) => setOutboundDate(e.target.value)} required className={inputCls} />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">중량(kg)</label>
          <input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} required className={inputCls} />
        </div>

        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">지출금액</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
        </div>

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
          <FileUpload label="계량증명서" fileType="계량증명서" parentType="waste_outbound" parentId={created.id} />
        </div>
      )}
    </div>
  );
}
