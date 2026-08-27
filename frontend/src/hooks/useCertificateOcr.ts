import { useState } from 'react';
import { API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';

// 계량증명서에서 읽어 오는 항목. 폐기물 계근표에는 배출자·운반자·처리자가 함께 찍힌다.
export interface OcrFields {
  weighDate?: string;
  vehicleNo?: string;
  driverName?: string;
  itemName?: string;
  grossWeight?: number | null;
  tareWeight?: number | null;
  netWeight?: number | null;
  companyName?: string;
  siteName?: string;
  dischargerName?: string;
  transporterName?: string;
  processorName?: string;
}

export const OCR_LABEL: Record<keyof OcrFields, string> = {
  weighDate: '계량일',
  vehicleNo: '차량번호',
  driverName: '운전자',
  itemName: '품명',
  grossWeight: '총중량',
  tareWeight: '공차중량',
  netWeight: '실중량',
  companyName: '업체명',
  siteName: '현장/하차지',
  dischargerName: '배출자',
  transporterName: '운반자',
  processorName: '처리자',
};

// 계량증명서를 올리면 계근 항목을 읽어 준다. 읽은 값을 어느 칸에 넣을지는
// 화면마다 다르므로 여기서는 값만 돌려주고, 채우는 일은 부르는 쪽이 한다.
export function useCertificateOcr() {
  const [ocr, setOcr] = useState<OcrFields | null>(null);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrNote, setOcrNote] = useState('');

  const runOcr = async (picked: File[], apply: (fields: OcrFields) => void) => {
    const file = picked[0];
    if (!file) return;
    setOcrBusy(true);
    setOcrNote('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/ocr/weighing-certificate`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data: { enabled: boolean; fields: OcrFields; error?: string } = await res.json();

      if (!data.enabled) {
        setOcrNote('OCR이 설정되지 않아 자동 인식을 건너뜁니다. 직접 입력해 주세요.');
        return;
      }
      if (data.error) setOcrNote(data.error);

      const fields = data.fields ?? {};
      setOcr(fields);
      apply(fields);
    } catch {
      setOcrNote('인식에 실패했습니다. 직접 입력해 주세요.');
    } finally {
      setOcrBusy(false);
    }
  };

  return { ocr, ocrBusy, ocrNote, runOcr };
}
