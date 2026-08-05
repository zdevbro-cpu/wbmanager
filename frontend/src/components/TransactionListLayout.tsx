import { useState, type ReactNode } from 'react';
import { Plus, Paperclip, Eye, Trash2, X, RotateCcw, type LucideIcon } from 'lucide-react';
import { useProjects, useItemMasters, useVehicles, useEmployees } from '../hooks/useMasters';
import { pageTitleCls, primaryBtnCls, outlineBtnCls, inputCls, cardCls, tableWrapCls, thCls, trCls } from './ui/classes';
import type { Attachment } from '../types';

function FilterLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1 block text-[11.5px] font-semibold text-text-sub">{children}</span>;
}

// 차종 목록 — 원본 엑셀 입출고 시트 실제 사용값
const VEHICLE_TYPES = ['집게차', '카고', '암롤트럭', '방통차', '1톤트럭', '트레일러', '기타'];

export interface TxFilter {
  from: string;
  to: string;
  projectId: string;
  vehicleType: string;
  vehicleNo: string;
  driverName: string;
  itemCode: string;
}

export const EMPTY_FILTER: TxFilter = {
  from: '',
  to: '',
  projectId: '',
  vehicleType: '',
  vehicleNo: '',
  driverName: '',
  itemCode: '',
};

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  align?: 'right';
  nowrap?: boolean;
  /** 합계 행에 표시할 값. 지정하면 해당 컬럼의 합계를 계산한다. */
  sum?: (row: T) => number | null | undefined;
}

interface Props<T> {
  title: string;
  icon: LucideIcon;
  addLabel: string;
  dateLabel: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  attachments: (row: T) => Attachment[];
  detailFields: (row: T) => { label: string; value: ReactNode }[];
  filter: TxFilter;
  setFilter: (f: TxFilter) => void;
  onAdd: () => void;
  onDelete: (row: T) => void;
  emptyText: string;
}

export function TransactionListLayout<T>({
  title,
  icon: Icon,
  addLabel,
  dateLabel,
  columns,
  rows,
  rowKey,
  attachments,
  detailFields,
  filter,
  setFilter,
  onAdd,
  onDelete,
  emptyText,
}: Props<T>) {
  const { projects } = useProjects();
  const { items } = useItemMasters();
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();
  const [detail, setDetail] = useState<T | null>(null);

  const hasSum = columns.some((c) => c.sum);
  const tdBase = 'px-3 py-1.5 text-[13px] text-text';
  const set = (patch: Partial<TxFilter>) => setFilter({ ...filter, ...patch });

  const confirmDelete = (row: T) => {
    if (window.confirm('이 건을 삭제하시겠습니까? 재고 반영분도 함께 취소됩니다.')) onDelete(row);
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Icon size={20} className="text-primary" />
        <h1 className={pageTitleCls}>{title}</h1>
        <span className="ml-1 text-[13px] text-text-sub">{rows.length}건</span>
        <button type="button" onClick={onAdd} className={`${primaryBtnCls} ml-auto`}>
          <Plus size={15} /> {addLabel}
        </button>
      </div>

      {/* 필터 바 — 1줄 배치. 각 항목에 라벨을 달아 좁아져도 무엇을 고르는지 알 수 있게 한다. */}
      <div className={`${cardCls} mb-4 p-4`}>
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))_auto] items-end gap-2">
          <div>
            <FilterLabel>프로젝트</FilterLabel>
            <select
              value={filter.projectId}
              onChange={(e) => set({ projectId: e.target.value })}
              className={`${inputCls} px-2`}
            >
              <option value="">전체</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.roundName}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <FilterLabel>{dateLabel}</FilterLabel>
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={filter.from}
                onChange={(e) => set({ from: e.target.value })}
                className={`${inputCls} px-2`}
              />
              <span className="shrink-0 text-text-faint">~</span>
              <input
                type="date"
                value={filter.to}
                onChange={(e) => set({ to: e.target.value })}
                className={`${inputCls} px-2`}
              />
            </div>
          </div>

          <div>
            <FilterLabel>제품명</FilterLabel>
            <select
              value={filter.itemCode}
              onChange={(e) => set({ itemCode: e.target.value })}
              className={`${inputCls} px-2`}
            >
              <option value="">전체</option>
              {items.map((i) => (
                <option key={i.itemCode} value={i.itemCode}>
                  {i.itemName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FilterLabel>차종</FilterLabel>
            <select
              value={filter.vehicleType}
              onChange={(e) => set({ vehicleType: e.target.value })}
              className={`${inputCls} px-2`}
            >
              <option value="">전체</option>
              {VEHICLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FilterLabel>차량번호</FilterLabel>
            <select
              value={filter.vehicleNo}
              onChange={(e) => set({ vehicleNo: e.target.value })}
              className={`${inputCls} px-2`}
            >
              <option value="">전체</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.vehicleNo}>
                  {v.vehicleNo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <FilterLabel>운전자</FilterLabel>
            <select
              value={filter.driverName}
              onChange={(e) => set({ driverName: e.target.value })}
              className={`${inputCls} px-2`}
            >
              <option value="">전체</option>
              {employees.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            title="검색조건 초기화"
            onClick={() => setFilter(EMPTY_FILTER)}
            className={`${outlineBtnCls} shrink-0 px-3`}
          >
            <RotateCcw size={15} /> 초기화
          </button>
        </div>
      </div>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              {columns.map((c) => (
                <th key={c.header} className={`${thCls} ${c.align === 'right' ? 'text-right' : ''} whitespace-nowrap`}>
                  {c.header}
                </th>
              ))}
              <th className={`${thCls} whitespace-nowrap`}>관리</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className={trCls}>
                {columns.map((c) => (
                  <td
                    key={c.header}
                    className={`${tdBase} ${c.align === 'right' ? 'tabular text-right' : ''} ${c.nowrap ? 'whitespace-nowrap' : ''}`}
                  >
                    {c.render(row)}
                  </td>
                ))}
                <td className={`${tdBase} whitespace-nowrap`}>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      title="상세"
                      onClick={() => setDetail(row)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-text-strong"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      title="삭제"
                      onClick={() => confirmDelete(row)}
                      className="rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                    >
                      <Trash2 size={15} />
                    </button>
                    {attachments(row).length > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[12px] text-text-faint">
                        <Paperclip size={12} /> {attachments(row).length}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="py-10 text-center text-[13px] text-text-faint">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
          {hasSum && rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-border bg-hover">
                {columns.map((c, i) => (
                  <td
                    key={c.header}
                    className={`${tdBase} font-bold text-text-strong ${c.align === 'right' ? 'tabular text-right' : ''}`}
                  >
                    {c.sum
                      ? rows.reduce((acc, r) => acc + (Number(c.sum?.(r) ?? 0) || 0), 0).toLocaleString()
                      : i === 0
                        ? '합계'
                        : ''}
                  </td>
                ))}
                <td className={tdBase} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/50 p-6">
          <div className="w-full max-w-[620px] rounded-[14px] border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-text-strong">
                <Icon size={17} className="text-primary" /> 상세
              </h2>
              <button type="button" onClick={() => setDetail(null)} className="text-text-sub hover:text-text-strong">
                <X size={18} />
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
              {detailFields(detail).map((f) => (
                <div key={f.label} className="flex justify-between gap-3 border-b border-border pb-1.5">
                  <dt className="text-[12.5px] text-text-sub">{f.label}</dt>
                  <dd className="text-[13px] font-semibold text-text-strong">{f.value ?? '-'}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-5">
              <h3 className="mb-2 text-[13px] font-semibold text-text-mid">첨부 서류</h3>
              {attachments(detail).length === 0 ? (
                <p className="text-[13px] text-text-faint">첨부된 서류가 없습니다.</p>
              ) : (
                <ul className="space-y-1">
                  {attachments(detail).map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-[13px]">
                      <Paperclip size={12} className="text-text-faint" />
                      <span className="text-text-sub">{a.fileType ?? '문서'}</span>
                      {a.webViewLink ? (
                        <a href={a.webViewLink} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                          {a.fileName ?? '파일'}
                        </a>
                      ) : (
                        <span className="text-text">{a.fileName ?? '파일'}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
