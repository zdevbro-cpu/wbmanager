import { useNavigate } from 'react-router-dom';
import { Lock, LogOut, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AREAS, type Area } from '../lib/areas';

// 시작 화면 — 로그인 후 들어갈 영역을 카드로 고른다.
export function EntryPage() {
  const { appUser, logout } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const navigate = useNavigate();

  const open = (area: Area) => {
    const first = area.groups[0]?.items[0]?.to;
    if (first) navigate(first);
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="flex h-[60px] items-center justify-between border-b border-border-top bg-sidebar px-7">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-primary text-sm font-extrabold text-white">
            W
          </div>
          <div>
            <div className="text-[15px] font-extrabold text-text-strong">wbmanager</div>
            <div className="text-[11px] text-[#5f7ba6]">원방 스크랩 업무지원</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[12.5px] text-text-sub">
            {appUser?.email} {isAdmin && <span className="text-primary">(관리자)</span>}
          </span>
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-1 text-[12.5px] font-semibold text-text-sub hover:text-text-strong"
          >
            <LogOut size={14} /> 로그아웃
          </button>
        </div>
      </header>

      {/* 화면 한가운데에 정사각형 카드를 나란히 둔다. */}
      <main className="flex flex-1 items-center justify-center px-7 py-12">
        <div className="w-full max-w-[860px] text-center">
          <h1 className="text-[26px] font-extrabold text-text-strong">업무 영역을 선택하세요</h1>
          <p className="mt-1.5 text-[13.5px] text-text-sub">
            선택한 영역의 메뉴만 표시됩니다. 좌측 상단에서 언제든 다시 고를 수 있습니다.
          </p>

          {/* 1열 SWMS · DMS · AMS, 2열 HRM · SYS 로 서도록 3열 격자에 둔다. */}
          <div className="mt-10 grid grid-cols-1 justify-items-center gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {AREAS.map((area) => {
              const locked = (area.adminOnly && !isAdmin) || !area.ready;
              const Icon = area.icon;
              return (
                <button
                  key={area.id}
                  type="button"
                  disabled={locked}
                  onClick={() => open(area)}
                  className={[
                    'group relative flex aspect-square w-full max-w-[220px] flex-col items-center justify-center rounded-[16px] border bg-card p-5 text-center transition-colors',
                    locked
                      ? 'cursor-not-allowed border-border opacity-55'
                      : 'border-border hover:border-primary hover:bg-hover',
                  ].join(' ')}
                >
                  <span className="absolute top-3 right-3">
                    {locked ? (
                      <Lock size={15} className="text-text-faint" />
                    ) : (
                      <ArrowRight size={16} className="text-text-faint group-hover:text-primary" />
                    )}
                  </span>

                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-[14px]"
                    style={{ backgroundColor: `${area.accent}1f`, color: area.accent }}
                  >
                    <Icon size={26} />
                  </div>

                  <div className="mt-4 text-[11px] font-bold tracking-[1px] text-text-faint">{area.acronym}</div>
                  <div className="mt-0.5 text-[16px] font-extrabold text-text-strong">{area.title}</div>
                  <p className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-text-sub">{area.summary}</p>

                  {locked && (
                    <span className="mt-2 text-[12px] font-semibold text-text-faint">
                      {!area.ready ? '준비 중' : '관리자 전용'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
