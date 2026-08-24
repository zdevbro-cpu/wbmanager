import { useEffect, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { inputCls } from './classes';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value?: string;
  onChange?: (e: { target: { value: string } }) => void;
};

// 날짜 입력 — 숫자만 쳐서 넣는다. 260816 → 2026-08-16, 20260816도 같다.
// 달력이 필요하면 오른쪽 아이콘으로 연다. 저장되는 값은 늘 YYYY-MM-DD.
export function DateField({ value = '', onChange, className, disabled, ...rest }: Props) {
  const [text, setText] = useState(value);
  const picker = useRef<HTMLInputElement>(null);

  // 바깥에서 값이 바뀌면(초기화·수정폼 로딩) 화면 글자도 따라간다.
  useEffect(() => {
    setText(value ?? '');
  }, [value]);

  const emit = (v: string) => onChange?.({ target: { value: v } });

  // 6자리는 20yy, 8자리는 그대로. 그 밖은 아직 완성되지 않은 입력으로 본다.
  const parse = (raw: string) => {
    const d = raw.replace(/\D/g, '');
    if (d.length === 6) return `20${d.slice(0, 2)}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
    if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
    return null;
  };

  const handleText = (raw: string) => {
    setText(raw);
    const parsed = parse(raw);
    if (parsed) {
      setText(parsed);
      emit(parsed);
      return;
    }
    if (raw.trim() === '') emit('');
  };

  // 포커스가 빠질 때 정리한다 — 형식에 맞으면 그대로, 아니면 마지막 정상값으로 되돌린다.
  const handleBlur = () => {
    if (text.trim() === '') return;
    const parsed = parse(text) ?? (/^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null);
    if (parsed) {
      setText(parsed);
      emit(parsed);
    } else {
      setText(value ?? '');
    }
  };

  return (
    <div className="relative">
      <input
        {...rest}
        type="text"
        inputMode="numeric"
        value={text}
        disabled={disabled}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => handleText(e.target.value)}
        onBlur={handleBlur}
        placeholder={rest.placeholder ?? '260816'}
        className={`${className ?? inputCls} pr-8`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => picker.current?.showPicker?.()}
        aria-label="달력 열기"
        className="absolute top-1/2 right-2 -translate-y-1/2 text-text-faint hover:text-text-strong disabled:opacity-50"
      >
        <CalendarDays size={15} />
      </button>
      {/* 달력 선택용 — 화면에는 보이지 않고 아이콘을 누르면 열린다. */}
      <input
        ref={picker}
        type="date"
        value={value ?? ''}
        onChange={(e) => {
          setText(e.target.value);
          emit(e.target.value);
        }}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-2 bottom-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}
