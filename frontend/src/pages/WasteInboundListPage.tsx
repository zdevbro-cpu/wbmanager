import { useEffect, useState } from 'react';
import { Recycle } from 'lucide-react';
import { api } from '../api/client';
import { TransactionListLayout, EMPTY_FILTER, type Column, type TxFilter } from '../components/TransactionListLayout';
import { FormModal } from '../components/FormModal';
import { WasteInboundFormPage } from './WasteInboundFormPage';
import { Badge } from '../components/ui/Badge';
import type { WasteInbound } from '../types';

const num = (v?: string | null) => (v == null ? null : Number(v));
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);

// 원본 `폐기물 입고` 시트와 같은 컬럼 구성
const COLUMNS: Column<WasteInbound>[] = [
  { header: '인수일', nowrap: true, render: (r) => r.receiveDate.slice(0, 10) },
  { header: '인계일', nowrap: true, render: (r) => (r.handoverDate ? r.handoverDate.slice(0, 10) : '-') },
  {
    header: '올바로',
    render: (r) => (r.olbaroReported ? <Badge tone="green">O</Badge> : <Badge tone="red">X</Badge>),
  },
  { header: '프로젝트명', render: (r) => show(r.project?.roundName) },
  { header: '배출자', render: (r) => show(r.dischargerName) },
  { header: '하차지', render: (r) => show(r.unloadingPoint) },
  { header: '차종', render: (r) => show(r.vehicleType) },
  { header: '차량번호', nowrap: true, render: (r) => show(r.vehicleNo) },
  { header: '운전자', render: (r) => show(r.driverName) },
  { header: '연락처', nowrap: true, render: (r) => show(r.driverPhone) },
  { header: '제품명', render: (r) => show(r.item?.itemName ?? r.itemName) },
  { header: '총중량(kg)', align: 'right', render: (r) => num(r.grossWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.grossWeight) },
  { header: '공차중량(kg)', align: 'right', render: (r) => num(r.tareWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.tareWeight) },
  { header: '감량(kg)', align: 'right', render: (r) => num(r.lossWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.lossWeight) },
  { header: '입고량(kg)', align: 'right', render: (r) => num(r.netWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.netWeight) },
  { header: '비고', render: (r) => show(r.memo) },
];

const DETAIL_FIELDS = (r: WasteInbound) => [
  { label: '인수일', value: r.receiveDate.slice(0, 10) },
  { label: '인계일', value: r.handoverDate ? r.handoverDate.slice(0, 10) : '-' },
  { label: '올바로', value: r.olbaroReported ? 'O' : 'X' },
  { label: '프로젝트명', value: show(r.project?.roundName) },
  { label: '배출자', value: show(r.dischargerName) },
  { label: '하차지', value: show(r.unloadingPoint) },
  { label: '차종', value: show(r.vehicleType) },
  { label: '차량번호', value: show(r.vehicleNo) },
  { label: '운전자', value: show(r.driverName) },
  { label: '연락처', value: show(r.driverPhone) },
  { label: '제품명', value: show(r.item?.itemName ?? r.itemName) },
  { label: '총중량(kg)', value: num(r.grossWeight)?.toLocaleString() ?? '-' },
  { label: '공차중량(kg)', value: num(r.tareWeight)?.toLocaleString() ?? '-' },
  { label: '감량(kg)', value: num(r.lossWeight)?.toLocaleString() ?? '-' },
  { label: '입고량(kg)', value: num(r.netWeight)?.toLocaleString() ?? '-' },
  { label: '비고', value: show(r.memo) },
];

export function WasteInboundListPage() {
  const [rows, setRows] = useState<WasteInbound[]>([]);
  const [filter, setFilter] = useState<TxFilter>(EMPTY_FILTER);
  const [open, setOpen] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
    api.get<WasteInbound[]>(`/api/waste-inbounds?${params.toString()}`).then(setRows);
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
        title="폐기물 입고 현황"
        icon={Recycle}
        addLabel="폐기물 입고 등록"
        dateLabel="입고구간"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        attachments={(r) => r.attachments ?? []}
        detailFields={DETAIL_FIELDS}
        filter={filter}
        setFilter={setFilter}
        onAdd={() => setOpen(true)}
        onDelete={remove}
        exportType="waste_inbound"
        exportName="폐기물입고현황"
        emptyText="등록된 폐기물 입고 내역이 없습니다."
      />

      {open && (
        <FormModal title="폐기물 입고 등록" icon={Recycle} onClose={() => setOpen(false)}>
          <WasteInboundFormPage embedded onCreated={load} />
        </FormModal>
      )}
    </>
  );
}
