// 출퇴근 단말의 말 — 한국어·영어·러시아어.
// 현장에는 외국인 인력이 함께 있어, 찍는 사람이 자기 말로 읽고 들을 수 있어야 한다.
// 서버에 보내는 근태 값은 늘 한국어다(자료가 한 가지 말로만 쌓여야 집계가 갈라지지 않는다).

export type Lang = 'ko' | 'en' | 'ru';

export const LANGS: { id: Lang; label: string; voice: string }[] = [
  { id: 'ko', label: '한국어', voice: 'ko-KR' },
  { id: 'en', label: 'English', voice: 'en-US' },
  { id: 'ru', label: 'Русский', voice: 'ru-RU' },
];

interface Dict {
  title: string;
  site: string;
  hq: string;
  in: string;
  out: string;
  voiceOn: string;
  voiceOff: string;
  cameraHint: string;
  cameraOn: string;
  pickSite: string;
  failed: string;
  hello: string;
  goodbye: string;
  done: (what: string) => string;
  waiting: string;
  scanHint: string;
  inAt: string;
  outAt: string;
  greet: (name: string, what: string) => string;
  farewell: (name: string) => string;
  errorSpoken: string;
  /** 근태 코드 — 키는 서버에 보내는 한국어 값이다. */
  codes: Record<string, string>;
}

const CODE_KEYS = ['출근', '출장', '외근', '반차', '특근'] as const;

const KO: Dict = {
  title: '출퇴근 단말',
  site: '현장',
  hq: '본사',
  in: '출근',
  out: '퇴근',
  voiceOn: '음성 안내 끄기',
  voiceOff: '음성 안내 켜기',
  cameraHint: '카메라로 사번 QR을 읽습니다.',
  cameraOn: '카메라 켜기',
  pickSite: '먼저 현장을 고르세요.',
  failed: '확인되지 않음',
  hello: '안녕하세요',
  goodbye: '수고하셨습니다',
  done: (what) => `${what} 처리되었습니다`,
  waiting: '사번 QR을 대 주세요',
  scanHint: '스캐너로 읽거나 사번을 적고 Enter',
  inAt: '출근',
  outAt: '퇴근',
  greet: (name, what) => `${name}님 안녕하세요. ${what} 처리되었습니다.`,
  farewell: (name) => `${name}님 수고하셨습니다. 퇴근 처리되었습니다.`,
  errorSpoken: '확인되지 않았습니다. 다시 시도해 주세요.',
  codes: { 출근: '출근', 출장: '출장', 외근: '외근', 반차: '반차', 특근: '특근' },
};

const EN: Dict = {
  title: 'Attendance terminal',
  site: 'Site',
  hq: 'Head office',
  in: 'Check in',
  out: 'Check out',
  voiceOn: 'Turn voice off',
  voiceOff: 'Turn voice on',
  cameraHint: 'Hold your ID QR up to the camera.',
  cameraOn: 'Start camera',
  pickSite: 'Choose a site first.',
  failed: 'Not recognised',
  hello: 'Welcome',
  goodbye: 'Well done today',
  done: (what) => `${what} recorded`,
  waiting: 'Show your ID QR',
  scanHint: 'Scan, or type your ID and press Enter',
  inAt: 'In',
  outAt: 'Out',
  greet: (name, what) => `Welcome, ${name}. ${what} recorded.`,
  farewell: (name) => `Well done, ${name}. Check out recorded.`,
  errorSpoken: 'Not recognised. Please try again.',
  codes: { 출근: 'Check in', 출장: 'Business trip', 외근: 'Field work', 반차: 'Half day', 특근: 'Overtime' },
};

const RU: Dict = {
  title: 'Терминал учёта',
  site: 'Объект',
  hq: 'Головной офис',
  in: 'Приход',
  out: 'Уход',
  voiceOn: 'Выключить голос',
  voiceOff: 'Включить голос',
  cameraHint: 'Поднесите QR-код пропуска к камере.',
  cameraOn: 'Включить камеру',
  pickSite: 'Сначала выберите объект.',
  failed: 'Не распознано',
  hello: 'Здравствуйте',
  goodbye: 'Спасибо за работу',
  done: (what) => `${what} — записано`,
  waiting: 'Покажите QR-код пропуска',
  scanHint: 'Отсканируйте или введите табельный номер и нажмите Enter',
  inAt: 'Приход',
  outAt: 'Уход',
  greet: (name, what) => `Здравствуйте, ${name}. ${what} записано.`,
  farewell: (name) => `Спасибо за работу, ${name}. Уход записан.`,
  errorSpoken: 'Не распознано. Попробуйте ещё раз.',
  codes: {
    출근: 'Приход',
    출장: 'Командировка',
    외근: 'Работа вне офиса',
    반차: 'Полдня',
    특근: 'Сверхурочные',
  },
};

const DICTS: Record<Lang, Dict> = { ko: KO, en: EN, ru: RU };

export const attendCodes = () => [...CODE_KEYS];
export const dictOf = (lang: Lang) => DICTS[lang] ?? KO;
export const voiceOf = (lang: Lang) => LANGS.find((l) => l.id === lang)?.voice ?? 'ko-KR';
