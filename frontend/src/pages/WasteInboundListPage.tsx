import { useEffect, useState } from 'react';
import { Recycle } from 'lucide-react';
import { api } from '../api/client';
import { TransactionListLayout, EMPTY_FILTER, type Column, type TxFilter } from '../components/TransactionListLayout';
import { useFilterSuggestions } from '../hooks/useFilterSuggestions';
import { FormModal } from '../components/FormModal';
import { WasteInboundFormPage } from './WasteInboundFormPage';
import { Badge } from '../components/ui/Badge';
import type { WasteInbound } from '../types';

const num = (v?: string | null) => (v == null ? null : Number(v));
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);

const date = (v?: string | null) => (v ? v.slice(0, 10) : '-');
// 실중량·정산중량은 입력값이 없으면 계근값에서 뽑아 쓴다.
const actual = (r: WasteInbound) => num(r.actualWeight) ?? (num(r.grossWeight) ?? 0) - (num(r.tareWeight) ?? 0);
const settled = (r: WasteInbound) => num(r.settledWeight) ?? num(r.netWeight);

// 수집·운반 현황 — 화면에는 운반에 필요한 항목만 둔다.
// 차종·총중량·공차중량·감량 등 계근 상세와 정산 항목은 행을 눌러 상세에서 본다.
const COLUMNS: Column<WasteInbound>[] = [
  { header: '상차일', nowrap: true, render: (r) => date(r.receiveDate) },
  { header: '인계일', nowrap: true, render: (r) => date(r.handoverDate) },
  {
    header: '올바로',
    render: (r) => (r.olbaroReported ? <Badge tone="green">O</Badge> : <Badge tone="red">X</Badge>),
  },
  { header: '프로젝트명', render: (r) => show(r.project?.roundName) },
  { header: '배출자', render: (r) => show(r.dischargerName) },
  { header: '하차지', render: (r) => show(r.unloadingPoint) },
  { header: '차량번호', nowrap: true, render: (r) => show(r.vehicleNo) },
  { header: '제품명', render: (r) => show(r.item?.itemName ?? r.itemName) },
  { header: '입고량(kg)', align: 'right', render: (r) => num(r.netWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.netWeight) },
  { header: '비고', render: (r) => show(r.memo) },
];

const DETAIL_FIELDS = (r: WasteInbound) => [
  { label: '상차일', value: date(r.receiveDate) },
  { label: '인계일', value: date(r.handoverDate) },
  { label: '올바로', value: r.olbaroReported ? 'O' : 'X' },
  { label: '프로젝트명', value: show(r.project?.roundName) },
  { label: '배출자', value: show(r.dischargerName) },
  { label: '운반자', value: show(r.transporterName) },
  { label: '하차지', value: show(r.unloadingPoint) },
  { label: '차종', value: show(r.vehicleType) },
  { label: '차량번호', value: show(r.vehicleNo) },
  { label: '운전자', value: show(r.driverName) },
  { label: '연락처', value: show(r.driverPhone) },
  { label: '처리자', value: show(r.processorName) },
  { label: '제품명', value: show(r.item?.itemName ?? r.itemName) },
  { label: '총중량(kg)', value: num(r.grossWeight)?.toLocaleString() ?? '-' },
  { label: '공차중량(kg)', value: num(r.tareWeight)?.toLocaleString() ?? '-' },
  { label: '감량(kg)', value: num(r.lossWeight)?.toLocaleString() ?? '-' },
  { label: '실중량(kg)', value: actual(r)?.toLocaleString() ?? '-' },
  { label: '입고량(kg)', value: num(r.netWeight)?.toLocaleString() ?? '-' },
  { label: '정산중량(kg)', value: settled(r)?.toLocaleString() ?? '-' },
  { label: '루베 적용', value: num(r.cubicMeter)?.toLocaleString() ?? '-' },
  { label: '비고', value: show(r.memo) },
];

export function WasteInboundListPage() {
  const [rows, setRows] = useState<WasteInbound[]>([]);
  const [filter, setFilter] = useState<TxFilter>(EMPTY_FILTER);
  const [open, setOpen] = useState(false);
  const { suggestions, collect } = useFilterSuggestions();

  const load = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
    api.get<WasteInbound[]>(`/api/waste-inbounds?${params.toString()}`).then((list) => {
      setRows(list);
      collect(list);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const remove = async (row: WasteInbound) => {
    await api.del(`/api/waste-inbounds/${row.id}`);
    load();
  };

  return (
    <>
      <TransactionListLayout
        title="폐기물 수집·운반 현황"
        icon={Recycle}
        addLabel="수집·운반 등록"
        dateLabel="입고구간"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        attachments={(r) => r.attachments ?? []}
        detailFields={DETAIL_FIELDS}
        filter={filter}
        setFilter={setFilter}
        suggestions={suggestions}
        filterKeys={['projectId', 'date', 'itemCode', 'vehicleNo', 'olbaro',
          'draft', 'dischargerName', 'transporterName', 'processorName']}
        onAdd={() => setOpen(true)}
        onDelete={remove}
        reload={load}
        isDraft={(r) => r.isDraft === true}
        onConfirm={async (r) => {
          await api.patch(`/api/waste-inbounds/${r.id}`, { isDraft: false });
        }}
        editForm={(row, done) => (
          <WasteInboundFormPage
            embedded
            record={row}
            onSaved={() => {
              done();
              load();
            }}
          />
        )}
        exportType="waste_inbound"
        exportName="폐기물수집운반현황"
        emptyText="등록된 수집·운반 내역이 없습니다."
      />

      {open && (
        <FormModal title="폐기물 수집·운반 등록" icon={Recycle} wide onClose={() => setOpen(false)}>
          <WasteInboundFormPage
            embedded
            onCreated={() => {
              load();
              setOpen(false);
            }}
          />
        </FormModal>
      )}
    </>
  );
}
