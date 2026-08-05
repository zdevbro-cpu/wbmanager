import { API_BASE_URL } from '../api/client';
import { auth } from './firebase';

// 파일 내려받기 — API가 토큰을 요구하므로 <a href>로는 401이 난다.
// 인증 헤더를 붙여 받아 온 뒤 브라우저 저장 흐름으로 넘긴다.
export async function downloadFile(path: string, fallbackName: string) {
  const token = await auth.currentUser?.getIdToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `내려받기 실패 (${res.status})`);
  }

  // 서버가 보낸 파일명을 우선 쓴다(RFC 5987 형식).
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const fileName = encoded ? decodeURIComponent(encoded) : fallbackName;

  // 오류가 JSON/HTML로 돌아오면 파일로 저장하지 않고 사유를 알린다.
  const contentType = res.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json') || contentType.includes('text/html')) {
    const text = await res.text();
    let message = '파일을 받지 못했습니다.';
    try {
      message = JSON.parse(text).error ?? message;
    } catch {
      /* HTML 오류 페이지면 원문 대신 기본 메시지를 쓴다 */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
