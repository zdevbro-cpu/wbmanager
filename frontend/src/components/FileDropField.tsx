import { useState } from 'react';
import { Upload, Paperclip, X } from 'lucide-react';

// 파일 한 개를 고르는 칸 — 끌어다 놓거나 눌러서 고른다.
// 기본 file input은 "선택된 파일 없음"만 덩그러니 남아 어디를 눌러야 할지 알기 어렵다.
// 첨부(StagedFileUpload)와 같은 모양으로 맞춰 문서 등록도 같은 감각으로 쓰게 한다.
export function FileDropField({
  label = '파일',
  file,
  setFile,
  hint,
  accept,
}: {
  label?: string;
  file: File | null;
  setFile: (f: File | null) => void;
  hint?: string;
  accept?: string;
}) {
  const [dragging, setDragging] = useState(false);

  const size = (n: number) => (n < 1024 * 1024 ? `${Math.round(n / 1024)}KB` : `${(n / 1024 / 1024).toFixed(1)}MB`);

  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">{label}</label>

      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const picked = Array.from(e.dataTransfer.files ?? [])[0];
          if (picked) setFile(picked);
        }}
        className={[
          'flex h-[86px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed px-3 text-center transition-colors',
          dragging ? 'border-primary bg-nav-hover' : 'border-border hover:border-primary',
        ].join(' ')}
      >
        <Upload size={18} className={dragging ? 'text-primary' : 'text-text-faint'} />
        <span className="text-[12.5px] text-text-sub">드래그하거나 클릭해 선택</span>
        {hint && <span className="text-[11.5px] text-text-faint">{hint}</span>}
        <input
          type="file"
          accept={accept}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            e.target.value = '';
          }}
          className="hidden"
        />
      </label>

      {file && (
        <div className="mt-2 flex items-center gap-2 rounded-[8px] border border-border px-3 py-1.5 text-[12.5px]">
          <Paperclip size={12} className="shrink-0 text-text-faint" />
          <span className="truncate text-text">{file.name}</span>
          <span className="shrink-0 text-text-faint">{size(file.size)}</span>
          <button
            type="button"
            onClick={() => setFile(null)}
            title="선택 해제"
            aria-label="선택 해제"
            className="ml-auto shrink-0 rounded-[6px] p-1 text-text-sub hover:bg-hover hover:text-danger"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
