import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { LogIn, LogOut, Volume2, VolumeX } from 'lucide-react';
import { api } from '../api/client';
import { useProjects } from '../hooks/useMasters';
import { kstStamp } from '../lib/datetime';
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

// 사무실 단말에서 고를 수 있는 근태. 출근·퇴근 말고도 그날의 사정을 여기서 정한다.
const CODES = ['출근', '출장', '외근', '반차', '특근'];

// 오후 4시부터는 퇴근을 기본으로 둔다 — 그 시간 뒤에 찍는 사람은 대개 나가는 사람이다.
const OUT_FROM_HOUR = 16;

// 같은 QR이 카메라에 계속 잡히므로, 한 번 찍은 사번은 잠시 무시한다.
const COOLDOWN_MS = 6000;

export function AttendGatePage() {
  const { projects } = useProjects();
  // 사무실 단말이므로 본사를 기본으로 둔다. 현장 단말로 쓸 때만 바꾼다.
  const [projectId, setProjectId] = useState('HQ');
  const [kind, setKind] = useState<'in' | 'out'>('in');
  const [code, setCode] = useState('출근');
  const [voice, setVoice] = useState(true);
  const [last, setLast] = useState<Stamped | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(new Date());
  const [camera, setCamera] = useState<'idle' | 'on' | 'off'>('idle');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recent = useRef<Map<string, number>>(new Map());
  const busy = useRef(false);

  // 시계 — 단말은 종일 켜 두므로 화면에 지금 시각이 보여야 한다.
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // 오후 4시가 지나면 퇴근으로 넘긴다. 손으로 바꾼 뒤에는 건드리지 않는다.
  const touched = useRef(false);
  useEffect(() => {
    if (touched.current) return;
    setKind(now.getHours() >= OUT_FROM_HOUR ? 'out' : 'in');
  }, [now]);

  const speak = useCallback(
    (text: string) => {
      if (!voice || !('speechSynthesis' in window)) return;
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      u.rate = 1.05;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    },
    [voice],
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
          attendCode: kind === 'in' ? code : undefined,
        });
        setLast(r);
        speak(
          r.kind === 'in'
            ? `${r.name}님 안녕하세요. ${code === '출근' ? '출근' : code} 처리되었습니다.`
            : `${r.name}님 수고하셨습니다. 퇴근 처리되었습니다.`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : '찍지 못했습니다.';
        setError(msg);
        speak('확인되지 않았습니다. 다시 시도해 주세요.');
      } finally {
        busy.current = false;
      }
    },
    [projectId, kind, code, speak],
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
        setError('카메라를 열 수 없습니다. 스캐너로 사번을 읽히거나 손으로 적어 주세요.');
      });

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera, stamp]);

  // 스캐너는 키보드처럼 동작한다 — 입력칸이 늘 초점을 물고 있어야 그냥 쏘면 찍힌다.
  useEffect(() => {
    const focus = () => {
      const active = document.activeElement;
      // 사람이 무언가 만지고 있으면 뺏지 않는다 — 현장 고르기가 닫혀 버린다.
      if (active && active !== document.body && active !== inputRef.current) return;
      inputRef.current?.focus();
    };
    focus();
    const t = window.setInterval(focus, 1500);
    return () => window.clearInterval(t);
  }, []);

  const ready = Boolean(projectId);

  return (
    <div className="flex min-h-screen flex-col bg-bg p-6">
      {/* 머리줄 — 어디서 무엇으로 찍는지가 늘 보여야 한다. */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-extrabold text-text-strong">출퇴근 단말</h1>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className={`${inputCls} w-[240px]`}
          aria-label="현장"
        >
          <option value="HQ">본사</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>

        <div className="flex overflow-hidden rounded-[10px] border border-border">
          {(
            [
              ['in', '출근', LogIn],
              ['out', '퇴근', LogOut],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                touched.current = true;
                setKind(k);
              }}
              className={`flex items-center gap-1.5 px-5 py-2.5 text-[15px] font-bold ${
                kind === k ? (k === 'in' ? 'bg-success text-white' : 'bg-primary text-white') : 'text-text-sub'
              }`}
            >
              <Icon size={17} /> {label}
            </button>
          ))}
        </div>

        {kind === 'in' && (
          <div className="flex flex-wrap gap-1.5">
            {CODES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCode(c)}
                className={`rounded-[9px] border px-3 py-2 text-[14px] font-bold ${
                  code === c ? 'border-primary bg-primary/20 text-primary' : 'border-border text-text-sub'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setVoice((v) => !v)}
          title={voice ? '음성 안내 끄기' : '음성 안내 켜기'}
          className="ml-auto rounded-[9px] border border-border px-3 py-2 text-text-sub hover:text-text-strong"
        >
          {voice ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <span className="tabular text-[20px] font-extrabold text-text-strong">
          {now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      <div className="grid flex-1 gap-5 [grid-template-columns:minmax(0,420px)_minmax(0,1fr)]">
        {/* 카메라 — 사번 QR을 여기에 비춘다. */}
        <div className="overflow-hidden rounded-[14px] border border-border bg-black">
          {camera === 'on' ? (
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-[14px] text-text-sub">카메라로 사번 QR을 읽습니다.</p>
              <button
                type="button"
                onClick={() => setCamera('on')}
                className="rounded-[10px] bg-primary px-5 py-2.5 text-[15px] font-bold text-white"
              >
                카메라 켜기
              </button>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* 결과 — 멀리서도 읽히도록 크게. */}
        <div className="flex flex-col rounded-[14px] border border-border bg-card p-6">
          {!ready ? (
            <p className="m-auto text-[20px] font-bold text-warning">먼저 현장을 고르세요.</p>
          ) : error ? (
            <div className="m-auto text-center">
              <p className="text-[42px] font-extrabold text-danger">확인되지 않음</p>
              <p className="mt-2 text-[18px] text-text-sub">{error}</p>
            </div>
          ) : last ? (
            <div className="m-auto text-center">
              <p className="text-[20px] font-bold text-text-sub">
                {last.kind === 'in' ? '안녕하세요' : '수고하셨습니다'}
              </p>
              <p className="mt-1 text-[56px] font-extrabold leading-tight text-text-strong">{last.name}</p>
              <p className={`mt-2 text-[28px] font-extrabold ${last.kind === 'in' ? 'text-success' : 'text-primary'}`}>
                {last.kind === 'in' ? (last.attendCode ?? '출근') : '퇴근'} 처리되었습니다
              </p>
              <p className="tabular mt-3 text-[18px] text-text-sub">{kstStamp(last.at)}</p>
              <p className="mt-1 text-[14px] text-text-faint">
                {last.checkInAt && `출근 ${kstStamp(last.checkInAt).slice(11)}`}
                {last.checkOutAt && ` · 퇴근 ${kstStamp(last.checkOutAt).slice(11)}`}
              </p>
            </div>
          ) : (
            <p className="m-auto text-[24px] font-bold text-text-faint">사번 QR을 대 주세요</p>
          )}

          {/* 스캐너·손입력 — 늘 초점을 물고 있다. */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = inputRef.current?.value.trim();
              if (v) void stamp(v);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="mt-4 border-t border-border pt-4"
          >
            <input
              ref={inputRef}
              placeholder="스캐너로 읽거나 사번을 적고 Enter"
              className={`${inputCls} h-[46px] text-center text-[16px]`}
              autoComplete="off"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
