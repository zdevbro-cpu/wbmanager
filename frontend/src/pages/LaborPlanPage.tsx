import { CalendarRange } from 'lucide-react';
import { useProjects } from '../hooks/useMasters';
import { LaborPlanBoard } from '../components/LaborPlanBoard';
import { pageTitleCls } from '../components/ui/classes';

// 현장인력계획 — 프로젝트별로 어느 구간에 어떤 인력을 얼마나 쓸지 잡고,
// 공수표에 쌓인 실행과 견준다. 공수표 안 탭이 아니라 그 자체로 보는 화면이다.
export function LaborPlanPage() {
  const { projects } = useProjects();

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <CalendarRange size={20} className="text-primary" />
        <h1 className={pageTitleCls}>현장인력계획</h1>
        <span className="ml-1 text-[13px] text-text-sub">계획 대비 실제 투입 공수</span>
      </div>

      <LaborPlanBoard projects={projects} defaultProjectId="" />
    </div>
  );
}
