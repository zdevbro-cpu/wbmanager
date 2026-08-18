import { FolderOpen } from 'lucide-react';
import { pageTitleCls, cardPadCls } from '../components/ui/classes';

// DMS(문서 관리) — 영역 자리만 잡아 둔다. 화면이 준비되면 이 안을 채운다.
export function DmsPage() {
  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <FolderOpen size={20} className="text-primary" />
        <h1 className={pageTitleCls}>문서 관리 (DMS)</h1>
      </div>

      <div className={`${cardPadCls} py-16 text-center`}>
        <FolderOpen size={32} className="mx-auto mb-3 text-text-faint" />
        <p className="text-[14px] font-bold text-text-strong">준비 중입니다.</p>
        <p className="mt-1.5 text-[13px] text-text-sub">
          계약서·인허가·증빙 문서를 한곳에서 관리하는 영역입니다. 다룰 문서 종류가 정해지면 화면을 붙입니다.
        </p>
      </div>
    </div>
  );
}
