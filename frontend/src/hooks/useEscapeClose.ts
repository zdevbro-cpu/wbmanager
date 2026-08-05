import { useEffect, useRef } from 'react';

// 모달/패널이 열려 있는 동안 ESC로 닫고, 닫힐 때 열기 전 있던 곳(목록의 버튼·행)으로 포커스를 되돌린다.
export function useEscapeClose(onClose: () => void) {
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener.current?.focus?.();
    };
  }, [onClose]);
}
