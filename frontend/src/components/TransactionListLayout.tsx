import { useEffect, useState, type ReactNode } from 'react';
import { Plus, Paperclip, Eye, Trash2, X, RotateCcw, Download, type LucideIcon } from 'lucide-react';
import { useProjects, useItemMasters, useVehicles, useEmployees } from '../hooks/useMasters';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { downloadFile } from '../lib/download';
import { api } from '../api/client';
import { SearchSelect, type SearchOption } from './SearchSelect';
import { DocumentPreview, type PreviewDoc } from './DocumentPreview';
import { API_BASE_URL } from '../api/client';
import { pageTitleCls, primaryBtnCls, outlineBtnCls, inputCls, cardCls, tableWrapCls, thCls, trCls } from './ui/classes';
import type { Attachment } from '../types';
import { DateField } from './ui/DateField';

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
  olbaro: string;
  dischargerName: string;
  transporterName: string;
  processorName: string;
}

export const EMPTY_FILTER: TxFilter = {
  from: '',
  to: '',
  projectId: '',
  vehicleType: '',
  vehicleNo: '',
  driverName: '',
  itemCode: '',
  olbaro: '',
  dischargerName: '',
  transporterName: '',
  processorName: '',
};

// 화면마다 쓰는 필터가 다르다. 지정하지 않으면 기존 6종을 그대로 보여 준다.
export type FilterKey =
  | 'projectId'
  | 'date'
  | 'itemCode'
  | 'vehicleType'
  | 'vehicleNo'
  | 'driverName'
  | 'olbaro'
  | 'dischargerName'
  | 'transporterName'
  | 'processorName';

const DEFAULT_FILTER_KEYS: FilterKey[] = ['projectId', 'date', 'itemCode', 'vehicleType', 'vehicleNo', 'driverName'];

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
  /** 엑셀 내보내기 대상 — /api/list-exports/{exportType} 로 현재 필터가 그대로 전달된다. */
  exportType?: 'inbound' | 'waste_inbound' | 'outbound_sale' | 'waste_outbound';
  exportName?: string;
  /** 이 화면에서 쓸 검색 필터. 생략하면 프로젝트·기간·제품명·차종·차량번호·운전자. */
  filterKeys?: FilterKey[];
  /** 검색 후보 보강 — 마스터에 없는 실제 입력값(배출자·운반자·처리자·수기 차량번호 등)을 화면이 넘긴다. */
  suggestions?: Partial<Record<FilterKey, string[]>>;
  /** 상세에서 수정 폼을 띄운다. 저장이 끝나면 done()을 불러 창을 닫고 목록으로 돌아간다. */
  editForm?: (row: T, done: () => void) => ReactNode;
  /** 첨부를 지운 뒤 목록을 다시 읽는다. */
  reload?: () => void;
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
  exportType,
  exportName,
  filterKeys = DEFAULT_FILTER_KEYS,
  suggestions,
  editForm,
  reload,
  emptyText,
}: Props<T>) {
  const { projects } = useProjects();
  const { items } = useItemMasters();
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();
  const [detail, setDetail] = useState<T | null>(null);
  const [detailEdit, setDetailEdit] = useState(false);
  // 계량증명서를 보려고 상세까지 들어가지 않게, 목록에서 바로 연다.
  const [previewFiles, setPreviewFiles] = useState<PreviewDoc[] | null>(null);
  // 지운 첨부는 창을 닫지 않고 목록에서만 빼 준다. 수정 중에 창이 닫히면 입력하던 값이 사라진다.
  const [removedFiles, setRemovedFiles] = useState<string[]>([]);

  // 수정 후 목록이 새로 오면 열려 있는 상세도 새 값으로 갈아 끼운다.
  // 이걸 하지 않으면 저장은 됐는데 상세에는 옛 값이 남아 반영이 안 된 것처럼 보인다.
  useEffect(() => {
    if (!detail) return;
    const fresh = rows.find((r) => rowKey(r) === rowKey(detail));
    if (fresh && fresh !== detail) setDetail(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  // 마스터 목록과 화면에 실제로 들어온 값을 합쳐 후보로 쓴다. 수기로 넣은
  // 차량번호처럼 마스터에 없는 값도 검색할 수 있어야 한다.
  const merge = (base: SearchOption[], key: FilterKey): SearchOption[] => {
    const extra = (suggestions?.[key] ?? []).filter((v) => v && !base.some((o) => o.value === v));
    return [...base, ...[...new Set(extra)].sort().map((v) => ({ value: v, label: v }))];
  };
  const projectOptions = projects.map((p) => ({ value: p.id, label: p.roundName }));
  const itemOptions = merge(items.map((i) => ({ value: i.itemCode, label: i.itemName })), 'itemCode');
  const vehicleTypeOptions = merge(VEHICLE_TYPES.map((t) => ({ value: t, label: t })), 'vehicleType');
  const vehicleNoOptions = merge(vehicles.map((v) => ({ value: v.vehicleNo, label: v.vehicleNo })), 'vehicleNo');
  const driverOptions = merge(employees.map((e) => ({ value: e.name, label: e.name })), 'driverName');
  const nameOptions = (key: FilterKey) => merge([], key);

  // 첨부는 앱이 중계해 받는다 — 드라이브 권한이 없는 사용자도 볼 수 있어야 한다.
  const filesOf = (row: T): PreviewDoc[] =>
    attachments(row).map((a) => ({
      id: a.id,
      title: a.fileName ?? a.fileType ?? '첨부',
      fileName: a.fileName,
      byteSize: null,
      contentUrl: `${API_BASE_URL}/api/attachments/${a.id}/content`,
      facts: [{ label: '종류', value: a.fileType ?? '문서' }],
    }));

  const hasSum = columns.some((c) => c.sum);
  const tdBase = 'px-3 py-1.5 text-[13px] text-text';
  const set = (patch: Partial<TxFilter>) => setFilter({ ...filter, ...patch });

  // 화면에 걸린 조건 그대로 내려받아, 파일과 화면이 어긋나지 않게 한다.
  const exportExcel = () => {
    if (!exportType) return;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
    downloadFile(`/api/list-exports/${exportType}?${params.toString()}`, `${exportName ?? exportType}.xlsx`).catch(
      (err: unknown) => window.alert(err instanceof Error ? err.message : '엑셀 내려받기에 실패했습니다.'),
    );
  };

  // 잘못 붙인 증빙을 지운다. 파일은 드라이브 휴지통으로 가므로 되살릴 수 있다.
  const removeAttachment = async (a: Attachment) => {
    if (!window.confirm(`'${a.fileName ?? '파일'}'을(를) 첨부에서 지울까요?
파일은 드라이브 휴지통으로 갑니다.`)) return;
    try {
      await api.del(`/api/attachments/${a.id}`);
      setRemovedFiles((prev) => [...prev, a.id]);
      reload?.();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '첨부를 지우지 못했습니다.');
    }
  };

  // 지운 것을 뺀 현재 첨부
  const liveFiles = (row: T) => attachments(row).filter((a) => !removedFiles.includes(a.id));

  const confirmDelete = (row: T) => {
    if (window.confirm('이 건을 삭제하시겠습니까? 재고 반영분도 함께 취소됩니다.')) onDelete(row);
  };

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Icon size={20} className="text-primary" />
        <h1 className={pageTitleCls}>{title}</h1>
        <span className="ml-1 text-[13px] text-text-sub">{rows.length}건</span>
        <div className="ml-auto flex items-center gap-2">
          {exportType && (
            <button type="button" onClick={exportExcel} className={`${outlineBtnCls} whitespace-nowrap`}>
              <Download size={15} /> 엑셀 다운로드
            </button>
          )}
          <button type="button" onClick={onAdd} className={primaryBtnCls}>
            <Plus size={15} /> {addLabel}
          </button>
        </div>
      </div>

      {/* 필터 바 — 1줄 배치. 각 항목에 라벨을 달아 좁아져도 무엇을 고르는지 알 수 있게 한다. */}
      <div className={`${cardCls} mb-4 p-4`}>
        <div
          className="grid items-end gap-2"
          style={{
            gridTemplateColumns: `repeat(${filterKeys.length + (filterKeys.includes('date') ? 1 : 0)},minmax(0,1fr)) auto`,
          }}
        >
          <div className={filterKeys.includes('projectId') ? '' : 'hidden'}>
            <FilterLabel>프로젝트</FilterLabel>
            <SearchSelect
              ariaLabel="프로젝트"
              options={projectOptions}
              value={filter.projectId}
              onChange={(v) => set({ projectId: v })}
            />
          </div>

          <div className={filterKeys.includes('date') ? 'col-span-2' : 'hidden'}>
            <FilterLabel>{dateLabel}</FilterLabel>
            <div className="flex items-center gap-1">
              <DateField
                value={filter.from}
                onChange={(e) => set({ from: e.target.value })}
                className={`${inputCls} px-2`}
              />
              <span className="shrink-0 text-text-faint">~</span>
              <DateField
                value={filter.to}
                onChange={(e) => set({ to: e.target.value })}
                className={`${inputCls} px-2`}
              />
            </div>
          </div>

          <div className={filterKeys.includes('itemCode') ? '' : 'hidden'}>
            <FilterLabel>제품명</FilterLabel>
            <SearchSelect
              ariaLabel="제품명"
              options={itemOptions}
              value={filter.itemCode}
              onChange={(v) => set({ itemCode: v })}
            />
          </div>

          <div className={filterKeys.includes('vehicleType') ? '' : 'hidden'}>
            <FilterLabel>차종</FilterLabel>
            <SearchSelect
              ariaLabel="차종"
              options={vehicleTypeOptions}
              value={filter.vehicleType}
              onChange={(v) => set({ vehicleType: v })}
            />
          </div>

          <div className={filterKeys.includes('vehicleNo') ? '' : 'hidden'}>
            <FilterLabel>차량번호</FilterLabel>
            <SearchSelect
              ariaLabel="차량번호"
              options={vehicleNoOptions}
              value={filter.vehicleNo}
              onChange={(v) => set({ vehicleNo: v })}
              allowFree
            />
          </div>

          <div className={filterKeys.includes('driverName') ? '' : 'hidden'}>
            <FilterLabel>운전자</FilterLabel>
            <SearchSelect
              ariaLabel="운전자"
              options={driverOptions}
              value={filter.driverName}
              onChange={(v) => set({ driverName: v })}
              allowFree
            />
          </div>

          {filterKeys.includes('olbaro') && (
            <div>
              <FilterLabel>올바로</FilterLabel>
              <select value={filter.olbaro} onChange={(e) => set({ olbaro: e.target.value })} className={`${inputCls} px-2`}>
                <option value="">전체</option>
                <option value="O">O(신고)</option>
                <option value="X">X(미신고)</option>
              </select>
            </div>
          )}

          {filterKeys.includes('dischargerName') && (
            <div>
              <FilterLabel>배출자</FilterLabel>
              <SearchSelect
                ariaLabel="배출자"
                options={nameOptions('dischargerName')}
                value={filter.dischargerName}
                onChange={(v) => set({ dischargerName: v })}
                allowFree
              />
            </div>
          )}

          {filterKeys.includes('transporterName') && (
            <div>
              <FilterLabel>운반자</FilterLabel>
              <SearchSelect
                ariaLabel="운반자"
                options={nameOptions('transporterName')}
                value={filter.transporterName}
                onChange={(v) => set({ transporterName: v })}
                allowFree
              />
            </div>
          )}

          {filterKeys.includes('processorName') && (
            <div>
              <FilterLabel>처리자</FilterLabel>
              <SearchSelect
                ariaLabel="처리자"
                options={nameOptions('processorName')}
                value={filter.processorName}
                onChange={(v) => set({ processorName: v })}
                allowFree
              />
            </div>
          )}

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
                      onClick={() => {
                        setDetailEdit(false);
                        setRemovedFiles([]);
                        setDetail(row);
                      }}
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
                      <button
                        type="button"
                        title={`증빙 보기 — ${attachments(row)
                          .map((a) => a.fileName ?? a.fileType ?? '파일')
                          .join(', ')}`}
                        onClick={() => setPreviewFiles(filesOf(row))}
                        className="inline-flex items-center gap-0.5 rounded-[6px] px-1 py-0.5 text-[12px] text-text-faint hover:bg-hover hover:text-primary"
                      >
                        <Paperclip size={12} /> {attachments(row).length}
                      </button>
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

      {previewFiles && <DocumentPreview items={previewFiles} onClose={() => setPreviewFiles(null)} />}

      {detail && (
        <EscOverlay
          onClose={() => {
            setDetail(null);
            setDetailEdit(false);
          }}
        >
          <div className={`w-full ${detailEdit ? 'max-w-[850px]' : 'max-w-[620px]'} rounded-[14px] border border-border bg-card p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-text-strong">
                <Icon size={17} className="text-primary" /> {detailEdit ? '수정' : '상세'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setDetail(null);
                  setDetailEdit(false);
                }}
                className="text-text-sub hover:text-text-strong"
              >
                <X size={18} />
              </button>
            </div>

            {detailEdit && editForm ? (
              // 저장하면 상세로 되돌리지 않고 창을 닫는다. 같은 화면이 다시 떠 있으면
              // 저장이 됐는지 알기 어렵고, 바뀐 값은 목록에서 바로 보인다.
              <>
                {/* 파일을 갈아 끼우려면 지금 붙어 있는 것이 무엇인지 보여야 한다. */}
                {liveFiles(detail).length > 0 && (
                  <div className="mb-4 rounded-[10px] border border-border p-3">
                    <h3 className="mb-2 text-[13px] font-semibold text-text-mid">현재 첨부</h3>
                    <ul className="space-y-1">
                      {liveFiles(detail).map((a) => (
                        <li key={a.id} className="flex items-center gap-2 text-[13px]">
                          <Paperclip size={12} className="shrink-0 text-text-faint" />
                          <span className="shrink-0 text-text-sub">{a.fileType ?? '문서'}</span>
                          <button
                            type="button"
                            onClick={() => setPreviewFiles(filesOf(detail))}
                            className="truncate text-left text-primary hover:underline"
                          >
                            {a.fileName ?? '파일'}
                          </button>
                          <button
                            type="button"
                            title="첨부에서 지우기"
                            onClick={() => removeAttachment(a)}
                            className="ml-auto shrink-0 rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
                          >
                            <Trash2 size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {editForm(detail, () => {
                  setDetailEdit(false);
                  setDetail(null);
                })}
              </>
            ) : (
              <>
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
              {liveFiles(detail).length === 0 ? (
                <p className="text-[13px] text-text-faint">첨부된 서류가 없습니다.</p>
              ) : (
                <ul className="space-y-1">
                  {liveFiles(detail).map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-[13px]">
                      <Paperclip size={12} className="text-text-faint" />
                      <span className="shrink-0 text-text-sub">{a.fileType ?? '문서'}</span>
                      {/* 드라이브 링크 대신 앱이 중계하는 미리보기로 연다 — 드라이브 권한이 없어도 보인다. */}
                      <button
                        type="button"
                        onClick={() => setPreviewFiles(filesOf(detail))}
                        className="truncate text-left text-primary hover:underline"
                      >
                        {a.fileName ?? '파일'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {editForm && (
              <div className="mt-5 flex justify-end border-t border-border pt-3">
                <button type="button" onClick={() => setDetailEdit(true)} className={primaryBtnCls}>
                  수정
                </button>
              </div>
            )}
              </>
            )}
          </div>
        </EscOverlay>
      )}
    </div>
  );
}

// 상세 오버레이 — 열려 있는 동안만 마운트되므로 여기서 ESC 닫기/포커스 복귀를 건다.
function EscOverlay({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEscapeClose(onClose);

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/50 p-6">{children}</div>
  );
}
