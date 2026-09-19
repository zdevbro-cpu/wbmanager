import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Download, Lock, LockOpen, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { downloadFile } from '../lib/download';
import { useEmployees, useCommonCodes } from '../hooks/useMasters';
import { attendManDays, attendDays, earlyLeaveManDays } from '../lib/attend';
import { useAuth } from '../context/AuthContext';
import { FormModal } from './FormModal';
import { SearchSelect } from './SearchSelect';
import { NumberInput } from './ui/NumberInput';
import { employmentRank } from '../pages/EmployeeManagementPage';
import { formatNumber } from '../lib/number';
import type { Employee } from '../types';
import { kstToday, kstStamp } from '../lib/datetime';
import {
  cardCls,
  cardPadCls,
  primaryBtnCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  thNumCls,
  tdNumCls,
} from './ui/classes';
import type { Project } from '../types';

export interface LaborRow {
  id: string;
  projectId: string;
  workDate: string;
  employeeId?: string | null;
  workerName?: string | null;
  workerType?: string | null;
  attendCode?: string | null;
  totalManDays?: string | null;
  unitCost?: string | null;
  laborCost?: string | null;
  mealCost?: string | null;
  toolCost?: string | null;
  fuelCost?: string | null;
  suppliesCost?: string | null;
  totalAmount?: string | null;
  isDraft?: boolean;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInDistance?: number | null;
  faceVerdict?: string | null;
}

const num = (v?: string | null) => (v == null || v === '' ? 0 : Number(v));
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';

// 근태를 칸 하나에 담기 위한 한 글자. 공통코드에 회사가 이름을 더 넣으면 앞 글자를 쓴다.
const ATTEND_SHORT: Record<string, string> = {
  출근: '출',
  반차: '반',
  특근: '특',
  연차: '연',
  병가: '병',
  결근: '결',
  휴무: '휴',
};
const ATTEND_TONE: Record<string, string> = {
  출근: 'text-success',
  특근: 'text-primary',
  반차: 'text-warning',
  연차: 'text-warning',
  병가: 'text-warning',
  결근: 'text-danger',
  휴무: 'text-text-faint',
};

// 왼쪽(이름·구분)과 오른쪽(개인 합계)은 자리에 붙여 두고 날짜만 스크롤한다.
// 스무 날쯤 보이는 폭을 기준으로 삼았다 — 한 달을 다 보려면 가운데를 밀면 된다.
const NAME_W = 116;
const TYPE_W = 72;
const SUM_W = 68;
// 합계 열 여섯을 오른쪽부터 붙인다 — 맨 끝이 그 사람의 가로합계다.
const SUM_COLS = 6;
const sumRight = (i: number) => (SUM_COLS - 1 - i) * SUM_W;
const stickyL = 'sticky z-20 bg-card';
const stickyR = 'sticky z-20 bg-card';

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

function daysOf(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}
function weekdayOf(month: string, day: number) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, day).getDay();
}
function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const dayKey = (month: string, day: number) => `${month}-${String(day).padStart(2, '0')}`;
// 임직원에 연결된 줄은 그 사람으로, 이름만 있는 옛 줄은 이름으로 찾는다.
const keyOf = (r: LaborRow) => r.employeeId || `name:${r.workerName ?? '이름 없음'}`;

// 월 근태·공수 — 행이 사람, 열이 날짜다. 한 칸이 그 사람의 하루다.
// 급여를 계산하지는 않는다. 근태와 공수를 모아 월로 집계하는 데까지다.
export function LaborMonthGrid({ projects, defaultProjectId }: { projects: Project[]; defaultProjectId: string }) {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const { employees } = useEmployees();
  const { labels: attendCodes } = useCommonCodes('근태코드');

  const [month, setMonth] = useState(kstToday().slice(0, 7));
  const [rows, setRows] = useState<LaborRow[]>([]);
  const [closed, setClosed] = useState(false);
  const [editing, setEditing] = useState<{ employeeId: string; name: string; type: string; date: string } | null>(null);
  // 이름만 남은 줄을 임직원에 붙이는 중
  const [linking, setLinking] = useState<{ name: string; days: number } | null>(null);
  const [linkTo, setLinkTo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<LaborRow[]>(`/api/labors?month=${month}`).then(setRows);
    api
      .get<{ status: string }>(`/api/labors/settlement?month=${month}`)
      .then((s) => setClosed(s.status === 'closed'));
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const days = daysOf(month);

  // 한 사람의 하루를 빠르게 찾기 위한 자리표.
  const cells = useMemo(() => {
    const map = new Map<string, LaborRow>();
    for (const r of rows) {
      map.set(`${keyOf(r)}|${(r.workDate ?? '').slice(0, 10)}`, r);
    }
    return map;
  }, [rows]);

  // 고용 구분과 상관없이 모두 담는다 — 정규직·계약직·일용직·프리랜서·현장직·타사직원.
  // 임직원에 연결되지 않은 지난 자료는 이름만으로 한 줄을 만들어 합계에서 빠지지 않게 한다.
  const people = useMemo(() => {
    const tally = (mine: LaborRow[]) => ({
      presentDays: mine.reduce((sum, r) => sum + attendDays(r.attendCode), 0),
      manDays: mine.reduce((s, r) => s + num(r.totalManDays), 0),
      laborCost: mine.reduce((s, r) => s + num(r.laborCost), 0),
      mealCost: mine.reduce((s, r) => s + num(r.mealCost), 0),
      etcCost: mine.reduce((s, r) => s + num(r.toolCost) + num(r.fuelCost) + num(r.suppliesCost), 0),
      draft: mine.filter((r) => r.isDraft).length,
    });

    const linked = employees.map((e) => ({
      key: e.id,
      employeeId: e.id,
      name: e.name,
      type: e.employmentType ?? '정규직',
      ...tally(rows.filter((r) => r.employeeId === e.id)),
    }));

    const loose = new Map<string, LaborRow[]>();
    for (const r of rows) {
      if (r.employeeId) continue;
      const name = r.workerName ?? '이름 없음';
      loose.set(name, [...(loose.get(name) ?? []), r]);
    }
    const unlinked = [...loose.entries()].map(([name, mine]) => ({
      key: `name:${name}`,
      employeeId: '',
      name,
      type: mine[0]?.workerType ?? '-',
      ...tally(mine),
    }));

    // 정규직 → 계약직 → 일용직 → 아르바이트 차례로 세우고, 같은 구분 안에서는 이름순이다.
    return [...linked, ...unlinked].sort(
      (a, b) => employmentRank(a.type) - employmentRank(b.type) || a.name.localeCompare(b.name),
    );
  }, [employees, rows]);

  const totals = useMemo(
    () => ({
      presentDays: people.reduce((s, p) => s + p.presentDays, 0),
      manDays: people.reduce((s, p) => s + p.manDays, 0),
      laborCost: people.reduce((s, p) => s + p.laborCost, 0),
      mealCost: people.reduce((s, p) => s + p.mealCost, 0),
      etcCost: people.reduce((s, p) => s + p.etcCost, 0),
    }),
    [people],
  );

  const settle = async (to: 'close' | 'open') => {
    const label = to === 'close' ? '마감' : '마감 열기';
    if (to === 'close' && !window.confirm(`${month}을 마감합니다.\n마감하면 이 달은 고칠 수 없고, 출퇴근 셀카는 삭제됩니다. 진행할까요?`)) return;
    if (to === 'open' && !window.confirm(`${month} 마감을 엽니다.\n삭제된 셀카는 돌아오지 않습니다. 진행할까요?`)) return;
    setBusy(true);
    try {
      const r = await api.post<{ purgedPhotos?: number }>(`/api/labors/settlement/${to}`, { month });
      if (to === 'close') alert(`${month} 마감했습니다.${r.purgedPhotos ? ` 셀카 ${r.purgedPhotos}장을 삭제했습니다.` : ''}`);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : `${label}하지 못했습니다.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className={`${cardCls} mb-3 flex flex-wrap items-center gap-2 px-3 py-2`}>
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className={`${outlineBtnCls} px-2`}>
          <ChevronLeft size={15} />
        </button>
        <input
          type="month"
          value={month}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className={inputCls}
          style={{ width: 150 }}
          aria-label="정산 월"
        />
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className={`${outlineBtnCls} px-2`}>
          <ChevronRight size={15} />
        </button>

        <span className="ml-2 text-[13px] text-text-sub">
          출근 {formatNumber(totals.presentDays)}일 · {formatNumber(totals.manDays)}공수
        </span>
        {closed ? (
          <span className="inline-flex items-center gap-1 rounded-[6px] bg-danger/15 px-2 py-0.5 text-[12px] font-bold text-danger">
            <Lock size={12} /> 마감됨
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-[6px] bg-success/15 px-2 py-0.5 text-[12px] font-bold text-success">
            <LockOpen size={12} /> 열림
          </span>
        )}

        {/* 월 공수표 — A4 가로 한 장에 그 달 전체가 들어간다. */}
        <button
          type="button"
          onClick={() =>
            downloadFile(
              `/api/labors/export?month=${month}${defaultProjectId ? `&projectId=${defaultProjectId}` : ''}`,
              `${month}_공수표.xlsx`,
            )
          }
          className={`${outlineBtnCls} ml-auto`}
        >
          <Download size={15} /> 엑셀 다운로드
        </button>

        {isAdmin && (
          <button
            type="button"
            disabled={busy}
            onClick={() => settle(closed ? 'open' : 'close')}
            className={closed ? outlineBtnCls : primaryBtnCls}
          >
            {closed ? '마감 열기' : '이 달 마감'}
          </button>
        )}
      </div>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-max min-w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={`${thCls} ${stickyL} left-0 whitespace-nowrap`} style={{ width: NAME_W, minWidth: NAME_W }}>
                이름
              </th>
              <th
                className={`${thCls} ${stickyL} whitespace-nowrap`}
                style={{ left: NAME_W, width: TYPE_W, minWidth: TYPE_W }}
              >
                구분
              </th>
              {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                const w = weekdayOf(month, d);
                return (
                  <th
                    key={d}
                    className={`w-[28px] px-0 py-1.5 text-center text-[11px] font-bold ${
                      w === 0 ? 'text-danger' : w === 6 ? 'text-primary' : 'text-text-sub'
                    }`}
                  >
                    {d}
                    <span className="block text-[10px] font-normal opacity-70">{WEEK[w]}</span>
                  </th>
                );
              })}
              {['출근', '공수', '인건비', '식대', '기타', '합계'].map((label, i) => (
                <th
                  key={label}
                  className={`${thNumCls} ${stickyR} whitespace-nowrap`}
                  style={{ right: sumRight(i), width: SUM_W, minWidth: SUM_W }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.key} className="border-b border-border">
                <td
                  className={`${stickyL} left-0 whitespace-nowrap px-3 py-1.5 text-[13px] font-semibold text-text-strong`}
                  style={{ width: NAME_W, minWidth: NAME_W }}
                >
                  {p.name}
                  {!p.employeeId &&
                    (isAdmin ? (
                      <button
                        type="button"
                        onClick={() => {
                          setLinkTo('');
                          setLinking({ name: p.name, days: p.presentDays + p.manDays });
                        }}
                        className="ml-1 text-[11px] font-bold text-warning underline"
                        title="임직원에 연결하면 달력에서 고칠 수 있습니다"
                      >
                        미연결
                      </button>
                    ) : (
                      <span className="ml-1 text-[11px] font-normal text-text-faint">미연결</span>
                    ))}
                  {p.draft > 0 && <span className="ml-1 text-[11px] font-bold text-warning">임시 {p.draft}</span>}
                </td>
                <td
                  className={`${stickyL} whitespace-nowrap px-3 py-1.5 text-[12.5px] text-text-sub`}
                  style={{ left: NAME_W, width: TYPE_W, minWidth: TYPE_W }}
                >
                  {p.type}
                </td>
                {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                  const date = dayKey(month, d);
                  const cell = cells.get(`${p.key}|${date}`);
                  const w = weekdayOf(month, d);
                  return (
                    <td
                      key={d}
                      className={`p-0 text-center ${w === 0 || w === 6 ? 'bg-hover/40' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          p.employeeId && setEditing({ employeeId: p.employeeId, name: p.name, type: p.type, date })
                        }
                        disabled={!p.employeeId}
                        title={`${date} ${p.name}`}
                        className={`h-[26px] w-full text-[12px] font-bold hover:bg-hover ${
                          cell?.attendCode ? ATTEND_TONE[cell.attendCode] ?? 'text-text' : 'text-text'
                        } ${cell?.isDraft ? 'underline decoration-warning decoration-2 underline-offset-2' : ''}`}
                      >
                        {cell?.attendCode
                          ? ATTEND_SHORT[cell.attendCode] ?? cell.attendCode.slice(0, 1)
                          : cell && num(cell.totalManDays) > 0
                            ? formatNumber(cell.totalManDays)
                            : ''}
                      </button>
                    </td>
                  );
                })}
                {[p.presentDays, p.manDays, p.laborCost, p.mealCost, p.etcCost, p.laborCost + p.mealCost + p.etcCost].map((v, i) => (
                  <td
                    key={i}
                    className={`${tdNumCls} ${stickyR} ${i === SUM_COLS - 1 ? 'font-extrabold text-text-strong' : ''}`}
                    style={{ right: sumRight(i), width: SUM_W, minWidth: SUM_W }}
                  >
                    {v ? formatNumber(v) : ''}
                  </td>
                ))}
              </tr>
            ))}
            {people.length === 0 && (
              <tr>
                <td colSpan={days + 8} className="py-10 text-center text-[13px] text-text-faint">
                  임직원 관리에 등록된 사람이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-hover/40">
              <td
                className={`${stickyL} left-0 px-3 py-2 text-[13px] font-extrabold text-text-strong`}
                style={{ width: NAME_W, minWidth: NAME_W }}
              >
                합계
              </td>
              <td className={stickyL} style={{ left: NAME_W, width: TYPE_W, minWidth: TYPE_W }} />
              <td colSpan={days} />
              {[
                totals.presentDays,
                totals.manDays,
                totals.laborCost,
                totals.mealCost,
                totals.etcCost,
                totals.laborCost + totals.mealCost + totals.etcCost,
              ].map((v, i) => (
                <td
                  key={i}
                  className={`${tdNumCls} ${stickyR} font-extrabold`}
                  style={{ right: sumRight(i), width: SUM_W, minWidth: SUM_W }}
                >
                  {v ? formatNumber(v) : ''}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-2 text-[12px] text-text-faint">
        칸을 누르면 그 사람의 하루를 적습니다. 정규직은 근태(출·반·특·연·병·결·휴), 그 외는 공수를 넣습니다.
        정규직·계약직·일용직·프리랜서·현장직·타사직원을 모두 담습니다 — 임직원 관리에 등록된 사람이 여기에 나옵니다.
        {people.some((p) => !p.employeeId) &&
          ' 임직원에 연결되지 않은 지난 자료는 이름만으로 아래에 두었고, 합계에는 들어갑니다(칸은 고칠 수 없습니다).'}
      </p>

      {linking && (
        <FormModal title={`「${linking.name}」 임직원에 연결`} icon={CalendarDays} onClose={() => setLinking(null)}>
          <div className={cardPadCls}>
            <p className="mb-3 text-[13px] leading-relaxed text-text-sub">
              이름만 적혀 있는 지난 공수를 임직원에 붙입니다. 붙이면 달력에서 고칠 수 있고, 그 사람의 월 합계로 들어갑니다.
              <b className="text-text-strong"> 이 달({month})의 「{linking.name}」 줄만</b> 바뀝니다.
            </p>
            <label className={labelCls}>어느 임직원인가요</label>
            <SearchSelect
              ariaLabel="임직원"
              options={employees.map((e) => ({ value: e.id, label: `${e.name}${e.department ? ` (${e.department})` : ''}` }))}
              value={linkTo}
              onChange={setLinkTo}
            />
            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
              <button type="button" onClick={() => setLinking(null)} className={outlineBtnCls}>
                취소
              </button>
              <button
                type="button"
                disabled={!linkTo || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await api.put<{ count: number }>('/api/labors/link', {
                      workerName: linking.name,
                      employeeId: linkTo,
                      month,
                    });
                    alert(`${r.count}건을 연결했습니다.`);
                    setLinking(null);
                    load();
                  } catch (e) {
                    alert(e instanceof Error ? e.message : '연결하지 못했습니다.');
                  } finally {
                    setBusy(false);
                  }
                }}
                className={primaryBtnCls}
              >
                연결
              </button>
            </div>
          </div>
        </FormModal>
      )}

      {editing && (
        <DayEditor
          key={`${editing.employeeId}|${editing.date}`}
          info={editing}
          person={employees.find((e) => e.id === editing.employeeId)}
          row={cells.get(`${editing.employeeId}|${editing.date}`)}
          projects={projects}
          defaultProjectId={defaultProjectId}
          attendCodes={attendCodes}
          closed={closed}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// 하루 한 칸 — 근태 또는 공수, 그리고 그 사람에게 그날 든 비용.
function DayEditor({
  info,
  person,
  row,
  projects,
  defaultProjectId,
  attendCodes,
  closed,
  onClose,
  onSaved,
}: {
  info: { employeeId: string; name: string; type: string; date: string };
  person?: Employee;
  row?: LaborRow;
  projects: Project[];
  defaultProjectId: string;
  attendCodes: string[];
  closed: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const regular = info.type === '정규직';
  const [f, setF] = useState({
    projectId: row?.projectId ?? defaultProjectId ?? '',
    attendCode: row?.attendCode ?? (regular ? '출근' : ''),
    totalManDays: row?.totalManDays ?? (regular ? '' : '1'),
    unitCost: row?.unitCost ?? person?.unitCost ?? '',
    mealCost: row?.mealCost ?? person?.mealCost ?? '',
    suppliesCost: row?.suppliesCost ?? person?.etcCost ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof f>) => setF({ ...f, ...patch });

  // 출퇴근 시각 — 잘못 누른 것을 바로잡을 때만 보낸다. 손대지 않으면 보내지 않는다.
  const hm = (iso?: string | null) => (iso ? kstStamp(iso).slice(11, 16) : '');
  const [times, setTimes] = useState({ in: hm(row?.checkInAt), out: hm(row?.checkOutAt) });
  const [timesDirty, setTimesDirty] = useState(false);
  const setTime = (k: 'in' | 'out', v: string) => {
    setTimes((t) => ({ ...t, [k]: v }));
    setTimesDirty(true);
  };
  const isoOf = (v: string) => (v ? `${info.date}T${v}:00+09:00` : null);

  // 이미 있는 기록을 고칠 때는 사유를 받는다(리뷰회의 2-4 · 2-5). 고친 이력도 여기서 본다.
  const [reason, setReason] = useState('');
  const [edits, setEdits] = useState<
    { id: string; reason: string; before: Record<string, unknown>; after: Record<string, unknown>; editedBy: string; createdAt: string }[]
  >([]);
  useEffect(() => {
    if (!row?.id) return;
    api.get<typeof edits>(`/api/labors/${row.id}/edits`).then(setEdits).catch(() => setEdits([]));
  }, [row?.id]);

  // 조퇴 — 출퇴근 시각이 있으면 일한 시간으로 공수를 미리 보여 준다.
  const earlyPreview = earlyLeaveManDays(
    timesDirty ? isoOf(times.in) : (row?.checkInAt ?? null),
    timesDirty ? isoOf(times.out) : (row?.checkOutAt ?? null),
  );

  // 공수 × 단가 = 인건비. 급여를 내는 것이 아니라 그날 든 비용을 적는 것이다.
  const laborCost = Math.round(Number(f.totalManDays || 0) * Number(f.unitCost || 0));
  const codes = attendCodes.length ? attendCodes : ['출근', '반차', '특근', '연차', '병가', '결근', '휴무'];

  const save = async () => {
    if (!f.projectId) {
      setError('프로젝트를 고르세요.');
      return;
    }
    // 공수는 0.25 단위(1 · 0.75 · 0.5 · 0.25). 서버도 같은 규칙으로 막는다.
    if (f.totalManDays && Math.abs(Number(f.totalManDays) * 4 - Math.round(Number(f.totalManDays) * 4)) > 1e-9) {
      setError('공수는 0.25 단위로 적어 주세요 (예: 1 · 0.75 · 0.5 · 0.25).');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.put('/api/labors/cell', {
        employeeId: info.employeeId,
        workerName: info.name,
        workerType: info.type,
        workDate: info.date,
        projectId: f.projectId,
        attendCode: f.attendCode || null,
        totalManDays: f.totalManDays ? Number(f.totalManDays) : null,
        unitCost: f.unitCost ? Number(f.unitCost) : null,
        laborCost: laborCost || null,
        mealCost: f.mealCost ? Number(f.mealCost) : null,
        suppliesCost: f.suppliesCost ? Number(f.suppliesCost) : null,
        totalAmount: laborCost + Number(f.mealCost || 0) + Number(f.suppliesCost || 0) || null,
        isDraft: false,
        ...(timesDirty ? { checkInAt: isoOf(times.in), checkOutAt: isoOf(times.out) } : {}),
        ...(reason.trim() ? { editReason: reason.trim() } : {}),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!row || !window.confirm(`${info.date} ${info.name} 기록을 지울까요?`)) return;
    setBusy(true);
    try {
      await api.del(`/api/labors/${row.id}`);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : '지우지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal title={`${info.date} · ${info.name}`} icon={CalendarDays} onClose={onClose}>
      <div className={cardPadCls}>
        {closed && (
          <p className="mb-3 rounded-[8px] bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
            마감된 달입니다. 고치려면 마감을 먼저 열어야 합니다.
          </p>
        )}
        {row?.isDraft && (
          <p className="mb-3 rounded-[8px] bg-warning/10 px-3 py-2 text-[12.5px] text-warning">
            현장에서 올라온 임시저장입니다. 확인해 저장하면 정상등록으로 바뀝니다.
          </p>
        )}
        {(row?.checkInAt || row?.checkOutAt) && (
          <p className="mb-3 text-[12.5px] text-text-sub">
            출근 {row.checkInAt ? kstStamp(row.checkInAt).slice(11, 16) : '-'} · 퇴근{' '}
            {row.checkOutAt ? kstStamp(row.checkOutAt).slice(11, 16) : '-'}
            {row.checkInDistance != null && ` · 현장에서 ${formatNumber(row.checkInDistance)}m`}
          </p>
        )}

        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
          <div className="col-span-2">
            <label className={labelCls}>프로젝트</label>
            <SearchSelect
              ariaLabel="프로젝트"
              options={projects.map((p) => ({ value: p.id, label: p.roundName }))}
              value={f.projectId}
              onChange={(v) => set({ projectId: v })}
            />
          </div>

          {regular ? (
            <div className="col-span-2">
              <label className={labelCls}>근태</label>
              <div className="flex flex-wrap gap-1.5">
                {codes.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => set({ attendCode: c })}
                    className={`rounded-[8px] border px-3 py-1.5 text-[13px] font-semibold ${
                      f.attendCode === c
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border text-text-sub hover:bg-hover'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[12px] text-text-faint">
                고른 근태만큼 공수가 자동으로 잡힙니다 — 출근 1 · 반차 0.5 · 특근 1.5 · 연차/병가/결근/휴무 0 · 조퇴는
                8시간 기준 일한 시간(점심 12~13시 제외)을 0.25 단위로 올림
                {f.attendCode && (
                  <span className="ml-1 font-bold text-text-strong">
                    (지금:{' '}
                    {f.attendCode === '조퇴'
                      ? earlyPreview == null
                        ? '출퇴근 시각이 있어야 계산'
                        : `${formatNumber(earlyPreview)}공수`
                      : `${formatNumber(attendManDays(f.attendCode) ?? 0)}공수`}
                    )
                  </span>
                )}
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>공수 (0.25 단위)</label>
                <NumberInput value={f.totalManDays} onChange={(v) => set({ totalManDays: v })} decimals={2} />
                <div className="mt-1.5 flex gap-1">
                  {['1', '0.75', '0.5', '0.25'].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set({ totalManDays: v })}
                      className={`rounded-[6px] border px-2 py-0.5 text-[12px] font-bold ${
                        Number(f.totalManDays) === Number(v)
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border text-text-sub hover:bg-hover'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>단가(원)</label>
                <NumberInput value={f.unitCost} onChange={(v) => set({ unitCost: v })} />
              </div>
            </>
          )}

          <div>
            <label className={labelCls}>식대(원)</label>
            <NumberInput value={f.mealCost} onChange={(v) => set({ mealCost: v })} />
          </div>
          <div>
            <label className={labelCls}>기타비용(원)</label>
            <NumberInput value={f.suppliesCost} onChange={(v) => set({ suppliesCost: v })} />
          </div>

          {!regular && (
            <p className="col-span-2 text-[12.5px] text-text-sub">
              인건비: <span className="tabular font-bold text-text-strong">{formatNumber(laborCost)}</span> 원 (공수 × 단가)
            </p>
          )}
        </div>

        {row && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              <div>
                <label className={labelCls}>출근 시각</label>
                <input
                  type="time"
                  value={times.in}
                  onChange={(e) => setTime('in', e.target.value)}
                  className={inputCls}
                  aria-label="출근 시각"
                />
              </div>
              <div>
                <label className={labelCls}>퇴근 시각</label>
                <input
                  type="time"
                  value={times.out}
                  onChange={(e) => setTime('out', e.target.value)}
                  className={inputCls}
                  aria-label="퇴근 시각"
                />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>수정 사유 (이미 저장된 기록을 고칠 때 필수)</label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="예: 퇴근을 출근으로 잘못 눌러 바로잡음"
                  className={inputCls}
                />
                <p className="mt-1 text-[11.5px] text-text-faint">
                  출퇴근 시각을 비우면 그 기록을 지웁니다. 고치기 전 값은 아래 이력에 그대로 남습니다.
                </p>
              </div>
            </div>
            {edits.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[12.5px] font-bold text-text-strong">수정 이력</div>
                <ul className="max-h-[140px] space-y-1 overflow-y-auto text-[12px] text-text-sub">
                  {edits.map((ed) => (
                    <li key={ed.id} className="rounded-[6px] bg-input px-2 py-1">
                      <span className="tabular">{kstStamp(ed.createdAt).slice(5, 16)}</span> · {ed.editedBy} · {ed.reason}
                      <div className="text-text-faint">
                        {Object.keys(ed.after)
                          .map((k) => `${EDIT_LABEL[k] ?? k} ${showEdit(k, ed.before[k])} → ${showEdit(k, ed.after[k])}`)
                          .join(' · ')}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
          {row && (
            <button type="button" onClick={remove} disabled={busy || closed} className={`${outlineBtnCls} mr-auto text-danger`}>
              <Trash2 size={15} /> 지우기
            </button>
          )}
          <button type="button" onClick={onClose} className={outlineBtnCls}>
            취소
          </button>
          <button type="button" onClick={save} disabled={busy || closed} className={primaryBtnCls}>
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </FormModal>
  );
}

// 수정 이력 — 칸 이름과 값을 사람이 읽는 말로 바꾼다.
const EDIT_LABEL: Record<string, string> = {
  projectId: '프로젝트',
  attendCode: '근태',
  totalManDays: '공수',
  checkInAt: '출근',
  checkOutAt: '퇴근',
};

function showEdit(k: string, v: unknown) {
  if (v == null || v === '') return '없음';
  if (k === 'checkInAt' || k === 'checkOutAt') return kstStamp(String(v)).slice(11, 16);
  if (k === 'projectId') return '(바뀜)';
  return String(v);
}
