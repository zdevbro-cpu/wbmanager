import { useState } from 'react';
import { UploadCloud, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api/client';

interface FileUploadProps {
  label: string;
  fileType: string;
  parentType: 'inbound' | 'outbound_sale' | 'waste_outbound' | 'vehicle_maintenance';
  parentId: string;
}

// 계량증명서 등 증빙 파일을 Google Drive에 업로드하고 트랜잭션에 연결한다.
export function FileUpload({ label, fileType, parentType, parentId }: FileUploadProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);
    formData.append('parentType', parentType);
    formData.append('parentId', parentId);

    setStatus('uploading');
    try {
      await api.post('/api/attachments', formData);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[13px] font-semibold text-text-mid">{label}</label>
      <label
        className={[
          'flex h-[38px] w-fit cursor-pointer items-center gap-2 rounded-[8px] border border-border bg-input px-3 text-[13px] text-text-mid hover:bg-hover',
          !parentId && 'pointer-events-none opacity-50',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <UploadCloud size={15} />
        파일 선택
        <input type="file" onChange={handleChange} disabled={!parentId} className="hidden" />
      </label>
      {status === 'uploading' && <p className="mt-1.5 text-[12.5px] text-text-sub">업로드 중...</p>}
      {status === 'done' && (
        <p className="mt-1.5 flex items-center gap-1 text-[12.5px] text-success">
          <CheckCircle2 size={14} /> 업로드 완료
        </p>
      )}
      {status === 'error' && (
        <p className="mt-1.5 flex items-center gap-1 text-[12.5px] text-danger">
          <XCircle size={14} /> 업로드 실패
        </p>
      )}
      {!parentId && <p className="mt-1.5 text-[12px] text-text-faint">먼저 등록을 완료해야 첨부할 수 있습니다.</p>}
    </div>
  );
}
