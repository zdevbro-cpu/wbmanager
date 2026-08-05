// 계량증명서 OCR — Gemini 멀티모달로 이미지/PDF에서 계근 항목을 추출한다.
// settlementmanager/server/services/ocrService.js와 같은 방식.
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
let model = null;
if (apiKey) {
  model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.5-flash' });
} else {
  console.warn('[ocr] GEMINI_API_KEY 미설정 — OCR은 빈 결과를 반환합니다.');
}

// 원본 계량증명서에 실제로 찍히는 항목 기준.
// 근거: data/.../3. 사진 삽입이 필요한 프로젝트 입력형태/3. 26.06.30_계량증명서(2대)취합하기.pdf
const PROMPT = `이 이미지는 한국의 계량증명서(계근표)입니다. 아래 필드를 JSON으로만 추출하세요.
값이 없으면 빈 문자열("")로. 중량과 숫자는 단위/콤마를 빼고 숫자만.
중량 단위가 톤(t)이면 kg으로 환산해서 넣으세요.
{
  "weighDate": "계량일(YYYY-MM-DD)",
  "vehicleNo": "차량번호",
  "driverName": "운전자명",
  "itemName": "품명/제품명",
  "grossWeight": "총중량(kg, 숫자만)",
  "tareWeight": "공차중량(kg, 숫자만)",
  "netWeight": "실중량/감량후중량(kg, 숫자만)",
  "companyName": "거래처/업체명",
  "siteName": "현장명/하차지"
}`;

const NUMERIC_FIELDS = ['grossWeight', 'tareWeight', 'netWeight'];

function toNumber(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function isOcrEnabled() {
  return Boolean(model);
}

// 인식 결과는 그대로 폼에 채워지고 담당자가 손으로 고칠 수 있으므로,
// 실패하더라도 예외 대신 빈 객체를 돌려 등록 흐름을 막지 않는다.
export async function readWeighingCertificate(buffer, mimeType = 'image/jpeg') {
  if (!model) return { enabled: false, fields: {} };

  const result = await model.generateContent([
    PROMPT,
    { inlineData: { data: buffer.toString('base64'), mimeType } },
  ]);
  const text = result.response.text();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.warn('[ocr] JSON 추출 실패');
    return { enabled: true, fields: {} };
  }

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    console.warn('[ocr] JSON 파싱 실패:', e.message);
    return { enabled: true, fields: {} };
  }

  const fields = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (v === '' || v == null) continue;
    fields[k] = NUMERIC_FIELDS.includes(k) ? toNumber(v) : String(v).trim();
  }
  return { enabled: true, fields };
}
