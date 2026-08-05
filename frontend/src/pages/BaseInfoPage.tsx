import { Layers, ListChecks } from 'lucide-react';
import { MasterManagementPage } from './MasterManagementPage';
import { CommonCodePage } from './CommonCodePage';
import { sectionTitleCls } from '../components/ui/classes';

// 기준정보 관리 — 등록 화면의 선택 목록을 한 화면에서 모두 관리한다.
// 위는 거래에 ID로 참조되어 집계 축이 되는 마스터, 아래는 값 목록(공통코드).
export function BaseInfoPage() {
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-1 flex items-center gap-1.5">
          <Layers size={17} className="text-primary" />
          <h2 className={sectionTitleCls}>마스터</h2>
        </div>
        <p className="mb-4 text-[13px] text-text-sub">
          손익·재고 집계의 축이 되는 기준정보입니다. 거래가 ID로 참조하므로 이름을 고쳐도 과거 거래에 그대로 반영되며,
          사용 중인 항목은 삭제하지 않는 것이 안전합니다.
        </p>
        <MasterManagementPage embedded />
      </section>

      <section className="border-t border-border pt-7">
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
