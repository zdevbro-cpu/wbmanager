import { useCallback, useEffect, useState } from 'react';
import { Settings, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { pageTitleCls, sectionTitleCls, cardPadCls, primaryBtnCls, inputCls } from '../components/ui/classes';
import type { CommonCode } from '../types';

// 화면에 항상 노출할 그룹 — 각 등록 화면에서 실제로 쓰이는 값 목록
const GROUPS: { group: string; hint: string }[] = [
  { group: '배출자', hint: '폐기물 입고·반출 등록' },
  { group: '운반자', hint: '폐기물 반출 등록' },
  { group: '상차지', hint: '출고·폐기물 반출 등록' },
  { group: '하차지', hint: '폐기물 입고 등록' },
  { group: '차종', hint: '전 계근 등록 화면' },
  { group: '거래 구분', hint: '출고/이동/보류/기타' },
  { group: '제출서류 종류', hint: '첨부파일 분류' },
  { group: '자격증 종류', hint: '임직원 자격사항' },
  { group: '교육 과정', hint: '임직원 교육이력' },
  { group: '부서', hint: '임직원 등록' },
  { group: '직급', hint: '임직원 등록' },
];

export function CommonCodePage({ embedded = false }: { embedded?: boolean }) {
  const [codes, setCodes] = useState<CommonCode[]>([]);

  const reload = useCallback(() => {
    api.get<CommonCode[]>('/api/common-codes?includeInactive=true').then(setCodes);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // DB에만 있는 그룹도 빠뜨리지 않고 뒤에 붙여 보여준다.
  const extraGroups = [...new Set(codes.map((c) => c.group))]
    .filter((g) => !GROUPS.some((x) => x.group === g))
    .map((g) => ({ group: g, hint: '' }));

  return (
    <div>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Settings size={20} className="text-primary" />
          <h1 className={pageTitleCls}>공통코드 관리</h1>
        </div>
      )}

      <p className="mb-4 text-[13px] text-text-sub">
        등록 화면에서 반복 입력되는 값(배출자·운반자·상차지·차종·구분 등)을 이곳에서 한 번에 관리합니다. 여기에 등록한 항목이
        각 등록 폼의 선택 목록으로 표시됩니다.
      </p>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
        {[...GROUPS, ...extraGroups].map(({ group, hint }) => (
          <GroupCard
            key={group}
            group={group}
            hint={hint}
            rows={codes.filter((c) => c.group === group)}
            reload={reload}
          />
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
        <button type="submit" className={primaryBtnCls}>
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
