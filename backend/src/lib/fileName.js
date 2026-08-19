// multipart 파일명은 브라우저가 UTF-8로 보내지만 multer는 latin1로 읽는다.
// 되돌리지 않으면 한글 파일명이 "í__ì_¥..." 처럼 깨진 채 저장된다.
export function decodeUploadName(name) {
  if (!name) return name;
  try {
    const restored = Buffer.from(name, 'latin1').toString('utf8');
    // 되돌린 쪽에 대체문자(U+FFFD)가 없으면 그 값이 원본이다.
    return restored.includes('\uFFFD') ? name : restored;
  } catch {
    return name;
  }
}
