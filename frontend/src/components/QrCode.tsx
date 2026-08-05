import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download } from 'lucide-react';
import { outlineBtnCls } from './ui/classes';

interface Props {
  /** QR에 담을 값 — 임직원 사번처럼 스캐너가 그대로 읽어 쓰는 식별자 */
  value: string;
  /** 다운로드 파일명(확장자 제외) */
  fileName?: string;
  size?: number;
  caption?: string;
}

// 사번 QR — 근태 단말/휴대폰으로 스캔하면 사번 문자열이 그대로 읽힌다.
// 이미지를 파일로 내려받아 사원증·출력물에 붙일 수 있다.
export function QrCode({ value, fileName, size = 160, caption }: Props) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    if (!value) return;
    QRCode.toDataURL(value, { width: size * 2, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(''));
  }, [value, size]);

  if (!value) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {dataUrl ? (
        <img src={dataUrl} alt={`${value} QR`} width={size} height={size} className="rounded-[8px] bg-white p-1.5" />
      ) : (
        <div className="text-[12px] text-text-faint">QR 생성 중...</div>
      )}
      <div className="tabular text-[13px] font-bold text-text-strong">{value}</div>
      {caption && <div className="text-[12px] text-text-faint">{caption}</div>}
      {dataUrl && (
        <a href={dataUrl} download={`${fileName ?? value}.png`} className={`${outlineBtnCls} h-8 px-3 text-[12.5px]`}>
          <Download size={14} /> QR 이미지 저장
        </a>
      )}
    </div>
  );
}
