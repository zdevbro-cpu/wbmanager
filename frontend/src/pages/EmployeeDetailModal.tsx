import { useCallback, useEffect, useRef, useState } from 'react';
import { Users, Plus, Trash2, ChevronDown, Pencil } from 'lucide-react';
import { api, API_BASE_URL } from '../api/client';
import { auth } from '../lib/firebase';
import { formatPhone } from '../lib/phone';
import { useCommonCodes } from '../hooks/useMasters';
import { EMPLOYMENT_TYPES } from './EmployeeManagementPage';
import { FormModal } from '../components/FormModal';
import { EntityDocuments } from '../components/EntityDocuments';
import { QrCode } from '../components/QrCode';
import { NumberInput } from '../components/ui/NumberInput';
import { Badge } from '../components/ui/Badge';
import { primaryBtnCls, outlineBtnCls, inputCls } from '../components/ui/classes';
import type { Employee, EmployeeCertification, EmployeeTraining } from '../types';
import { DateField } from '../components/ui/DateField';

const TRAINING_TYPES = ['의무', '보수'];
const CERT_TYPES = ['국가기술자격', '면허', '교육이수증', '기타'];

function addMonths(date: string, months: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function daysLeft(due?: string | null) {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(due.slice(0, 10));
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function DDay({ due }: { due?: string | null }) {
  const left = daysLeft(due);
  if (left === null) return <span className="text-text-faint">-</span>;
  if (left < 0) return <Badge tone="red">D+{Math.abs(left)} 경과</Badge>;
  if (left === 0) return <Badge tone="red">D-DAY</Badge>;
  if (left <= 30) return <Badge tone="red">D-{left}</Badge>;
  return <Badge tone="slate">D-{left}</Badge>;
}

const day = (v?: string | null) => (v ? v.slice(0, 10) : '-');

// 상세 — 최근 내용 카드 + 히스토리(접이식) + 이력 추가.
// 자격 갱신·보수교육 재이수는 기존 행을 고치지 않고 새 행을 쌓아 이력을 남긴다.
export function EmployeeDetailModal({
  employeeId,
  initial,
  onClose,
  onChanged,
  onDelete,
}: {
  employeeId: string;
  /** 목록에서 이미 받아 둔 값 — 상세 조회가 늦거나 실패해도 화면이 비지 않게 한다. */
  initial?: Employee;
  onClose: () => void;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const [emp, setEmp] = useState<Employee | null>(initial ?? null);
  const [loadError, setLoadError] = useState('');
  const [adding, setAdding] = useState<'cert' | 'training' | null>(null);
  const [editing, setEditing] = useState(false);
  const [editCert, setEditCert] = useState<EmployeeCertification | null>(null);
  const [editTraining, setEditTraining] = useState<EmployeeTraining | null>(null);
  const { labels: certOptions } = useCommonCodes('자격증 종류');
  const { labels: trainingOptions } = useCommonCodes('교육 과정');

  const load = useCallback(() => {
    api
      .get<Employee>(`/api/employees/${employeeId}`)
      .then((row) => {
        setEmp(row);
        setLoadError('');
      })
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : '상세를 불러오지 못했습니다.'));
  }, [employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    load();
    onChanged();
  };

  // 만료가 임박한 순. 여러 건을 보유했을 때 급한 것이 먼저 보여야 한다.
  const byUrgency = <T,>(rows: T[], due: (r: T) => string | null | undefined) =>
    [...rows].sort((a, b) => {
      const da = due(a) ? new Date(due(a) as string).getTime() : Number.POSITIVE_INFINITY;
      const db = due(b) ? new Date(due(b) as string).getTime() : Number.POSITIVE_INFINITY;
      return da - db;
    });

  const certs = byUrgency(emp?.certifications ?? [], (c) => c.expiryDate ?? c.acquiredDate);
  const trainings = byUrgency(emp?.trainings ?? [], (t) => t.nextDueDate ?? t.trainingDate);

  const removeCert = async (id: string) => {
    if (!window.confirm('이 자격 이력을 삭제하시겠습니까?')) return;
    await api.del(`/api/employees/${employeeId}/certifications/${id}`);
    refresh();
  };

  const removeTraining = async (id: string) => {
    if (!window.confirm('이 교육 이력을 삭제하시겠습니까?')) return;
    await api.del(`/api/employees/${employeeId}/trainings/${id}`);
    refresh();
  };

  return (
    <FormModal title={`${emp?.name ?? ''} 상세`} icon={Users} onClose={onClose}>
      {!emp ? (
        <p className={loadError ? 'text-[13px] text-danger' : 'text-[13px] text-text-sub'}>
          {loadError || '불러오는 중...'}
        </p>
      ) : (
        <div className="space-y-5">
          {loadError && <p className="text-[12.5px] text-danger">최신 정보를 불러오지 못했습니다: {loadError}</p>}
          <div className="flex items-center gap-2">
            <Badge tone="blue">{emp.empCode ?? '-'}</Badge>
            <span className="text-[13px] text-text-sub">
              {[emp.department, emp.position].filter(Boolean).join(' · ') || '부서·직급 미지정'}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={`${outlineBtnCls} ml-auto h-8 px-3 text-[12.5px]`}
            >
              <Pencil size={14} /> 정보 수정
            </button>
            <button type="button" onClick={() => setAdding('cert')} className={`${outlineBtnCls} h-8 px-3 text-[12.5px]`}>
              <Plus size={14} /> 자격 이력 추가
            </button>
            <button type="button" onClick={() => setAdding('training')} className={`${outlineBtnCls} h-8 px-3 text-[12.5px]`}>
              <Plus size={14} /> 교육 이력 추가
            </button>
          </div>

          <div className="flex gap-5">
            {editing ? (
              <BasicInfoForm
                emp={emp}
                onDone={() => {
                  setEditing(false);
                  refresh();
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <dl className="grid flex-1 grid-cols-2 gap-x-5 gap-y-2">
                {[
                  { label: '사번', value: emp.empCode ?? '-' },
                  { label: '성명', value: emp.name },
                  { label: '연락처', value: emp.phone ?? '-' },
                  { label: '입사일', value: day(emp.hireDate) },
                  { label: '부서', value: emp.department ?? '-' },
                  { label: '직급', value: emp.position ?? '-' },
                ].map((f) => (
                  <div key={f.label} className="flex justify-between gap-3 border-b border-border pb-1.5">
                    <dt className="text-[12.5px] text-text-sub">{f.label}</dt>
                    <dd className="text-[13px] font-semibold text-text-strong">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {emp.empCode && (
              <div className="shrink-0">
                <QrCode value={emp.empCode} fileName={`${emp.empCode}_${emp.name}`} size={130} />
              </div>
            )}
          </div>

          {(adding === 'cert' || editCert) && (
            <CertForm
              key={editCert?.id ?? 'new-cert'}
              employeeId={employeeId}
              options={certOptions}
              edit={editCert ?? undefined}
              onDone={() => {
                setAdding(null);
                setEditCert(null);
                refresh();
              }}
              onCancel={() => {
                setAdding(null);
                setEditCert(null);
              }}
            />
          )}
          {(adding === 'training' || editTraining) && (
            <TrainingForm
              key={editTraining?.id ?? 'new-training'}
              employeeId={employeeId}
              options={trainingOptions}
              edit={editTraining ?? undefined}
              onDone={() => {
                setAdding(null);
                setEditTraining(null);
                refresh();
              }}
              onCancel={() => {
                setAdding(null);
                setEditTraining(null);
              }}
            />
          )}

          <HistorySection
            title="자격사항"
            total={certs.length}
            emptyText="등록된 자격사항이 없습니다."
            onEditLatest={certs[0] ? () => setEditCert(certs[0]) : undefined}
            onRemoveLatest={certs[0] ? () => removeCert(certs[0].id) : undefined}
            latest={
              certs[0] ? (
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <Field label="자격증명" value={certs[0].certName} />
                  <Field label="구분" value={certs[0].certType ?? '-'} />
                  <Field label="취득일" value={day(certs[0].acquiredDate)} />
                  <Field label="만료일" value={day(certs[0].expiryDate)} />
                  <div className="flex justify-between gap-3">
                    <span className="text-[12.5px] text-text-sub">잔여</span>
                    <DDay due={certs[0].expiryDate} />
                  </div>
                </div>
              ) : null
            }
            rows={certs.slice(1).map((c) => ({
              id: c.id,
              badge: <Badge tone="slate">{c.certType ?? '자격'}</Badge>,
              summary: `${c.certName} · ${day(c.acquiredDate)} ~ ${day(c.expiryDate)}`,
              onEdit: () => setEditCert(c),
              onRemove: () => removeCert(c.id),
            }))}
          />

          <HistorySection
            title="교육이력"
            total={trainings.length}
            emptyText="등록된 교육이력이 없습니다."
            onEditLatest={trainings[0] ? () => setEditTraining(trainings[0]) : undefined}
            onRemoveLatest={trainings[0] ? () => removeTraining(trainings[0].id) : undefined}
            latest={
              trainings[0] ? (
                <div className="grid grid-cols-2 gap-x-5 gap-y-2">
                  <Field label="교육명" value={trainings[0].trainingName} />
                  <Field label="구분" value={trainings[0].trainingType ?? '-'} />
                  <Field label="이수일" value={day(trainings[0].trainingDate)} />
                  <Field label="다음 예정일" value={day(trainings[0].nextDueDate)} />
                  <div className="flex justify-between gap-3">
                    <span className="text-[12.5px] text-text-sub">잔여</span>
                    <DDay due={trainings[0].nextDueDate} />
                  </div>
                </div>
              ) : null
            }
            rows={trainings.slice(1).map((t) => ({
              id: t.id,
              badge: <Badge tone={t.trainingType === '의무' ? 'amber' : 'blue'}>{t.trainingType ?? '교육'}</Badge>,
              summary: `${t.trainingName} · 이수 ${day(t.trainingDate)} · 다음 ${day(t.nextDueDate)}`,
              onEdit: () => setEditTraining(t),
              onRemove: () => removeTraining(t.id),
            }))}
          />

          {/* 근로계약서·자격증 사본 등 이 직원의 문서 — 분류·버전·이력이 함께 남는다. */}
          <div className="border-t border-border pt-4">
            <EntityDocuments entityType="employee" entityId={employeeId} />
          </div>

          <div className="flex justify-end border-t border-border pt-3">
            <button type="button" onClick={onDelete} className={`${outlineBtnCls} text-danger`}>
              <Trash2 size={15} /> 임직원 삭제
            </button>
          </div>
        </div>
      )}
    </FormModal>
  );
}

// 기본정보 수정 — 사번은 근태 QR 식별자라 바꾸지 않는다.
function BasicInfoForm({
  emp,
  onDone,
  onCancel,
}: {
  emp: Employee;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { labels: departmentOptions } = useCommonCodes('부서');
  const { labels: positionOptions } = useCommonCodes('직급');

  const [name, setName] = useState(emp.name);
  const [phone, setPhone] = useState(emp.phone ?? '');
  const [department, setDepartment] = useState(emp.department ?? '');
  const [position, setPosition] = useState(emp.position ?? '');
  const [hireDate, setHireDate] = useState(emp.hireDate ? emp.hireDate.slice(0, 10) : '');
  const [employmentType, setEmploymentType] = useState(emp.employmentType ?? '정규직');
  // 정규직 외 인원의 품값 기준 — 공수표가 이 값으로 채워진다.
  const [unitCost, setUnitCost] = useState(emp.unitCost ?? '');
  const [mealCost, setMealCost] = useState(emp.mealCost ?? '');
  const [etcCost, setEtcCost] = useState(emp.etcCost ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 출퇴근 셀카를 견줄 기준 사진. 한 사람에 한 장이고, 새로 올리면 앞의 것은 치운다.
  const [photoAt, setPhotoAt] = useState(Date.now());
  const [hasPhoto, setHasPhoto] = useState(Boolean(emp.photoDriveId));
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasPhoto) {
      setPhotoUrl('');
      return;
    }
    let made = '';
    let dropped = false;
    (async () => {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch(`${API_BASE_URL}/api/employees/${emp.id}/photo`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok || dropped) return;
      made = URL.createObjectURL(await res.blob());
      setPhotoUrl(made);
    })();
    return () => {
      dropped = true;
      if (made) URL.revokeObjectURL(made);
    };
  }, [emp.id, hasPhoto, photoAt]);

  const uploadPhoto = async (file: File | null) => {
    if (!file) return;
    setError('');
    setPhotoBusy(true);
    try {
      const form = new FormData();
      form.append('photo', file);
      await api.post(`/api/employees/${emp.id}/photo`, form);
      setHasPhoto(true);
      setPhotoAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진을 올리지 못했습니다.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!window.confirm('기준 사진을 지울까요?')) return;
    setPhotoBusy(true);
    try {
      await api.del(`/api/employees/${emp.id}/photo`);
      setHasPhoto(false);
      setPhotoAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : '사진을 지우지 못했습니다.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setSaving(true);
    try {
      await api.patch(`/api/employees/${emp.id}`, {
        name,
        phone,
        department,
        position,
        hireDate,
        employmentType,
        unitCost,
        mealCost,
        etcCost,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const label = 'mb-1 block text-[12px] font-semibold text-text-sub';

  return (
    <form onSubmit={submit} className="flex-1 rounded-[10px] border border-primary/40 bg-input p-3.5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
        <div>
          <span className={label}>사번</span>
          <div className="flex h-[38px] items-center text-[13px] font-semibold text-text-faint">
            {emp.empCode ?? '-'} <span className="ml-2 text-[11.5px]">(변경 불가)</span>
          </div>
        </div>
        <div>
          <label className={label}>성명</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
        </div>
        <div>
          <label className={label}>연락처</label>
          <input
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            className={inputCls}
          />
        </div>
        <div>
          <label className={label}>입사일</label>
          <DateField value={hireDate} onChange={(e) => setHireDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={label}>부서</label>
          <input
            list="edit-departments"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className={inputCls}
          />
          <datalist id="edit-departments">
            {departmentOptions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>
        <div>
          {/* 공수표가 이 값으로 갈린다 — 정규직은 근태, 그 밖은 공수. */}
          <label className={label}>고용 구분</label>
          <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)} className={inputCls}>
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>직급</label>
          <input list="edit-positions" value={position} onChange={(e) => setPosition(e.target.value)} className={inputCls} />
          <datalist id="edit-positions">
            {positionOptions.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </div>

        {/* 정규직 외 인원만 품값을 정해 둔다 — 정규직은 근태로 세고 단가를 쓰지 않는다. */}
        {employmentType !== '정규직' && (
          <>
            <div>
              <label className={label}>1공수 단가(원)</label>
              <NumberInput value={unitCost} onChange={setUnitCost} />
            </div>
            <div>
              <label className={label}>하루 식대(원)</label>
              <NumberInput value={mealCost} onChange={setMealCost} />
            </div>
            <div>
              <label className={label}>하루 기타비용(원)</label>
              <NumberInput value={etcCost} onChange={setEtcCost} />
            </div>
          </>
        )}
      </div>

      {/* 기준 사진 — 현장에서 찍은 셀카와 견주는 데 쓴다. */}
      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3">
        <div className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[10px] border border-border bg-input">
          {hasPhoto ? (
            <img src={photoUrl} alt="기준 사진" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[11px] text-text-faint">없음</div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-text-sub">기준 사진</p>
          <p className="mb-1.5 text-[11.5px] text-text-faint">출퇴근 셀카를 견주는 데 씁니다.</p>
          <div className="flex gap-2">
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              onChange={(e) => uploadPhoto(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => photoRef.current?.click()}
              className={`${outlineBtnCls} h-8 px-2.5 text-[12px]`}
            >
              {photoBusy ? '올리는 중...' : hasPhoto ? '바꾸기' : '사진 올리기'}
            </button>
            {hasPhoto && (
              <button
                type="button"
                disabled={photoBusy}
                onClick={removePhoto}
                className={`${outlineBtnCls} h-8 px-2.5 text-[12px] text-danger`}
              >
                지우기
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={`${outlineBtnCls} h-9 px-3`}>
          취소
        </button>
        <button type="submit" disabled={saving} className={`${primaryBtnCls} h-9 px-4`}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[12.5px] text-text-sub">{label}</span>
      <span className="text-[13px] font-semibold text-text-strong">{value}</span>
    </div>
  );
}

// 최근 1건은 카드로 펼쳐 두고, 지난 이력은 건수와 함께 접어 둔다.
function HistorySection({
  title,
  latest,
  rows,
  total,
  onEditLatest,
  onRemoveLatest,
  emptyText,
}: {
  title: string;
  latest: React.ReactNode;
  rows: { id: string; badge: React.ReactNode; summary: string; onEdit: () => void; onRemove: () => void }[];
  total: number;
  onEditLatest?: () => void;
  onRemoveLatest?: () => void;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* 삭제 버튼을 카드 위에 겹쳐 놓으면 우측 정렬된 첫 줄 값(취득일·구분)을 가린다.
          제목 줄에 두어 값과 부딪히지 않게 한다. */}
      <div className="mb-2 flex items-center gap-3">
        <h3 className="text-[14px] font-extrabold text-text-strong">최근 {title}</h3>
        {onEditLatest && (
          <button
            type="button"
            onClick={onEditLatest}
            title="수정"
            className="ml-auto flex items-center gap-1 text-[12px] text-text-faint hover:text-primary"
          >
            <Pencil size={13} /> 수정
          </button>
        )}
        {onRemoveLatest && (
          <button
            type="button"
            onClick={onRemoveLatest}
            title="삭제"
            className={`flex items-center gap-1 text-[12px] text-text-faint hover:text-danger ${onEditLatest ? '' : 'ml-auto'}`}
          >
            <Trash2 size={13} /> 삭제
          </button>
        )}
      </div>
      {latest ? (
        <div className="rounded-[10px] border border-border bg-input p-3.5">{latest}</div>
      ) : (
        <p className="text-[13px] text-text-faint">{emptyText}</p>
      )}

      {rows.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-text-strong"
          >
            {title} 히스토리 <span className="text-text-faint">({total})</span>
            <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
          </button>
          {open && (
            <div className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-[8px] border border-border px-3 py-2">
                  {r.badge}
                  <span className="text-[13px] text-text">{r.summary}</span>
                  <button
                    type="button"
                    onClick={r.onEdit}
                    title="수정"
                    className="ml-auto text-text-faint hover:text-primary"
                  >
                    <Pencil size={14} />
                  </button>
                  <button type="button" onClick={r.onRemove} title="삭제" className="text-text-faint hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 추가·수정 겸용. edit이 있으면 그 행을 고치고, 없으면 새 이력을 쌓는다.
function CertForm({
  employeeId,
  options,
  edit,
  onDone,
  onCancel,
}: {
  employeeId: string;
  options: string[];
  edit?: EmployeeCertification;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [certName, setCertName] = useState(edit?.certName ?? '');
  const [certType, setCertType] = useState(edit?.certType ?? CERT_TYPES[0]);
  const [acquiredDate, setAcquiredDate] = useState(edit?.acquiredDate?.slice(0, 10) ?? '');
  const [expiryDate, setExpiryDate] = useState(edit?.expiryDate?.slice(0, 10) ?? '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!certName.trim()) return;
    const body = { certName, certType, acquiredDate, expiryDate };
    if (edit) {
      await api.patch(`/api/employees/${employeeId}/certifications/${edit.id}`, body);
    } else {
      await api.post(`/api/employees/${employeeId}/certifications`, body);
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="rounded-[10px] border border-primary/40 bg-input p-3.5">
      <p className="mb-2 text-[13px] font-bold text-text-strong">
        {edit ? (
          <>
            자격 이력 수정 <span className="font-normal text-text-faint">— 잘못 적은 값을 고칩니다</span>
          </>
        ) : (
          <>
            자격 이력 추가 <span className="font-normal text-text-faint">— 갱신 시에도 새 이력으로 쌓입니다</span>
          </>
        )}
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,132px)_minmax(0,150px)_minmax(0,150px)_auto] items-center gap-2">
        <input
          list="detail-certs"
          value={certName}
          onChange={(e) => setCertName(e.target.value)}
          placeholder="자격증명"
          className={`${inputCls} min-w-0`}
        />
        <datalist id="detail-certs">
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <select
          value={certType}
          onChange={(e) => setCertType(e.target.value)}
          aria-label="구분"
          className={`${inputCls} min-w-0 px-2`}
        >
          {CERT_TYPES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <DateField
          value={acquiredDate}
          onChange={(e) => setAcquiredDate(e.target.value)}
          aria-label="취득일"
          className={`${inputCls} min-w-0`}
        />
        <DateField
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          aria-label="만료일"
          className={`${inputCls} min-w-0`}
        />
        <div className="flex gap-2">
          <button type="submit" className={`${primaryBtnCls} h-9 whitespace-nowrap px-4`}>
            {edit ? '저장' : '추가'}
          </button>
          <button type="button" onClick={onCancel} className={`${outlineBtnCls} h-9 px-3`}>
            취소
          </button>
        </div>
      </div>
    </form>
  );
}

function TrainingForm({
  employeeId,
  options,
  edit,
  onDone,
  onCancel,
}: {
  employeeId: string;
  options: string[];
  edit?: EmployeeTraining;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [trainingName, setTrainingName] = useState(edit?.trainingName ?? '');
  const [trainingType, setTrainingType] = useState(edit?.trainingType ?? '의무');
  const [trainingDate, setTrainingDate] = useState(edit?.trainingDate?.slice(0, 10) ?? '');
  const [cycleMonths, setCycleMonths] = useState(edit?.cycleMonths ? String(edit.cycleMonths) : '12');
  const [nextDueDate, setNextDueDate] = useState(edit?.nextDueDate?.slice(0, 10) ?? '');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainingName.trim()) return;
    const body = {
      trainingName,
      trainingType,
      trainingDate,
      cycleMonths,
      // 비우면 이수일 + 주기로 서버가 산출한다.
      nextDueDate,
    };
    if (edit) {
      await api.patch(`/api/employees/${employeeId}/trainings/${edit.id}`, body);
    } else {
      await api.post(`/api/employees/${employeeId}/trainings`, body);
    }
    onDone();
  };

  return (
    <form onSubmit={submit} className="rounded-[10px] border border-primary/40 bg-input p-3.5">
      <p className="mb-2 text-[13px] font-bold text-text-strong">
        {edit ? (
          <>
            교육 이력 수정 <span className="font-normal text-text-faint">— 잘못 적은 값을 고칩니다</span>
          </>
        ) : (
          <>
            교육 이력 추가 <span className="font-normal text-text-faint">— 재이수 시에도 새 이력으로 쌓입니다</span>
          </>
        )}
      </p>
      <div className="grid grid-cols-[minmax(0,1fr)_84px_minmax(0,132px)_72px_minmax(0,132px)_auto] items-center gap-2">
        <input
          list="detail-trainings"
          value={trainingName}
          onChange={(e) => setTrainingName(e.target.value)}
          placeholder="교육명"
          className={`${inputCls} min-w-0`}
        />
        <datalist id="detail-trainings">
          {options.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        <select
          value={trainingType}
          onChange={(e) => setTrainingType(e.target.value)}
          aria-label="구분"
          className={`${inputCls} min-w-0 px-2`}
        >
          {TRAINING_TYPES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <DateField
          value={trainingDate}
          onChange={(e) => setTrainingDate(e.target.value)}
          aria-label="이수일"
          className={`${inputCls} min-w-0`}
        />
        <input
          type="number"
          min="1"
          value={cycleMonths}
          onChange={(e) => setCycleMonths(e.target.value)}
          aria-label="주기(개월)"
          placeholder="주기"
          className={`${inputCls} min-w-0 px-2`}
        />
        <DateField
          value={nextDueDate}
          onChange={(e) => setNextDueDate(e.target.value)}
          aria-label="다음 예정일"
          placeholder={trainingDate && cycleMonths ? addMonths(trainingDate, Number(cycleMonths)) : ''}
          className={`${inputCls} min-w-0`}
        />
        <div className="flex gap-2">
          <button type="submit" className={`${primaryBtnCls} h-9 whitespace-nowrap px-4`}>
            {edit ? '저장' : '추가'}
          </button>
          <button type="button" onClick={onCancel} className={`${outlineBtnCls} h-9 px-3`}>
            취소
          </button>
        </div>
      </div>
    </form>
  );
}
