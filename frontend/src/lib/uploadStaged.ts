import { api } from '../api/client';

export type ParentType = 'inbound' | 'waste_inbound' | 'outbound_sale' | 'waste_outbound' | 'vehicle' | 'vehicle_maintenance';

// 등록 성공 직후 담아 뒀던 파일들을 순서대로 업로드한다.
export async function uploadStagedFiles(
  groups: { fileType: string; files: File[] }[],
  parentType: ParentType,
  parentId: string,
) {
  for (const group of groups) {
    for (const file of group.files) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileType', group.fileType);
      formData.append('parentType', parentType);
      formData.append('parentId', parentId);
      await api.post('/api/attachments', formData);
    }
  }
}
