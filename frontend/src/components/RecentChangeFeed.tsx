import { useEffect, useState } from 'react';
import { History, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { kstStamp } from '../lib/datetime';
import { sectionTitleCls, tableWrapCls, thCls, tdCls, trCls } from './ui/classes';

// 최근 변경 피드 — 어제 누가 무엇을 등록·수정했는지.
// 관리자 이력 화면에 들어가야만 알 수 있던 것을 같이 일하는 사람 모두가 보게 한다.
interface FeedItem {
  id: string;
  action: 'create' | 'update' | 'delete';
  target: string;
  summary: string | null;
  who: string;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = { create: '등록', update: '수정', delete: '삭제' };
// 로그 줄 위 조건·쪽 이동 단추는 표보다 작게 두어 표가 주인공이 되게 한다.
const feedCtlCls =
  'rounded-[8px] border border-border bg-input px-2 py-1 text-[12.5px] text-input-text';

const ACTION_TONE: Record<string, string> = {
  create: 'bg-success/15 text-success',
  update: 'bg-primary/15 text-primary',
  delete: 'bg-danger/15 text-danger',
};

// 대상 — 사용자가 쓰는 메뉴 이름 그대로 적는다.
// 'inbounds' 같은 경로 조각으로는 어느 화면에서 일어난 일인지 알 수 없다.
const TARGET_LABEL: Record<string, string> = {
  inbounds: '입고(반입) 현황',
  'waste-inbounds': '폐기물 수집·운반 현황',
  outbounds: '출고 현황',
  'waste-outbounds': '폐기물 반출 현황',
  sortings: '재고 이동(선별)',
  inventory: '재고 / 재고평가',
  ledger: '통합 원장 조회',
  transports: '운반비 관리',
  labors: '공수표 관리',
  'labor-plans': '현장인력계획',
  attendances: '공수표 관리 · 출퇴근',
  reports: '보고서 보관함',
  pnl: '손익보고서',
  projects: '프로젝트 관리',
  waste: '폐기물 / 올바로 관리',
  alerts: '알림 현황',
  assets: '자산 관리(차량·장비)',
  'asset-maintenances': '자산 관리 · 정비',
  vehicles: '자산 관리 · 차량',
  employees: '임직원 관리',
  'external-drivers': '임직원 관리 · 외부 운전자',
  dms: '문서 관리',
  attachments: '첨부 파일',
  ocr: '계량증명서 판독',
  vendors: '시스템 관리 · 거래처 마스터',
  'item-masters': '시스템 관리 · 품목 마스터',
  'common-codes': '시스템 관리 · 공통코드',
  'external-vehicles': '시스템 관리 · 계근 차량',
  'document-types': '시스템 관리 · 문서 분류',
  'app-users': '시스템 관리 · 사용자 승인',
  auth: '시스템 관리 · 사용자 승인',
  'audit-logs': '시스템 관리 · 최근 변경 로그',
};

// 같은 '등록'이라도 화면에 따라 부르는 말이 다르다 — 보고서는 발행이고, 첨부는 올리는 것이다.
const VERB: Record<string, Record<string, string>> = {
  reports: { create: '발행', delete: '삭제' },
  attachments: { create: '첨부', delete: '첨부 삭제' },
  ocr: { create: '판독' },
};
const verbOf = (target: string, action: string) =>
  VERB[target]?.[action] ?? ACTION_LABEL[action] ?? action;

export function RecentChangeFeed() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === 'admin';

  const [items, setItems] = useState<FeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [days, setDays] = useState(2);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [size, setSize] = useState(30);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);

  // 날짜 구간을 적으면 그 구간이 기준이 된다. 비우면 위의 기간 선택을 따른다.
  const ranged = Boolean(from || to);
  const query = `${ranged ? `from=${from}&to=${to}` : `days=${days}`}&size=${size}&offset=${page * size}`;

  const load = () => {
    api
      .get<{ items: FeedItem[]; total: number } | FeedItem[]>(`/api/audit-logs/recent?paged=1&${query}`)
      .then((r) => {
        // 서버가 아직 이전 판이면 배열만 온다. 그때는 받은 것을 한 쪽으로 보여 준다.
        const list = Array.isArray(r) ? r : r.items;
        setItems(list);
        setTotal(Array.isArray(r) ? list.length : r.total);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, from, to, size, page]);

  // 조건이 바뀌면 첫 쪽으로 돌아간다. 3쪽을 보다 조건을 좁히면 빈 쪽이 나온다.
  useEffect(() => {
    setPage(0);
  }, [days, from, to, size]);

  const lastPage = Math.max(Math.ceil(total / size) - 1, 0);

  const remove = async () => {
    if (!from || !to) {
      alert('삭제할 기간의 시작일과 종료일을 모두 지정해 주세요.');
      return;
    }
    if (!confirm(`${from} ~ ${to} 구간의 변경 로그 ${total}건을 삭제합니다.\n삭제한 로그는 되돌릴 수 없습니다. 진행할까요?`)) return;

    setBusy(true);
    try {
      const r = await api.del<{ count: number }>(`/api/audit-logs/recent?from=${from}&to=${to}`);
      alert(`${r.count}건을 삭제했습니다.`);
      setPage(0);
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <History size={16} className="text-primary" />
        <h2 className={`${sectionTitleCls} text-[15px]`}>최근 변경 로그</h2>
        <span className="text-[13px] text-text-sub">{total}건</span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            disabled={ranged}
            className={`${feedCtlCls} disabled:opacity-40`}
          >
            <option value={1}>오늘</option>
            <option value={2}>어제부터</option>
            <option value={7}>최근 7일</option>
            <option value={30}>최근 30일</option>
          </select>

          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={feedCtlCls} />
          <span className="text-text-faint">~</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={feedCtlCls} />
          {ranged && (
            <button
              type="button"
              onClick={() => {
                setFrom('');
                setTo('');
              }}
              className={`${feedCtlCls} text-text-sub`}
            >
              구간 해제
            </button>
          )}

          <select value={size} onChange={(e) => setSize(Number(e.target.value))} className={feedCtlCls}>
            <option value={30}>30건씩</option>
            <option value={50}>50건씩</option>
            <option value={100}>100건씩</option>
          </select>

          {isAdmin && (
            <button
              type="button"
              onClick={remove}
              disabled={busy || !from || !to || total === 0}
              className={`${feedCtlCls} inline-flex items-center gap-1 text-danger disabled:opacity-40`}
            >
              <Trash2 size={13} /> 구간 삭제
            </button>
          )}
        </div>
      </div>

      <div className={tableWrapCls}>
        <table className="w-full border-collapse">
          <thead>
            {/* 내용이 주인공이다. 나머지 칸은 글자가 들어갈 만큼만 준다. */}
            <tr className="border-y border-border">
              <th className={`${thCls} w-[124px]`}>일시</th>
              <th className={`${thCls} w-[72px]`}>구분</th>
              <th className={`${thCls} w-[190px]`}>대상</th>
              <th className={thCls}>내용</th>
              <th className={`${thCls} w-[88px]`}>사용자</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={trCls}>
                <td className={`${tdCls} tabular whitespace-nowrap`}>{kstStamp(i.createdAt).replace(/^\d{4}-/, '')}</td>
                <td className={tdCls}>
                  <span className={`rounded-[5px] px-1.5 py-0.5 text-[11px] font-bold ${ACTION_TONE[i.action] ?? ''}`}>
                    {verbOf(i.target, i.action)}
                  </span>
                </td>
                <td className={`${tdCls} whitespace-nowrap`}>{TARGET_LABEL[i.target] ?? i.target}</td>
                <td className={`${tdCls} break-words text-text-strong`}>{i.summary ?? '-'}</td>
                <td className={`${tdCls} whitespace-nowrap`}>{i.who}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[13px] text-text-faint">
                  이 기간에 등록·수정된 건이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {total > size && (
        <div className="mt-2 flex items-center justify-center gap-2 text-[12.5px] text-text-sub">
          <button
            type="button"
            onClick={() => setPage((n) => Math.max(n - 1, 0))}
            disabled={page === 0}
            className={`${feedCtlCls} inline-flex items-center gap-0.5 disabled:opacity-40`}
          >
            <ChevronLeft size={13} /> 이전
          </button>
          <span className="tabular">
            {page + 1} / {lastPage + 1} 쪽
          </span>
          <button
            type="button"
            onClick={() => setPage((n) => Math.min(n + 1, lastPage))}
            disabled={page >= lastPage}
            className={`${feedCtlCls} inline-flex items-center gap-0.5 disabled:opacity-40`}
          >
            다음 <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
