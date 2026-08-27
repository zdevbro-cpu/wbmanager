import { useCallback, useEffect, useState } from 'react';
import { Truck, Check, X, Pencil, Trash2, ArrowUpRight } from 'lucide-react';
import { api } from '../api/client';
import { useCommonCodes } from '../hooks/useMasters';
import { sectionTitleCls, inputCls, tableWrapCls, thCls, tdCls, trCls } from './ui/classes';
import type { Asset } from '../types';

// 계근 차량 — 계근 등록에서 차량번호만 적어 만들어진 외부 차량이다.
// 회사 자산이 아니라 자산 대장에 두지 않고, 여기서 오타를 고치거나 지운다.
// 회사가 인수한 차량은 「자산으로 전환」으로 자산 대장에 올린다.
export function ExternalVehicleSection() {
  const [rows, setRows] = useState<Asset[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [plateNo, setPlateNo] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [error, setError] = useState('');
  const { labels: vehicleTypes } = useCommonCodes('차종');

  const load = useCallback(() => {
    api.get<Asset[]>('/api/assets?assetType=VEHICLE&isCompany=false').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (a: Asset) => {
    setEditing(a.id);
    setPlateNo(a.vehicle?.plateNo ?? '');
    setVehicleType(a.vehicle?.vehicleType ?? a.category ?? '');
    setError('');
  };

  const save = async (id: string) => {
    if (!plateNo.trim()) {
      setError('차량번호를 입력하세요.');
      return;
    }
    try {
      await api.patch(`/api/assets/${id}/vehicle`, { plateNo: plateNo.trim(), vehicleType });
      setEditing(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '수정에 실패했습니다.');
    }
  };

  const promote = async (a: Asset) => {
    const plate = a.vehicle?.plateNo ?? a.name;
    if (!window.confirm(`${plate} 차량을 회사 자산으로 올릴까요?\n자산 관리에서 이어서 정보를 채우면 됩니다.`)) return;
    await api.post(`/api/assets/${a.id}/promote`, {});
    load();
  };

  const remove = async (a: Asset) => {
    const plate = a.vehicle?.plateNo ?? a.name;
    if (!window.confirm(`${plate} 차량번호를 지울까요?\n이미 등록된 계근 기록은 그대로 남습니다.`)) return;
    try {
      await api.del(`/api/assets/${a.id}`);
      load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Truck size={16} className="text-primary" />
        <h2 className={`${sectionTitleCls} text-[15px]`}>계근 차량</h2>
        <span className="text-[13px] text-text-sub">{rows.length}건</span>
      </div>
      <p className="mb-4 text-[13px] text-text-sub">
        계근 등록에서 차량번호를 직접 입력하면 이곳에 쌓입니다. 운송만 맡는 외부 차량이라 자산 대장에는 넣지 않고, 여기서
        오타를 고치거나 지웁니다. 회사가 인수한 차량은 자산으로 올리면 자산 관리에서 이어 다룹니다.
      </p>

      {error && <p className="mb-2 text-[12.5px] text-danger">{error}</p>}

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={`${thCls} w-[52px]`}>번호</th>
              <th className={thCls}>차량번호</th>
              <th className={thCls}>차종</th>
              <th className={thCls}>등록일</th>
              <th className={thCls}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a, i) => (
              <tr key={a.id} className={trCls}>
                <td className={`${tdCls} tabular text-text-faint`}>{i + 1}</td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>
                  {editing === a.id ? (
                    <input
                      value={plateNo}
                      onChange={(e) => setPlateNo(e.target.value)}
                      className={`${inputCls} h-8 w-[160px] px-2`}
                    />
                  ) : (
                    a.vehicle?.plateNo ?? a.name
                  )}
                </td>
                <td className={tdCls}>
                  {editing === a.id ? (
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className={`${inputCls} h-8 w-[140px] px-2`}
                    >
                      <option value="">미지정</option>
                      {vehicleTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  ) : (
                    (a.vehicle?.vehicleType ?? a.category ?? '-')
                  )}
                </td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{a.createdAt?.slice(0, 10) ?? '-'}</td>
                <td className={tdCls}>
                  <div className="flex items-center gap-1.5">
                    {editing === a.id ? (
                      <>
                        <button
                          type="button"
                          title="저장"
                          onClick={() => save(a.id)}
                          className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-primary"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          type="button"
                          title="취소"
                          onClick={() => setEditing(null)}
                          className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                        >
                          <X size={15} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          title="차량번호·차종 수정"
                          onClick={() => startEdit(a)}
                          className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          title="회사 자산으로 전환"
                          onClick={() => promote(a)}
                          className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-primary"
                        >
                          <ArrowUpRight size={15} />
                        </button>
                        <button
                          type="button"
                          title="삭제"
                          onClick={() => remove(a)}
                          className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[13px] text-text-faint">
                  계근 등록에서 직접 입력된 차량번호가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
