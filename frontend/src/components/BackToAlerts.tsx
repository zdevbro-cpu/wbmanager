import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

// 알림 현황에서 바로가기로 넘어온 경우에만 돌아갈 길을 띄운다(요청 2026-11-13).
// 주소에 ?from=alerts 가 붙어 있을 때만 나타나므로, 메뉴로 들어온 평소에는 보이지 않는다.
export function BackToAlerts() {
  const [params] = useSearchParams();
  if (params.get('from') !== 'alerts') return null;

  return (
    <Link
      to="/admin-alerts"
      className="mb-3 inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-text-mid hover:bg-hover"
    >
      <ArrowLeft size={15} /> 알림 현황으로 돌아가기
    </Link>
  );
}
