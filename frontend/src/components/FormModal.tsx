import type { ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface Props {
  title: string;
  icon: LucideIcon;
  onClose: () => void;
  /** 4열 입력 폼처럼 폭이 필요한 화면에서 넓게 연다. */
  wide?: boolean;
  children: ReactNode;
}

// 목록 화면 위에서 등록 폼을 띄우는 모달. 등록 후 목록이 즉시 갱신되도록
// 폼에는 onCreated 콜백을 넘겨 쓴다. ESC로 닫으면 목록의 원래 위치로 포커스가 돌아간다.
export function FormModal({ title, icon: Icon, onClose, wide = false, children }: Props) {
  useEscapeClose(onClose);

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/50 p-6">
      <div className={`w-full ${wide ? 'max-w-[1040px]' : 'max-w-[760px]'} rounded-[14px] border border-border bg-card p-5`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-text-strong">
            <Icon size={17} className="text-primary" /> {title}
          </h2>
          <button type="button" onClick={onClose} className="text-text-sub hover:text-text-strong">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
