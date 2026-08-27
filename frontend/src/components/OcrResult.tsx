import { ScanLine } from 'lucide-react';
import { OCR_LABEL, type OcrFields } from '../hooks/useCertificateOcr';

// 인식 결과를 그대로 보여 준다. 자동으로 채운 값이 맞는지 눈으로 대조할 자리가 있어야
// 담당자가 믿고 쓰거나 고칠 수 있다.
export function OcrResult({ ocr, note }: { ocr: OcrFields | null; note?: string }) {
  if (!ocr && !note) return null;

  return (
    <div className="rounded-[10px] border border-border bg-input p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-primary">
        <ScanLine size={14} /> 계량증명서 인식 결과
        <span className="font-normal text-text-faint">— 빈 칸만 자동으로 채웠습니다. 위에서 직접 수정하세요.</span>
      </p>
      {note && <p className="mb-2 text-[12.5px] text-warning">{note}</p>}
      {ocr && (
        <dl className="grid grid-cols-3 gap-x-4 gap-y-1">
          {(Object.keys(OCR_LABEL) as (keyof OcrFields)[])
            .filter((k) => ocr[k] != null && ocr[k] !== '')
            .map((k) => (
              <div key={k} className="flex justify-between gap-2 border-b border-border pb-1">
                <dt className="text-[12px] text-text-sub">{OCR_LABEL[k]}</dt>
                <dd className="text-[12.5px] font-semibold text-text-strong">{String(ocr[k])}</dd>
              </div>
            ))}
        </dl>
      )}
    </div>
  );
}
