import { ListChecks } from 'lucide-react';
import { CommonCodePage } from './CommonCodePage';
import { sectionTitleCls } from '../components/ui/classes';

// 기준정보 관리 — 등록 화면에서 반복 입력되는 값 목록(공통코드)만 다룬다.
// 마스터는 목록이 길어지면 공통코드가 아래로 밀려서 별도 탭으로 분리했다.
export function BaseInfoPage() {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-1 flex items-center gap-1.5">
          <ListChecks size={17} className="text-primary" />
          <h2 className={sectionTitleCls}>공통코드</h2>
        </div>
        <p className="mb-4 text-[13px] text-text-sub">
          등록 화면에서 반복 입력되는 값 목록입니다. 기록 시점의 문자열로 저장되므로, 여기서 지워도 과거 데이터는 그대로
          남고 선택 목록에서만 사라집니다.
        </p>
        <CommonCodePage embedded />
      </section>
    </div>
  );
}
