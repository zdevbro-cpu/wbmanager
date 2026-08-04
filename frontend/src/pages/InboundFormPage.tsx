import { useState } from 'react';
import { Truck, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../hooks/useMasters';
import { FileUpload } from '../components/FileUpload';
import { pageTitleCls, cardPadCls, primaryBtnCls, inputCls } from '../components/ui/classes';
import type { Inbound } from '../types';

export function InboundFormPage() {
  const { projects } = useProjects();
  const [projectId, setProjectId] = useState('');
  const [inboundDate, setInboundDate] = useState('');
  const [vehicleNo, setVehicleNo] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [tareWeight, setTareWeight] = useState('');
  const [created, setCreated] = useState<Inbound | null>(null);
  const [error, setError] = useState('');

  const netWeight =
    grossWeight && tareWeight ? (Number(grossWeight) - Number(tareWeight)).toFixed(3) : '-';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const inbound = await api.post<Inbound>('/api/inbounds', {
        projectId,
        inboundDate,
        vehicleNo,
        grossWeight: Number(grossWeight),
        tareWeight: Number(tareWeight),
      });
      setCreated(inbound);
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    }
  };

  return (
    <div className="max-w-[520px]">
      <div className="mb-5 flex items-center gap-2">
        <Truck size={20} className="text-primary" />
        <h1 className={pageTitleCls}>입고(반입) 등록</h1>
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
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">계근일</label>
          <input type="date" value={inboundDate} onChange={(e) => setInboundDate(e.target.value)} required className={inputCls} />
        </div>
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">차량번호</label>
          <input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} className={inputCls} />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">만차중량(kg)</label>
            <input type="number" step="0.001" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} required className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">공차중량(kg)</label>
            <input type="number" step="0.001" value={tareWeight} onChange={(e) => setTareWeight(e.target.value)} required className={inputCls} />
          </div>
        </div>
        <p className="text-[13px] text-text-sub">
          순중량(자동계산): <span className="tabular font-bold text-text-strong">{netWeight}</span> kg
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
          <FileUpload label="계량증명서" fileType="계량증명서" parentType="inbound" parentId={created.id} />
        </div>
      )}
    </div>
  );
}
