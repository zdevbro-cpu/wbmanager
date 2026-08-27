// 계량증명서 OCR — Gemini 멀티모달로 이미지/PDF에서 계근 항목을 추출한다.
// settlementmanager/server/services/ocrService.js와 같은 방식.
import { GoogleGenerativeAI } from '@google/generative-ai';
import { VertexAI } from '@google-cloud/vertexai';

// 모델은 공급사 사정으로 사라진다 — 2.5-flash는 신규 사용이 막혀 인식이 전부 실패했다.
// 다음에 또 바뀌어도 배포 없이 넘어갈 수 있게 환경변수로 뺀다.
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

// 부르는 길이 둘이다.
//  1) Vertex AI — 이 프로젝트 결제 계정으로 후불 과금된다. 키 파일이 필요 없고
//     Cloud Run 서비스 계정 권한으로 부른다. 운영에서 쓸 길이다.
//  2) AI Studio 키 — 선결제 크레딧이 떨어지면 멈춘다. Vertex를 켜기 전까지의 대비책.
const vertexProject = process.env.VERTEX_PROJECT_ID;
const vertexLocation = process.env.VERTEX_LOCATION || 'global';
const apiKey = process.env.GEMINI_API_KEY;

const vertexModel = vertexProject
  ? new VertexAI({ project: vertexProject, location: vertexLocation }).getGenerativeModel({ model: MODEL_NAME })
  : null;
const keyModel = apiKey ? new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL_NAME }) : null;
const model = vertexModel ?? keyModel;

if (vertexModel) console.log(`[ocr] Vertex AI ${vertexProject}/${vertexLocation} · 모델 ${MODEL_NAME}`);
else if (keyModel) console.log(`[ocr] AI Studio 키 · 모델 ${MODEL_NAME}`);
else console.warn('[ocr] VERTEX_PROJECT_ID·GEMINI_API_KEY 모두 미설정 — OCR은 빈 결과를 반환합니다.');

// 두 SDK는 요청·응답 모양이 조금 다르다. 부르는 쪽이 신경 쓰지 않도록 여기서 맞춘다.
// Vertex가 아직 켜지지 않았거나 권한이 없으면 예전 키 방식으로 한 번 더 시도한다 —
// 전환 중에 인식이 끊기지 않게 하기 위해서다.
async function askModel(prompt, buffer, mimeType) {
  const inlineData = { data: buffer.toString('base64'), mimeType };

  if (vertexModel) {
    try {
      const res = await vertexModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData }] }],
      });
      return res.response?.candidates?.[0]?.content?.parts?.map((x) => x.text ?? '').join('') ?? '';
    } catch (err) {
      if (!keyModel) throw err;
      console.warn('[ocr] Vertex 호출 실패 — API 키로 재시도:', String(err.message).split('\n')[0]);
    }
  }

  const res = await keyModel.generateContent([prompt, { inlineData }]);
  return res.response.text();
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

  const text = await askModel(PROMPT, buffer, mimeType);
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

// 차량등록증(자동차등록증) — 자산 등록 시 드래그앤드롭으로 올리면 차량 상세를 채운다.
const VEHICLE_PROMPT = `이 이미지는 한국의 자동차등록증입니다. 아래 필드를 JSON으로만 추출하세요.
값이 없으면 빈 문자열("")로. 날짜는 YYYY-MM-DD 형식으로.
숫자는 단위/콤마를 빼고 숫자만 넣으세요.
{
  "plateNo": "자동차등록번호(예: 86노1445)",
  "vin": "차대번호",
  "vehicleType": "차종(승용/승합/화물/특수)",
  "modelName": "차명(모델명)",
  "manufacturer": "제작사",
  "fuelType": "사용연료(휘발유/경유/LPG/전기/수소/하이브리드)",
  "yearModel": "연식(년식)",
  "registeredAt": "최초등록일(YYYY-MM-DD)",
  "loadCapacity": "적재중량(kg 또는 톤 표기 그대로)",
  "ownerName": "소유자"
}`;

export async function readVehicleRegistration(buffer, mimeType = 'image/jpeg') {
  if (!model) return { enabled: false, fields: {} };

  const text = await askModel(VEHICLE_PROMPT, buffer, mimeType);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.warn('[ocr] 차량등록증 JSON 추출 실패');
    return { enabled: true, fields: {} };
  }

  let parsed;
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    console.warn('[ocr] 차량등록증 JSON 파싱 실패:', e.message);
    return { enabled: true, fields: {} };
  }

  const fields = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (v === '' || v == null) continue;
    fields[k] = String(v).trim();
  }
  return { enabled: true, fields };
}
