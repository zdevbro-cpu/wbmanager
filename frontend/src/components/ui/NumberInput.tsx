import { formatNumberInput, parseNumberInput } from '../../lib/number';
import { inputCls } from './classes';

interface Props {
  /** 원시 숫자 문자열. 화면에는 세 자리마다 끊어 보여 주고 이 값은 콤마 없이 유지한다. */
  value: string;
  onChange: (raw: string) => void;
  /** 허용 소수 자릿수. 중량은 3, 금액·계기판은 0. */
  decimals?: number;
  placeholder?: string;
  required?: boolean;
  className?: string;
  'aria-label'?: string;
  title?: string;
}

// type="number"는 콤마를 담을 수 없어 자릿수 구분이 불가능하다.
// text로 두고 입력 즉시 포맷하되, 부모에는 콤마를 뺀 값만 넘긴다.
export function NumberInput({
  value,
  onChange,
  decimals = 0,
  placeholder,
  required,
  className,
  ...rest
}: Props) {
  return (
    <input
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      value={formatNumberInput(value)}
      onChange={(e) => onChange(parseNumberInput(e.target.value, decimals))}
      placeholder={placeholder}
      required={required}
      className={className ?? `${inputCls} text-right tabular`}
      {...rest}
    />
  );
}
