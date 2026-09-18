// 화면 모드 — 어두운 청색(dark) · 밝게(light) · 기기 설정 따르기(system).
// 고른 모드는 계정에 저장하고(서버), 이 기기에도 적어 둔다.
// 기기에 적어 두는 것은 로그인 정보가 오기 전, 첫 화면이 번쩍이지 않게 하려는 것이다.
export type ThemeMode = 'dark' | 'light' | 'system';

export const THEME_MODES: ThemeMode[] = ['dark', 'light', 'system'];

const KEY = 'wb.theme';
const THEME_COLOR = { dark: '#0b1220', light: '#ffffff' } as const;

const media = window.matchMedia('(prefers-color-scheme: dark)');
let current: ThemeMode = readCachedTheme();

export function readCachedTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY);
    return THEME_MODES.includes(v as ThemeMode) ? (v as ThemeMode) : 'dark';
  } catch {
    return 'dark';
  }
}

// 출퇴근 단말은 전용 화면이라 계정 모드와 상관없이 늘 어둡게 둔다.
const fixedDark = () => window.location.pathname.startsWith('/attend-gate');

export function applyTheme(mode: ThemeMode) {
  current = mode;
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // 저장이 막힌 브라우저에서도 화면은 바꾼다.
  }
  const resolved = fixedDark() ? 'dark' : mode === 'system' ? (media.matches ? 'dark' : 'light') : mode;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[resolved]);
}

// 기기 설정을 따르는 중이면, 켜 둔 채로 기기 설정을 바꿔도 바로 따라간다.
media.addEventListener('change', () => {
  if (current === 'system') applyTheme('system');
});

// 불러오는 즉시 한 번 입힌다 — index.html의 선적용이 막힌 환경에서도, 단말 화면에서도 맞는 모드가 된다.
applyTheme(current);
