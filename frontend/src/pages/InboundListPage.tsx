import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { api } from '../api/client';
import { TransactionListLayout, EMPTY_FILTER, type Column, type TxFilter } from '../components/TransactionListLayout';
import { FormModal } from '../components/FormModal';
import { InboundFormPage } from './InboundFormPage';
import type { Inbound } from '../types';

const num = (v?: string | null) => (v == null ? null : Number(v));
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);

// 목록에는 핵심 항목만 둔다. 나머지 계근 항목은 행을 클릭해 상세에서 확인한다.
const COLUMNS: Column<Inbound>[] = [
  { header: '상차일', nowrap: true, render: (r) => r.inboundDate.slice(0, 10) },
  { header: '프로젝트명', render: (r) => show(r.project?.roundName) },
  { header: '하차지', render: (r) => show(r.unloadingPoint) },
  { header: '차량번호', nowrap: true, render: (r) => show(r.vehicleNo) },
  { header: '제품명', render: (r) => show(r.item?.itemName ?? r.itemName) },
  { header: '입고량(kg)', align: 'right', render: (r) => num(r.netWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.netWeight) },
];

const DETAIL_FIELDS = (r: Inbound) => [
  { label: '상차일', value: r.inboundDate.slice(0, 10) },
  { label: '프로젝트명', value: show(r.project?.roundName) },
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
  { label: '재고반영중량(kg)', value: num(r.stockWeight)?.toLocaleString() ?? '-' },
  { label: '비고', value: show(r.memo) },
];

export function InboundListPage() {
  const [rows, setRows] = useState<Inbound[]>([]);
  const [filter, setFilter] = useState<TxFilter>(EMPTY_FILTER);
  const [open, setOpen] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
    api.get<Inbound[]>(`/api/inbounds?${params.toString()}`).then(setRows);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const remove = async (row: Inbound) => {
    await api.del(`/api/inbounds/${row.id}`);
    load();
  };

  return (
    <>
      <TransactionListLayout
        title="입고(반입) 현황"
        icon={Truck}
        addLabel="입고 등록"
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
        editForm={(row, done) => (
          <InboundFormPage
            embedded
            record={row}
            onSaved={() => {
              done();
              load();
            }}
          />
        )}
        exportType="inbound"
        exportName="입고현황"
        emptyText="등록된 입고 내역이 없습니다."
      />

      {open && (
        <FormModal title="입고(반입) 등록" icon={Truck} onClose={() => setOpen(false)}>
          <InboundFormPage embedded onCreated={load} />
        </FormModal>
      )}
    </>
  );
}
