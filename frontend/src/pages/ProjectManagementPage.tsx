import { useCallback, useEffect, useState } from 'react';
import { Layers, Plus } from 'lucide-react';
import { api } from '../api/client';
import { useVendors } from '../hooks/useMasters';
import { FormModal } from '../components/FormModal';
import { Badge } from '../components/ui/Badge';
import {
  pageTitleCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { Project, Vendor } from '../types';

const STATUSES = ['진행', '완료', '보류'];

const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

// 프로젝트(차수) 관리 — 등록·수정을 한 화면에서 처리한다.
// 거래·재고·손익이 모두 이 프로젝트를 참조하므로 삭제는 두지 않고 상태(완료/보류)로 종료한다.
export function ProjectManagementPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const { vendors } = useVendors();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const reload = useCallback(() => {
    api.get<Project[]>('/api/projects').then(setProjects);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const vendorName = (id?: string | null) => vendors.find((v) => v.id === id)?.name ?? '-';

  const changeStatus = async (p: Project, status: string) => {
    await api.patch(`/api/projects/${p.id}`, { status });
    reload();
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Layers size={20} className="text-primary" />
        <h1 className={pageTitleCls}>프로젝트 관리</h1>
        <span className="ml-1 text-[13px] text-text-sub">{projects.length}건</span>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
          className={`${primaryBtnCls} ml-auto`}
        >
          <Plus size={15} /> 프로젝트 등록
        </button>
      </div>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>프로젝트(차수)</th>
              <th className={thCls}>매입처</th>
              <th className={thCls}>계약기간</th>
              <th className={thCls}>매입가</th>
              <th className={thCls}>상태</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className={trCls}>
                <td className={`${tdCls} font-semibold text-text-strong`}>{p.roundName}</td>
                <td className={tdCls}>{vendorName(p.buyerId)}</td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>
                  {day(p.startDate)} ~ {day(p.endDate)}
                </td>
                <td className={`${tdCls} tabular`}>{p.purchasePrice ? Number(p.purchasePrice).toLocaleString() : '-'}</td>
                <td className={tdCls}>
                  <Badge tone={p.status === '완료' ? 'slate' : p.status === '보류' ? 'amber' : 'blue'}>{p.status}</Badge>
                </td>
                <td className={`${tdCls} whitespace-nowrap`}>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(p);
                        setOpen(true);
                      }}
                      className="text-[12.5px] font-semibold text-primary hover:underline"
                    >
                      수정
                    </button>
                    <select
                      value={p.status}
                      onChange={(e) => changeStatus(p, e.target.value)}
                      aria-label="상태 변경"
                      className={`${inputCls} h-8 w-[92px] px-2 text-[12.5px]`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[13px] text-text-faint">
                  등록된 프로젝트가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12.5px] text-text-faint">
        입출고·재고·손익 집계가 모두 이 프로젝트를 참조합니다. 종료된 차수는 삭제하지 말고 상태를 완료로 바꿔 주세요.
      </p>

      {open && (
        <FormModal
          title={editing ? '프로젝트 수정' : '프로젝트 등록'}
          icon={Layers}
          onClose={() => {
            setOpen(false);
            setEditing(null);
          }}
        >
          <ProjectForm
            project={editing}
            vendors={vendors}
            onDone={() => {
              setOpen(false);
              setEditing(null);
              reload();
            }}
            onCancel={() => {
              setOpen(false);
              setEditing(null);
            }}
          />
        </FormModal>
      )}
    </div>
  );
}

function ProjectForm({
  project,
  vendors,
  onDone,
  onCancel,
}: {
  project: Project | null;
  vendors: Vendor[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [roundName, setRoundName] = useState(project?.roundName ?? '');
  const [buyerId, setBuyerId] = useState(project?.buyerId ?? '');
  const [purchasePrice, setPurchasePrice] = useState(project?.purchasePrice ? String(project.purchasePrice) : '');
  const [startDate, setStartDate] = useState(project?.startDate?.slice(0, 10) ?? '');
  const [endDate, setEndDate] = useState(project?.endDate?.slice(0, 10) ?? '');
  const [status, setStatus] = useState(project?.status ?? '진행');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roundName.trim()) return;
    if (startDate && endDate && startDate > endDate) {
      setError('계약 종료일이 시작일보다 빠릅니다.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        roundName,
        buyerId: buyerId || undefined,
        purchasePrice: purchasePrice || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status,
      };
      if (project) await api.patch(`/api/projects/${project.id}`, payload);
      else await api.post('/api/projects', payload);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-3 gap-x-3 gap-y-3.5">
        <div className="col-span-2">
          <label className={labelCls}>프로젝트(차수)명</label>
          <input
            value={roundName}
            onChange={(e) => setRoundName(e.target.value)}
            required
            placeholder="포스코_KM_안산 / 26-1차 등"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>상태</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>매입처(거래처)</label>
          <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className={inputCls}>
            <option value="">선택</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelCls}>계약기간</label>
          <div className="flex items-center gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            <span className="shrink-0 text-text-faint">~</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <label className={labelCls}>매입가(원)</label>
          <input
            type="number"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
            className={inputCls}
          />
        </div>

        <p className="col-span-2 self-end pb-2 text-[12.5px] text-text-faint">
          매입가는 차수 손익 대시보드의 취득원가로 집계됩니다.
        </p>
      </div>

      {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

      <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
        <button type="button" onClick={onCancel} className={outlineBtnCls}>
          취소
        </button>
        <button type="submit" disabled={submitting} className={primaryBtnCls}>
          {submitting ? '저장 중...' : project ? '수정' : '등록'}
        </button>
      </div>
    </form>
  );
}
