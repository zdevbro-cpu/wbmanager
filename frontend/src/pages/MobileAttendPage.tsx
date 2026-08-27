import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2, Check, LogIn, LogOut, MapPin, ShieldCheck } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useProjects } from '../hooks/useMasters';
import { kstToday, kstStamp } from '../lib/datetime';

// 현장에서 휴대폰으로 출퇴근을 찍는다.
// 셀카 한 장과 그 자리의 위치를 함께 보내고, 사무실이 확인하기 전까지는 임시저장이다.
// 업무 화면은 열지 않는다 — 여기서 하는 일은 출근·퇴근뿐이다.

const field = 'w-full rounded-[10px] border border-border bg-input px-3 py-3 text-[16px] text-input-text';
const labelCls = 'mb-1.5 block text-[13px] font-semibold text-text-mid';
// 한 번 고른 현장은 그대로 둔다. 매일 같은 현장으로 나가는 사람이 대부분이다.
const REMEMBER_PROJECT = 'wb.attend.projectId';

interface TodayRow {
  id: string;
  checkInAt?: string | null;
  checkOutAt?: string | null;
  checkInDistance?: number | null;
  attendCode?: string | null;
  totalManDays?: string | null;
  isDraft?: boolean;
  projectId?: string;
}

interface MeResponse {
  date: string;
  employee: { id: string; name: string; employmentType?: string | null; faceConsentAt?: string | null } | null;
  consented: boolean;
  today: TodayRow | null;
}

// 서버는 UTC로 남긴다. 화면에는 한국 시각으로 보여 준다.
const hhmm = (v?: string | null) => (v ? kstStamp(v).slice(11, 16) : null);

export function MobileAttendPage() {
  const { appUser, logout } = useAuth();
  const isAdmin = appUser?.role === 'admin';
  const { projects } = useProjects();

  const [projectId, setProjectId] = useState('');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [agreed, setAgreed] = useState(false);

  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [kind, setKind] = useState<'in' | 'out'>('in');
  const cameraRef = useRef<HTMLInputElement>(null);
  // 앞 카메라를 화면 안에서 직접 연다. 사진 앱으로 넘기면 기기마다 뒤 카메라가 열린다.
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camOpen, setCamOpen] = useState(false);

  const [place, setPlace] = useState<{ lat: number; lng: number } | null>(null);
  const [placeNote, setPlaceNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  // 마지막에 고른 현장을 그대로 다시 띄운다.
  useEffect(() => {
    const kept = localStorage.getItem(REMEMBER_PROJECT);
    if (kept) setProjectId(kept);
  }, []);

  const loadMe = useCallback(() => {
    api.get<MeResponse>('/api/attendance/me').then((r) => {
      setMe(r);
      // 오늘 이미 찍은 현장이 있으면 그것을 따른다.
      if (r.today?.projectId) setProjectId((prev) => prev || r.today!.projectId!);
      // 출근을 이미 찍었고 퇴근이 없으면, 다음에 할 일은 퇴근이다.
      if (r.today?.checkInAt && !r.today?.checkOutAt) setKind('out');
    });
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (projectId) localStorage.setItem(REMEMBER_PROJECT, projectId);
  }, [projectId]);

  // 위치는 화면에 숫자로 보여 주지 않는다. 잡혔는지만 알려 준다.
  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setPlaceNote('이 기기는 위치를 알려 주지 않습니다.');
      return;
    }
    setPlaceNote('위치 확인 중...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlace({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setPlaceNote('위치 확인됨');
      },
      () => setPlaceNote('위치를 켜 주세요. 위치 없이도 등록은 되지만 현장 확인이 어렵습니다.'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOpen(false);
  }, []);

  useEffect(() => stopCam, [stopCam]);

  const openCam = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCamOpen(true);
    } catch {
      // 카메라를 열 수 없는 기기·브라우저에서는 사진 앱으로 넘긴다.
      cameraRef.current?.click();
    }
  };

  // 화면에 <video>가 놓인 뒤에 물린다.
  useEffect(() => {
    if (!camOpen) return;
    const v = videoRef.current;
    if (!v || !streamRef.current) return;
    v.srcObject = streamRef.current;
    v.play().catch(() => undefined);
  }, [camOpen]);

  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      setError('카메라가 아직 준비되지 않았습니다. 잠시 뒤 다시 눌러 주세요.');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) pick(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
        stopCam();
      },
      'image/jpeg',
      0.85,
    );
  };

  const pick = (f: File | null) => {
    setPhoto(f);
    setPreview(f ? URL.createObjectURL(f) : '');
    setDone('');
    setError('');
  };

  const send = async () => {
    if (!me?.employee) {
      setError('계정에 임직원 정보가 연결되어 있지 않습니다. 관리자에게 연결을 요청하세요.');
      return;
    }
    if (!projectId) {
      setError('현장을 고르세요.');
      return;
    }
    if (!photo) {
      setError('사진을 찍어 주세요.');
      return;
    }
    if (!me?.consented && !agreed) {
      setError('얼굴 사진 사용에 동의해야 등록할 수 있습니다.');
      return;
    }

    setError('');
    setSending(true);
    try {
      const form = new FormData();
      form.append('photo', photo);
      form.append('projectId', projectId);
      form.append('date', kstToday());
      form.append('consent', String(agreed || me?.consented === true));
      if (place) {
        form.append('lat', String(place.lat));
        form.append('lng', String(place.lng));
      }

      // FormData는 api 헬퍼가 Content-Type을 붙이지 않도록 그대로 보낸다.
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/attendance/${kind}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `등록 실패 (${res.status})`);
      }
      const saved = (await res.json()) as { outside?: boolean; radius?: number };

      setDone(
        kind === 'in'
          ? `출근으로 올렸습니다.${saved.outside ? ` 현장에서 ${saved.radius}m 밖에서 찍혔습니다.` : ''}`
          : `퇴근으로 올렸습니다.${saved.outside ? ` 현장에서 ${saved.radius}m 밖에서 찍혔습니다.` : ''}`,
      );
      pick(null);
      // 출근을 올렸으면 다음은 퇴근이다. 손으로 다시 고르게 두지 않는다.
      if (kind === 'in') setKind('out');
      loadMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록하지 못했습니다.');
    } finally {
      setSending(false);
    }
  };

  const today = me?.today ?? null;
  const inAt = hhmm(today?.checkInAt);
  const outAt = hhmm(today?.checkOutAt);

  return (
    <div className="mx-auto min-h-screen max-w-[520px] bg-bg px-4 pb-10 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <img src="/원방로고.png" alt="원방" className="h-8 w-8 shrink-0 rounded-[9px] bg-white object-contain p-0.5" />
        <h1 className="text-[17px] font-extrabold text-text-strong">출퇴근</h1>
        {isAdmin && (
          <Link to="/mobile/weigh" className="ml-auto text-[12.5px] text-text-sub underline">
            계근 등록
          </Link>
        )}
        <button type="button" onClick={logout} className={`${isAdmin ? '' : 'ml-auto '}text-[12.5px] text-text-sub underline`}>
          로그아웃
        </button>
      </div>

      {/* 오늘 무엇이 찍혔는지 먼저 보여 준다. 두 번 찍는 일이 없도록. */}
      <div className="mb-4 rounded-[12px] border border-border bg-card px-4 py-3">
        <p className="mb-1 text-[12.5px] text-text-faint">오늘 {me?.date ?? kstToday()}</p>
        <div className="flex items-center gap-4 text-[15px] font-bold text-text-strong">
          <span className="flex items-center gap-1.5">
            <LogIn size={15} className="text-success" /> 출근 {inAt ?? '-'}
          </span>
          <span className="flex items-center gap-1.5">
            <LogOut size={15} className="text-primary" /> 퇴근 {outAt ?? '-'}
          </span>
        </div>
        {today?.isDraft && (
          <p className="mt-1.5 text-[12px] font-semibold text-warning">임시저장 — 사무실에서 확인 후 정상등록됩니다.</p>
        )}
      </div>

      {/* 누구인지는 로그인한 계정으로 정해진다. 남의 이름으로 찍을 수 없다. */}
      <div className="mb-3">
        <span className={labelCls}>사용자</span>
        {me?.employee ? (
          <div className={`${field} font-bold`}>
            {me.employee.name}
            <span className="ml-2 text-[13px] font-normal text-text-sub">{me.employee.employmentType ?? ''}</span>
          </div>
        ) : (
          <div className="rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-3 text-[13px] text-danger">
            이 계정에 임직원 정보가 연결되어 있지 않습니다. 관리자에게 연결을 요청하세요.
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className={labelCls}>현장</label>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={field}>
          <option value="">고르세요</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.roundName}
            </option>
          ))}
        </select>
      </div>

      {/* 출근인지 퇴근인지 — 큼직하게 둘 중 하나 */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(['in', 'out'] as const).map((k) => {
          const at = k === 'in' ? hhmm(me?.today?.checkInAt) : hhmm(me?.today?.checkOutAt);
          return (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-[12px] border px-3 py-3 text-[15px] font-bold ${
                kind === k ? 'border-primary bg-primary/15 text-primary' : 'border-border text-text-sub'
              }`}
            >
              {k === 'in' ? '출근' : '퇴근'}
              {at && <span className="ml-1.5 text-[12.5px] font-normal">{at} 완료</span>}
            </button>
          );
        })}
      </div>

      {!me?.consented && (
        <div className="mb-4 rounded-[12px] border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-warning">
            <ShieldCheck size={15} /> 얼굴 사진 사용 동의 (처음 한 번)
          </p>
          <p className="mb-2 text-[12.5px] leading-relaxed text-text-sub">
            출퇴근 확인을 위해 얼굴이 담긴 사진과 찍은 위치를 기록합니다. 사진은 <b>본인 확인에만</b> 쓰이고,
            해당 월을 마감할 때 <b>모두 삭제</b>됩니다. 사진은 <b>관리자만</b> 볼 수 있습니다.
          </p>
          <label className="flex items-center gap-2 text-[13px] font-semibold text-text-strong">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="h-4 w-4" />
            위 내용에 동의합니다.
          </label>
        </div>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
        className="hidden"
      />
      {camOpen ? (
        <div className="mb-3">
          {/* 거울처럼 보여야 얼굴을 맞추기 쉽다. 저장되는 사진은 그대로다. */}
          <video
            ref={videoRef}
            playsInline
            muted
            className="mb-2 w-full rounded-[12px] border border-border"
            style={{ transform: 'scaleX(-1)' }}
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={stopCam}
              className="rounded-[12px] border border-border px-3 py-3 text-[15px] font-bold text-text-sub"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={shoot}
              className="rounded-[12px] bg-primary px-3 py-3 text-[15px] font-extrabold text-white"
            >
              촬영
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openCam}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-[12px] border border-primary bg-primary/10 px-3 py-4 text-[16px] font-bold text-primary"
        >
          <Camera size={18} /> {photo ? '다시 찍기' : '셀카 찍기'}
        </button>
      )}

      {preview && !camOpen && (
        <img src={preview} alt="찍은 사진" className="mb-3 w-full rounded-[12px] border border-border" />
      )}

      <p className="mb-3 flex items-center gap-1.5 text-[12.5px] text-text-sub">
        <MapPin size={13} className={place ? 'text-success' : 'text-text-faint'} />
        {placeNote || '위치 확인 중...'}
        {!place && (
          <button type="button" onClick={locate} className="underline">
            다시 시도
          </button>
        )}
      </p>

      {error && <p className="mb-3 text-[13px] font-semibold text-danger">{error}</p>}
      {done && (
        <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-success">
          <Check size={15} /> {done}
        </p>
      )}

      <button
        type="button"
        onClick={send}
        disabled={sending || !photo}
        className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-primary px-3 py-4 text-[17px] font-extrabold text-white disabled:opacity-50"
      >
        {sending ? <Loader2 size={18} className="animate-spin" /> : null}
        {!photo ? '셀카를 먼저 찍어 주세요' : kind === 'in' ? '출근 등록' : '퇴근 등록'}
      </button>

      <p className="mt-3 text-[12px] leading-relaxed text-text-faint">
        {appUser?.name ?? appUser?.email} · 올린 기록은 사무실에서 확인한 뒤 정상등록됩니다.
      </p>
    </div>
  );
}
