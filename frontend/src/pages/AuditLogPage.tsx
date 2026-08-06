import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert, RotateCcw, Globe } from 'lucide-react';
import { api } from '../api/client';
import { FilterField, DateRangeField } from '../components/FilterField';
import { Badge, type BadgeTone } from '../components/ui/Badge';
import {
  pageTitleCls,
  sectionTitleCls,
  cardCls,
  cardPadCls,
  outlineBtnCls,
  inputCls,
  tableWrapCls,
  thCls,
  tdCls,
  trCls,
} from '../components/ui/classes';
import type { AuditLog, AuditIpSummary } from '../types';

const ACTION_LABEL: Record<string, string> = {
  login: '접속',
  create: '등록',
  update: '수정',
  delete: '삭제',
};

const ACTION_TONE: Record<string, BadgeTone> = {
  login: 'blue',
  create: 'green',
  update: 'amber',
  delete: 'red',
};

const stamp = (v: string) => v.slice(0, 16).replace('T', ' ');

// 접속·변경 이력 — 누가 언제 어디서 무엇을 바꿨는지 확인한다(관리자 전용).
export function AuditLogPage({ embedded = false }: { embedded?: boolean }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [ips, setIps] = useState<AuditIpSummary[]>([]);
  const [action, setAction] = useState('');
  const [ip, setIp] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    if (ip) params.set('ip', ip);
    if (q) params.set('q', q);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api.get<AuditLog[]>(`/api/audit-logs?${params.toString()}`).then(setLogs);
  }, [action, ip, q, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.get<AuditIpSummary[]>('/api/audit-logs/ip-summary?days=30').then(setIps);
  }, []);

  return (
    <div>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <ShieldAlert size={20} className="text-primary" />
          <h1 className={pageTitleCls}>접속·변경 이력</h1>
        </div>
      )}

      <div className={`${cardPadCls} mb-4`}>
        <div className="mb-3 flex items-center gap-1.5">
          <Globe size={16} className="text-text-sub" />
          <h2 className={`${sectionTitleCls} text-[15px]`}>접속 IP 요약 (최근 30일)</h2>
          <span className="ml-1 text-[12px] text-text-faint">
            평소 쓰는 사무실·집 IP 외에 낯선 IP가 있는지 확인하세요
          </span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
          {ips.map((row) => (
            <button
              key={row.ip}
              type="button"
              onClick={() => setIp(row.ip === ip ? '' : row.ip)}
              className={[
                'rounded-[10px] border px-3 py-2 text-left transition-colors',
                row.ip === ip ? 'border-primary bg-nav-active' : 'border-border hover:bg-hover',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="tabular text-[13px] font-bold text-text-strong">{row.ip}</span>
                <span className="tabular text-[12px] text-text-sub">{row.count}건</span>
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-text-faint">
                {row.users.length ? row.users.join(', ') : '계정 미상'}
              </div>
              <div className="tabular mt-0.5 text-[11px] text-text-faint">
                {stamp(row.firstAt)} ~ {stamp(row.lastAt)}
              </div>
            </button>
          ))}
          {ips.length === 0 && <p className="text-[13px] text-text-faint">기록된 접속이 없습니다.</p>}
        </div>
      </div>

      <div
        className={`${cardCls} mb-4 grid items-end gap-3 p-3 [grid-template-columns:280px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto]`}
      >
        <DateRangeField label="기간" from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <FilterField label="구분">
          <select value={action} onChange={(e) => setAction(e.target.value)} className={`${inputCls} px-2`}>
            <option value="">전체</option>
            {Object.entries(ACTION_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="IP">
          <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="예: 112.147.84.76" className={inputCls} />
        </FilterField>
        <FilterField label="검색어">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="계정 / 경로 / 대상" className={inputCls} />
        </FilterField>
        <button
          type="button"
          onClick={() => {
            setAction('');
            setIp('');
            setQ('');
            setFrom('');
            setTo('');
          }}
          className={`${outlineBtnCls} whitespace-nowrap px-3`}
        >
          <RotateCcw size={15} /> 초기화
        </button>
      </div>

      <div className={`${tableWrapCls} overflow-x-auto`}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-y border-border">
              <th className={thCls}>일시</th>
              <th className={thCls}>구분</th>
              <th className={thCls}>계정</th>
              <th className={thCls}>IP</th>
              <th className={thCls}>대상</th>
              <th className={thCls}>경로</th>
              <th className={thCls}>결과</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{stamp(l.createdAt)}</td>
                <td className={tdCls}>
                  <Badge tone={ACTION_TONE[l.action] ?? 'slate'}>{ACTION_LABEL[l.action] ?? l.action}</Badge>
                </td>
                <td className={tdCls}>
                  {l.appUser?.name ?? l.email ?? '-'}
                  {l.appUser?.role === 'admin' && <span className="ml-1 text-[11px] text-primary">관리자</span>}
                </td>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{l.ip ?? '-'}</td>
                <td className={tdCls}>{l.summary ?? '-'}</td>
                <td className={`${tdCls} truncate text-text-sub`} title={l.path ?? ''}>
                  {l.method} {l.path}
                </td>
                <td className={`${tdCls} tabular`}>
                  {l.statusCode && l.statusCode >= 400 ? (
                    <span className="text-danger">{l.statusCode}</span>
                  ) : (
                    l.statusCode
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-[13px] text-text-faint">
                  기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-[12.5px] text-text-faint">
        조회(화면 열람)는 양이 많아 남기지 않고, 접속(로그인)과 등록·수정·삭제만 기록합니다. 최근 500건까지 표시됩니다.
      </p>
    </div>
  );
}
