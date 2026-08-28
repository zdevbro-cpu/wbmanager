import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Download, LogIn, LogOut, Volume2, VolumeX } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../hooks/useMasters';
import { kstStamp } from '../lib/datetime';
import { attendCodes, dictOf, LANGS, voiceOf, type Lang } from '../lib/attendLang';
import { inputCls } from '../components/ui/classes';

interface Stamped {
  kind: 'in' | 'out';
  name: string;
  empCode: string;
  attendCode?: string | null;
  at: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
}

// 오후 4시부터는 퇴근을 기본으로 둔다 — 그 시간 뒤에 찍는 사람은 대개 나가는 사람이다.
const OUT_FROM_HOUR = 16;

// 같은 QR이 카메라에 계속 잡히므로, 한 번 찍은 사번은 잠시 무시한다.
const COOLDOWN_MS = 6000;

const LANG_KEY = 'attend-gate-lang';

export function AttendGatePage() {
  const { projects } = useProjects();
  // 사무실 단말이므로 본사를 기본으로 둔다. 현장 단말로 쓸 때만 바꾼다.
  const [projectId, setProjectId] = useState('HQ');
  const [kind, setKind] = useState<'in' | 'out'>('in');
  const [code, setCode] = useState('출근');
  const [voice, setVoice] = useState(true);
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY) as Lang | null;
      return saved === 'en' || saved === 'ru' ? saved : 'ko';
    } catch {
      return 'ko';
    }
  });
  const [last, setLast] = useState<Stamped | null>(null);
  const [error, setError] = useState('');
  const [afternoon, setAfternoon] = useState(new Date().getHours() >= OUT_FROM_HOUR);
  const [camera, setCamera] = useState<'idle' | 'on' | 'off'>('idle');
  // 홈 화면 저장 — 크롬은 설치 단추를 우리에게 넘겨준다. 그 밖의 브라우저는 안내만 띄운다.
  const [installer, setInstaller] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [guide, setGuide] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recent = useRef<Map<string, number>>(new Map());
  const busy = useRef(false);

  const t = dictOf(lang);

  useEffect(() => {
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      // 저장이 막힌 기기에서도 그 자리에서는 골라 쓸 수 있어야 한다.
    }
  }, [lang]);

  // 크롬이 설치 단추를 내주려면 fetch를 다루는 서비스워커가 있어야 한다.
  // 아무것도 캐시하지 않는 최소 서비스워커라 배포한 화면이 옛것으로 덮이지 않는다.
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      const ev = e as Event & { prompt: () => Promise<void> };
      setInstaller({ prompt: () => ev.prompt() });
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  // 홈 화면에 저장하면 이 화면이 바로 열리게 한다.
  // 앱 전체 매니페스트는 /mobile 로 열리므로, 이 화면에 있는 동안만 단말용으로 바꿔 둔다.
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) return;
    const before = link.href;
    link.href = '/attend-manifest.webmanifest';
    const title = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    const titleBefore = title?.content;
    if (title) title.content = '출퇴근';
    return () => {
      link.href = before;
      if (title && titleBefore != null) title.content = titleBefore;
    };
  }, []);

  // 오후 4시가 지나면 퇴근으로 넘긴다. 손으로 바꾼 뒤에는 건드리지 않는다.
  // 1분에 한 번만 본다 — 더 자주 다시 그리면 열려 있던 목록이 닫힌다.
  const touched = useRef(false);
  useEffect(() => {
    const timer = window.setInterval(() => setAfternoon(new Date().getHours() >= OUT_FROM_HOUR), 60000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (touched.current) return;
    setKind(afternoon ? 'out' : 'in');
  }, [afternoon]);

  const speak = useCallback(
    (text: string) => {
      if (!voice || !('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voiceOf(lang);
      u.rate = 1.05;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
    [voice, lang],
  );

  const stamp = useCallback(
    async (empCode: string) => {
      if (busy.current) return;
      const at = recent.current.get(empCode);
      if (at && Date.now() - at < COOLDOWN_MS) return;
      recent.current.set(empCode, Date.now());

      busy.current = true;
      setError('');
      try {
        const r = await api.post<Stamped>('/api/attendance/gate', {
          empCode,
          projectId,
          kind,
          attendCode: code,
        });
        setLast(r);
        speak(r.kind === 'in' ? t.greet(r.name, t.codes[code] ?? code) : t.farewell(r.name));
      } catch (e) {
        setError(e instanceof Error ? e.message : t.failed);
        speak(t.errorSpoken);
      } finally {
        busy.current = false;
      }
    },
    [projectId, kind, code, speak, t],
  );

  // 카메라 — 화면 안에서 QR을 직접 읽는다. 스캐너가 있으면 카메라 없이도 된다.
  useEffect(() => {
    if (camera !== 'on') return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let alive = true;

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (alive && video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = (canvas.width = video.videoWidth);
        const h = (canvas.height = video.videoHeight);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx && w && h) {
          ctx.drawImage(video, 0, 0, w, h);
          const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          if (found?.data) void stamp(found.data.trim());
        }
      }
      if (alive) raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => {
        setCamera('off');
        setError(t.cameraHint);
      });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [camera, stamp, t]);

  // 스캐너는 키보드처럼 동작한다 — 입력칸이 초점을 물고 있어야 그냥 쏘면 찍힌다.
  // 다만 사람이 무언가 만지고 있으면 뺏지 않는다. 열린 목록이 닫혀 버린다.
  useEffect(() => {
    // 손가락으로 쓰는 기기에서는 잡지 않는다 — 키보드가 저절로 열려 화면이 출렁인다.
    const hasScanner = window.matchMedia('(pointer: fine)').matches;
    if (!hasScanner) return;

    const focus = () => {
      const active = document.activeElement;
      if (active && active !== document.body && active !== inputRef.current) return;
      inputRef.current?.focus();
    };
    focus();
    const timer = window.setInterval(focus, 1500);
    return () => window.clearInterval(timer);
  }, []);

  const ready = Boolean(projectId);

  return (
    // 세로(폰)에서는 위에서 아래로, 가로(태블릿)에서는 왼쪽 카메라·오른쪽 결과로 선다.
    <div className="flex min-h-[100dvh] flex-col bg-bg p-2 sm:p-3">
      {/* 1단 — 이름과 말 고르기. 말은 오른쪽 끝에 둔다. */}
      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-[15px] font-extrabold text-text-strong sm:text-[17px]">{t.title}</h1>
        <button
          type="button"
          onClick={() => (installer ? void installer.prompt() : setGuide((v) => !v))}
          className="ml-auto flex items-center gap-1 rounded-[8px] border border-primary px-2.5 py-1.5 text-[12.5px] font-bold text-primary hover:bg-nav-hover"
        >
          <Download size={14} /> {t.install}
        </button>

        <div className="flex overflow-hidden rounded-[8px] border border-border">
          {LANGS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setLang(l.id)}
              className={`px-2.5 py-1.5 text-[12.5px] font-bold ${
                lang === l.id ? 'bg-primary text-white' : 'text-text-sub hover:text-text-strong'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {guide && (
        <div className="mb-2 rounded-[10px] border border-primary/50 bg-input p-3 text-[12.5px] leading-relaxed text-text-sub">
          {t.installGuide}
          <button
            type="button"
            onClick={() => setGuide(false)}
            className="ml-2 font-bold text-primary underline"
          >
            {t.close}
          </button>
        </div>
      )}

      {/* 2단 — 어디서 찍는지. */}
      <div className="mb-2">
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={`${inputCls} h-[36px] w-full text-[13px] sm:w-[220px]`}
          aria-label={t.site}
        >
          <option value="HQ">{t.hq}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>
      </div>

      {/* 3단 — 출근·퇴근은 왼쪽, 스피커와 시계는 오른쪽. */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex overflow-hidden rounded-[10px] border border-border">
          {(
            [
              ['in', t.in, LogIn],
              ['out', t.out, LogOut],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                touched.current = true;
                setKind(k);
              }}
              className={`flex items-center gap-1 px-3 py-1.5 text-[13px] font-bold sm:px-3.5 sm:text-[14px] ${
                kind === k ? (k === 'in' ? 'bg-success text-white' : 'bg-primary text-white') : 'text-text-sub'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setVoice((v) => !v)}
            title={voice ? t.voiceOn : t.voiceOff}
            className="rounded-[8px] border border-border px-2.5 py-1.5 text-text-sub hover:text-text-strong"
          >
            {voice ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          <Clock lang={lang} />
        </div>
      </div>

      {/* 4단 — 그날의 구분. 출근·퇴근 어느 쪽이든 함께 남는다. */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {attendCodes().map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCode(c)}
            className={`rounded-[8px] border px-2.5 py-1.5 text-[12.5px] font-bold sm:text-[13px] ${
              code === c ? 'border-primary bg-primary/20 text-primary' : 'border-border text-text-sub'
            }`}
          >
            {t.codes[c] ?? c}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-2 sm:gap-3 lg:[grid-template-columns:minmax(0,320px)_minmax(0,1fr)]">
        {/* 카메라 — 사번 QR을 여기에 비춘다. 세로에서는 위쪽 절반. */}
        <div className="h-[210px] overflow-hidden rounded-[12px] border border-border bg-black lg:h-auto">
          {camera === 'on' ? (
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
              <p className="text-[13px] text-text-sub">{t.cameraHint}</p>
              <button
                type="button"
                onClick={() => setCamera('on')}
                className="rounded-[10px] bg-primary px-4 py-2 text-[14px] font-bold text-white"
              >
                {t.cameraOn}
              </button>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* 결과 — 멀리서도 읽히도록 크게. 입력칸은 늘 맨 아래에 둔다. */}
        <div className="flex min-h-0 flex-1 flex-col rounded-[12px] border border-border bg-card p-3 sm:p-4">
          {!ready ? (
            <p className="m-auto py-8 text-[18px] font-bold text-warning">{t.pickSite}</p>
          ) : error ? (
            <div className="m-auto py-6 text-center">
              <p className="text-[28px] font-extrabold text-danger sm:text-[34px]">{t.failed}</p>
              <p className="mt-1.5 text-[14px] text-text-sub sm:text-[15px]">{error}</p>
            </div>
          ) : last ? (
            <div className="m-auto py-4 text-center">
              <p className="text-[16px] font-bold text-text-sub sm:text-[17px]">
                {last.kind === 'in' ? t.hello : t.goodbye}
              </p>
              <p className="mt-0.5 text-[38px] font-extrabold leading-tight text-text-strong sm:text-[46px]">
                {last.name}
              </p>
              <p
                className={`mt-1 text-[19px] font-extrabold sm:text-[23px] ${
                  last.kind === 'in' ? 'text-success' : 'text-primary'
                }`}
              >
                {t.done(last.kind === 'in' ? (t.codes[last.attendCode ?? '출근'] ?? t.in) : t.out)}
              </p>
              <p className="tabular mt-2 text-[15px] text-text-sub sm:text-[16px]">{kstStamp(last.at)}</p>
              <p className="mt-1 text-[12.5px] text-text-faint sm:text-[13px]">
                {last.checkInAt && `${t.inAt} ${kstStamp(last.checkInAt).slice(11)}`}
                {last.checkOutAt && ` · ${t.outAt} ${kstStamp(last.checkOutAt).slice(11)}`}
              </p>
            </div>
          ) : (
            <p className="m-auto py-8 text-[20px] font-bold text-text-faint sm:text-[22px]">{t.waiting}</p>
          )}

          {/* 스캐너·손입력 — 세로에서도 화면 맨 아래에 붙는다. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = inputRef.current?.value.trim();
              if (v) void stamp(v);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="mt-auto border-t border-border pt-3"
          >
            <input
              ref={inputRef}
              placeholder={t.scanHint}
              className={`${inputCls} h-[42px] text-center text-[15px]`}
              autoComplete="off"
            />
          </form>
        </div>
      </div>
    </div>
  );
}

// 시계만 따로 그린다 — 이 조각만 1초마다 바뀌면 나머지 화면은 건드리지 않는다.
// 24시로 적는다 — '오전/오후'는 말마다 달라 섞이고, 단말에서는 24시가 더 분명하다.
function Clock({ lang }: { lang: Lang }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span className="tabular text-[16px] font-extrabold text-text-strong sm:text-[19px]">
      {now.toLocaleTimeString(voiceOf(lang), {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })}
    </span>
  );
}
