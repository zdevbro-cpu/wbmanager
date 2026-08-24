import { useCallback, useEffect, useState } from 'react';
import { Settings, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { pageTitleCls, sectionTitleCls, cardPadCls, primaryBtnCls, inputCls } from '../components/ui/classes';
import type { CommonCode } from '../types';

// 화면에 항상 노출할 그룹 — 각 등록 화면에서 실제로 쓰이는 값 목록
// 공통코드가 15종까지 늘어 한 화면에 늘어놓으면 찾기 어렵다.
// 쓰이는 업무별로 묶어 탭으로 나눈다. hint는 그 값이 어느 등록 화면에 뜨는지다.
const CATEGORIES: { id: string; label: string; groups: { group: string; hint: string }[] }[] = [
  {
    id: 'weighing',
    label: '계근 · 입출고',
    groups: [
      { group: '배출자', hint: '폐기물 입고·반출 등록' },
      { group: '처리자', hint: '폐기물 입고·반출 등록' },
      { group: '작업자', hint: '공수 등록' },
      { group: '운반자', hint: '폐기물 반출 등록' },
      { group: '상차지', hint: '출고·폐기물 반출 등록' },
      { group: '하차지', hint: '폐기물 입고 등록' },
    ],
  },
  {
    id: 'asset',
    label: '자산 · 정비',
    groups: [
      { group: '자산 분류', hint: '자산 등록·조회' },
      { group: '정비 구분', hint: '정비 등록·조회' },
      { group: '일정 구분', hint: '자산 일정(보험·검사 등)' },
    ],
  },
  {
    id: 'employee',
    label: '임직원',
    groups: [
      { group: '자격증 종류', hint: '임직원 자격사항' },
      { group: '교육 과정', hint: '임직원 교육이력' },
      { group: '부서', hint: '임직원 등록' },
      { group: '직급', hint: '임직원 등록' },
    ],
  },
  {
    id: 'etc',
    label: '프로젝트 · 기타',
    groups: [
      { group: '정산주기', hint: '프로젝트 등록' },
      { group: '제출서류 종류', hint: '첨부파일 분류' },
      { group: '차종', hint: '전 계근 등록 화면' },
      { group: '거래 구분', hint: '출고/이동/보류/기타' },
    ],
  },
];

const KNOWN_GROUPS = CATEGORIES.flatMap((c) => c.groups.map((g) => g.group));

export function CommonCodePage({ embedded = false }: { embedded?: boolean }) {
  const [codes, setCodes] = useState<CommonCode[]>([]);

  const [tab, setTab] = useState(CATEGORIES[0].id);

  const reload = useCallback(() => {
    api.get<CommonCode[]>('/api/common-codes?includeInactive=true').then(setCodes);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // 정의에 없는 그룹이 DB에 있으면 기타 탭 끝에 붙여 빠뜨리지 않는다.
  const extraGroups = [...new Set(codes.map((c) => c.group))]
    .filter((g) => !KNOWN_GROUPS.includes(g))
    .map((g) => ({ group: g, hint: '' }));

  const categories = CATEGORIES.map((c) =>
    c.id === 'etc' ? { ...c, groups: [...c.groups, ...extraGroups] } : c,
  );
  const current = categories.find((c) => c.id === tab) ?? categories[0];
  const countOf = (group: string) => codes.filter((c) => c.group === group).length;

  return (
    <div>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Settings size={20} className="text-primary" />
          <h1 className={pageTitleCls}>공통코드 관리</h1>
        </div>
      )}

      {!embedded && (
        <p className="mb-4 text-[13px] text-text-sub">
          등록 화면에서 반복 입력되는 값(배출자·운반자·상차지·차종·구분 등)을 이곳에서 한 번에 관리합니다. 여기에 등록한
          항목이 각 등록 폼의 선택 목록으로 표시됩니다.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const total = c.groups.reduce((sum, g) => sum + countOf(g.group), 0);
          const active = c.id === current.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setTab(c.id)}
              className={[
                'rounded-[9px] border px-3 py-1.5 text-[13px] font-bold transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-text-strong'
                  : 'border-border text-text-sub hover:bg-hover hover:text-text-strong',
              ].join(' ')}
            >
              {c.label} <span className="ml-1 font-semibold text-text-faint">{total}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {current.groups.map(({ group, hint }) => (
          <GroupCard key={group} group={group} hint={hint} rows={codes.filter((c) => c.group === group)} reload={reload} />
        ))}
      </div>
    </div>
  );
}

function GroupCard({
  group,
  hint,
  rows,
  reload,
}: {
  group: string;
  hint: string;
  rows: CommonCode[];
  reload: () => void;
}) {
  const [label, setLabel] = useState('');
  const [error, setError] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setError('');
    try {
      await api.post('/api/common-codes', { group, label: label.trim() });
      setLabel('');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : '추가 실패');
    }
  };

  const move = async (id: string, direction: 'up' | 'down') => {
    await api.patch(`/api/common-codes/${id}/move`, { direction });
    reload();
  };

  const remove = async (id: string) => {
    await api.del(`/api/common-codes/${id}`);
    reload();
  };

  return (
    <div className={cardPadCls}>
      <h2 className={sectionTitleCls}>{group}</h2>
      {hint && <p className="mb-2 mt-0.5 text-[12px] text-text-faint">{hint}</p>}

      <form onSubmit={handleAdd} className="mb-3 mt-2 flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="새 항목 입력"
          className={inputCls}
        />
        <button type="submit" className={`${primaryBtnCls} shrink-0 justify-center whitespace-nowrap px-5`}>
          추가
        </button>
      </form>

      {error && <p className="mb-2 text-[12px] text-danger">{error}</p>}

      <div className="max-h-[240px] space-y-1.5 overflow-y-auto">
        {rows.length === 0 && <p className="text-[12px] text-text-faint">등록된 항목이 없습니다.</p>}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-1.5 rounded-[8px] border border-border px-3 py-1.5">
            <span className="flex-1 text-[13px] text-text">{row.label}</span>
            <button type="button" onClick={() => move(row.id, 'up')} className="text-text-faint hover:text-text-strong" title="위로">
              <ChevronUp size={14} />
            </button>
            <button type="button" onClick={() => move(row.id, 'down')} className="text-text-faint hover:text-text-strong" title="아래로">
              <ChevronDown size={14} />
            </button>
            <button type="button" onClick={() => remove(row.id)} className="text-danger hover:brightness-110" title="삭제">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
