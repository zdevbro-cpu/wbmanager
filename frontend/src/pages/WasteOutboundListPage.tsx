import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { TransactionListLayout, EMPTY_FILTER, type Column, type TxFilter } from '../components/TransactionListLayout';
import { FormModal } from '../components/FormModal';
import { WasteOutboundFormPage } from './WasteOutboundFormPage';
import { Badge } from '../components/ui/Badge';
import type { WasteOutbound } from '../types';

const num = (v?: string | null) => (v == null ? null : Number(v));
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);
const date = (v?: string | null) => (v ? v.slice(0, 10) : '-');

// 목록에는 핵심 항목만 둔다. 나머지 계근·정산 항목은 행을 클릭해 상세에서 확인한다.
const COLUMNS: Column<WasteOutbound>[] = [
  { header: '상차일', nowrap: true, render: (r) => date(r.outboundDate) },
  { header: '인계일', nowrap: true, render: (r) => date(r.handoverDate) },
  {
    header: '올바로',
    render: (r) => (r.olbaroReported ? <Badge tone="green">O</Badge> : <Badge tone="red">X</Badge>),
  },
  { header: '프로젝트명', render: (r) => show(r.project?.roundName) },
  { header: '배출자', render: (r) => show(r.dischargerName) },
  { header: '운반자', render: (r) => show(r.transporterName) },
  { header: '차량번호', nowrap: true, render: (r) => show(r.vehicleNo) },
  { header: '처리자', render: (r) => show(r.buyer?.name) },
  { header: '제품명', render: (r) => show(r.item?.itemName ?? r.itemName) },
  { header: '실중량(kg)', align: 'right', render: (r) => num(r.actualWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.actualWeight) },
  { header: '정산 중량(kg)', align: 'right', render: (r) => num(r.weight)?.toLocaleString() ?? '-', sum: (r) => num(r.weight) },
  { header: '루베 적용', align: 'right', render: (r) => num(r.cubicMeter)?.toLocaleString() ?? '-' },
  { header: '단가(원)', align: 'right', render: (r) => num(r.unitPrice)?.toLocaleString() ?? '-' },
  { header: '금액(원)', align: 'right', render: (r) => num(r.amount)?.toLocaleString() ?? '-', sum: (r) => num(r.amount) },
  { header: '이체일', nowrap: true, render: (r) => date(r.transferDate) },
];

const DETAIL_FIELDS = (r: WasteOutbound) => [
  { label: '상차일', value: date(r.outboundDate) },
  { label: '인계일', value: date(r.handoverDate) },
  { label: '올바로', value: r.olbaroReported ? 'O' : 'X' },
  { label: '프로젝트명', value: show(r.project?.roundName) },
  { label: '배출자', value: show(r.dischargerName) },
  { label: '운반자', value: show(r.transporterName) },
  { label: '상차지', value: show(r.loadingPoint) },
  { label: '차종', value: show(r.vehicleType) },
  { label: '차량번호', value: show(r.vehicleNo) },
  { label: '운전자', value: show(r.driverName) },
  { label: '연락처', value: show(r.driverPhone) },
  { label: '처리자', value: show(r.buyer?.name) },
  { label: '제품명', value: show(r.item?.itemName ?? r.itemName) },
  { label: '공차중량(kg)', value: num(r.tareWeight)?.toLocaleString() ?? '-' },
  { label: '총중량(kg)', value: num(r.grossWeight)?.toLocaleString() ?? '-' },
  { label: '실중량(kg)', value: num(r.actualWeight)?.toLocaleString() ?? '-' },
  { label: '거래처 감량 전 실중량(kg)', value: num(r.preLossWeight)?.toLocaleString() ?? '-' },
  { label: '감량(kg)', value: num(r.lossWeight)?.toLocaleString() ?? '-' },
  { label: '정산 중량(kg)', value: num(r.weight)?.toLocaleString() ?? '-' },
  { label: '루베 적용', value: num(r.cubicMeter)?.toLocaleString() ?? '-' },
  { label: '단가(원)', value: num(r.unitPrice)?.toLocaleString() ?? '-' },
  { label: '금액(원)', value: num(r.amount)?.toLocaleString() ?? '-' },
  { label: '구분', value: show(r.category) },
  { label: '자회사 출고', value: r.isSubsidiary ? 'O' : '-' },
  { label: '이체일', value: date(r.transferDate) },
  { label: '올바로 메모', value: show(r.olbaroMemo) },
  { label: '비고', value: show(r.memo) },
];

export function WasteOutboundListPage() {
  const [rows, setRows] = useState<WasteOutbound[]>([]);
  const [filter, setFilter] = useState<TxFilter>(EMPTY_FILTER);
  const [open, setOpen] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
    api.get<WasteOutbound[]>(`/api/waste-outbounds?${params.toString()}`).then(setRows);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const remove = async (row: WasteOutbound) => {
    await api.del(`/api/waste-outbounds/${row.id}`);
    load();
  };

  return (
    <>
      <TransactionListLayout
        title="폐기물 반출 현황"
        icon={Trash2}
        addLabel="폐기물 반출 등록"
        dateLabel="상차구간"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        attachments={(r) => r.attachments ?? []}
        detailFields={DETAIL_FIELDS}
        filter={filter}
        setFilter={setFilter}
        filterKeys={['projectId', 'date', 'itemCode', 'vehicleNo', 'olbaro', 'dischargerName', 'transporterName', 'processorName']}
        onAdd={() => setOpen(true)}
        onDelete={remove}
        editForm={(row, done) => (
          <WasteOutboundFormPage
            embedded
            record={row}
            onSaved={() => {
              done();
              load();
            }}
          />
        )}
        exportType="waste_outbound"
        exportName="폐기물반출현황"
        emptyText="등록된 폐기물 반출 내역이 없습니다."
      />

      {open && (
        <FormModal title="폐기물 반출 등록" icon={Trash2} onClose={() => setOpen(false)}>
          <WasteOutboundFormPage embedded onCreated={load} />
        </FormModal>
      )}
    </>
  );
}
