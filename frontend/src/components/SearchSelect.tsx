import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { inputCls } from './ui/classes';

export interface SearchOption {
  /** 실제로 저장·전송되는 값 */
  value: string;
  /** 화면에 보이는 이름 */
  label: string;
}

interface Props {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  /** 아무것도 고르지 않았을 때 보이는 문구 */
  placeholder?: string;
  /** 목록에 없는 값도 그대로 검색어로 쓴다(폐기물 배출자·운반자·처리자, 결과 내 검색). */
  allowFree?: boolean;
  className?: string;
  ariaLabel?: string;
}

// 목록이 길어지면 드롭다운은 끝까지 훑어야 한다. 글자를 치면 그 글자가 든 항목만
// 남기고, 클릭이나 방향키+엔터로 고른다. 검색 필터를 이 한 가지 방식으로 통일한다.
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = '전체',
  allowFree = false,
  className = '',
  ariaLabel,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // 고른 값의 이름을 칸에 보여 준다. 목록에 없는 값(자유 입력)은 값 자체가 이름이다.
  const selectedLabel = useMemo(() => {
    if (!value) return '';
    return options.find((o) => o.value === value)?.label ?? value;
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  // 바깥을 누르면 닫고, 고르지 않은 입력은 되돌린다.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      commitOrClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  });

  const commitOrClose = () => {
    if (allowFree) {
      const typed = query.trim();
      if (typed !== selectedLabel) onChange(typed);
    }
    setOpen(false);
    setQuery('');
  };

  const pick = (opt: SearchOption) => {
    onChange(opt.value);
    setOpen(false);
    setQuery('');
  };

  const clear = () => {
    onChange('');
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      setActive((i) => {
        const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
        if (next < 0) return filtered.length - 1;
        if (next >= filtered.length) return 0;
        return next;
      });
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[active]) {
        pick(filtered[active]);
        return;
      }
      commitOrClose();
      return;
    }
    if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={boxRef} className="relative min-w-0">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        value={open ? query : selectedLabel}
        placeholder={selectedLabel || placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          if (!open) setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        // 탭으로 다음 칸에 가도 적은 값이 확정되어야 한다. 목록 클릭은 mousedown에서 먼저 처리된다.
        onBlur={() => {
          window.setTimeout(() => {
            if (boxRef.current?.contains(document.activeElement)) return;
            commitOrClose();
          }, 0);
        }}
        className={`${inputCls} ${value ? 'pr-14' : 'pr-8'} px-2 ${className}`}
      />

      {/* 고른 값을 지우는 X — 값이 있을 때만 보인다. */}
      {value && (
        <button
          type="button"
          tabIndex={-1}
          title="선택 해제"
          onClick={clear}
          className="absolute right-7 top-1/2 -translate-y-1/2 rounded-[4px] p-0.5 text-text-faint hover:text-text-strong"
        >
          <X size={13} />
        </button>
      )}
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-faint"
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+2px)] z-40 max-h-[240px] overflow-y-auto rounded-[8px] border border-border bg-card py-1 shadow-lg"
        >
          {/* 조건을 비우는 줄 — 드롭다운의 '전체'와 같은 자리다. */}
          <li>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clear}
              className="block w-full px-3 py-1.5 text-left text-[12.5px] text-text-faint hover:bg-hover"
            >
              {placeholder}
            </button>
          </li>
          {filtered.map((o, i) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className={`block w-full px-3 py-1.5 text-left text-[13px] ${
                  i === active ? 'bg-hover text-text-strong' : 'text-text'
                } ${o.value === value ? 'font-bold' : ''}`}
              >
                {o.label}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-[12.5px] text-text-faint">
              {allowFree ? '일치하는 항목이 없습니다 — 입력한 값으로 검색합니다.' : '일치하는 항목이 없습니다.'}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
