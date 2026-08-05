import { useState } from 'react';
import { Paperclip, X, Upload, Loader2 } from 'lucide-react';

interface Props {
  label: string;
  files: File[];
  setFiles: (files: File[]) => void;
  /** 파일이 추가될 때 호출. 계량증명서 OCR처럼 추가 처리가 필요한 경우 사용한다. */
  onAdd?: (files: File[]) => void;
  busy?: boolean;
  hint?: string;
}

// 등록 전에 파일을 담아 두는 입력. 첨부는 부모 레코드 id가 있어야 붙일 수 있으므로
// 여기서는 목록만 들고 있다가 등록 성공 후 한꺼번에 업로드한다.
export function StagedFileUpload({ label, files, setFiles, onAdd, busy = false, hint }: Props) {
  const [dragging, setDragging] = useState(false);

  const add = (picked: File[]) => {
    if (!picked.length) return;
    setFiles([...files, ...picked]);
    onAdd?.(picked);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    add(Array.from(e.dataTransfer.files ?? []));
  };

  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">{label}</label>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={[
          'flex h-[86px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed px-3 text-center transition-colors',
          dragging ? 'border-primary bg-nav-hover' : 'border-border hover:border-primary',
        ].join(' ')}
      >
        {busy ? (
          <Loader2 size={18} className="animate-spin text-primary" />
        ) : (
          <Upload size={18} className={dragging ? 'text-primary' : 'text-text-faint'} />
        )}
        <span className="text-[12.5px] text-text-sub">
          {busy ? '인식 중...' : '드래그하거나 클릭해 선택'}
        </span>
        {hint && !busy && <span className="text-[11.5px] text-text-faint">{hint}</span>}
        <input
          type="file"
          multiple
          onChange={(e) => {
            add(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
          className="hidden"
        />
      </label>

      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-[12.5px] text-text-sub">
              <Paperclip size={12} className="shrink-0" />
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                className="shrink-0 text-text-faint hover:text-danger"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
