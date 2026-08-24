import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { inputCls } from './ui/classes';
import { SearchSelect } from './SearchSelect';

interface Option {
  value: string;
  label: string;
  isTemporary?: boolean;
}

interface MasterSelectProps {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  onQuickCreate: (name: string) => Promise<string>;
  placeholder?: string;
}

// 거래처/품목 등 마스터 데이터를 드롭다운으로 선택. 목록에 없으면 임시 등록 후 바로 선택된다. (S-ELHMAG)
export function MasterSelect({ label, options, value, onChange, onQuickCreate, placeholder }: MasterSelectProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const handleQuickCreate = async () => {
    if (!newName.trim()) return;
    const id = await onQuickCreate(newName.trim());
    onChange(id);
    setCreating(false);
    setNewName('');
  };

  return (
    <div className="mb-3.5">
      <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">{label}</label>
      {!creating ? (
        <div className="flex gap-2">
          <SearchSelect
            ariaLabel={label}
            options={options.map((o) => ({ value: o.value, label: o.isTemporary ? `${o.label} (임시)` : o.label }))}
            value={value}
            onChange={onChange}
            placeholder={placeholder ?? '검색 또는 선택'}
          />
          <select value={value} onChange={(e) => onChange(e.target.value)} className="hidden">
            <option value="">{placeholder ?? '선택'}</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
                {opt.isTemporary ? ' (임시)' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-[38px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[8px] border border-border px-3 text-[12.5px] font-semibold text-text-mid hover:bg-hover"
          >
            <Plus size={14} /> 마스터에 등록
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="새 이름 입력"
            className={inputCls}
          />
          <button
            type="button"
            onClick={handleQuickCreate}
            className="inline-flex h-[38px] shrink-0 items-center rounded-[8px] bg-primary px-3 text-[12.5px] font-bold text-white hover:brightness-110"
          >
            임시 등록
          </button>
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[8px] border border-border text-text-sub hover:bg-hover"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
