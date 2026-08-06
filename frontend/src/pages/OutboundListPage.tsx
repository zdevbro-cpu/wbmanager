import { useEffect, useState } from 'react';
import { PackageMinus } from 'lucide-react';
import { api } from '../api/client';
import { TransactionListLayout, EMPTY_FILTER, type Column, type TxFilter } from '../components/TransactionListLayout';
import { FormModal } from '../components/FormModal';
import { OutboundFormPage } from './OutboundFormPage';
import type { OutboundSale } from '../types';

const num = (v?: string | null) => (v == null ? null : Number(v));
const show = (v?: string | null) => (v == null || v === '' ? '-' : v);

// 원본 `스크랩출고량`/거래처별 시트와 같은 컬럼 구성
const COLUMNS: Column<OutboundSale>[] = [
  { header: '계량일', nowrap: true, render: (r) => r.outboundDate.slice(0, 10) },
  { header: '프로젝트명', render: (r) => show(r.project?.roundName) },
  { header: '상차지', render: (r) => show(r.loadingPoint) },
  { header: '차종', render: (r) => show(r.vehicleType) },
  { header: '차량번호', nowrap: true, render: (r) => show(r.vehicleNo) },
  { header: '운전자', render: (r) => show(r.driverName) },
  { header: '연락처', nowrap: true, render: (r) => show(r.driverPhone) },
  { header: '거래처명', render: (r) => show(r.buyer?.name) },
  { header: '제품명', render: (r) => show(r.item?.itemName) },
  { header: '공차중량(kg)', align: 'right', render: (r) => num(r.tareWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.tareWeight) },
  { header: '총중량(kg)', align: 'right', render: (r) => num(r.grossWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.grossWeight) },
  { header: '실중량(kg)', align: 'right', render: (r) => num(r.actualWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.actualWeight) },
  {
    header: '거래처 감량 전 실중량(kg)',
    align: 'right',
    render: (r) => num(r.preLossWeight)?.toLocaleString() ?? '-',
    sum: (r) => num(r.preLossWeight),
  },
  { header: '감량(kg)', align: 'right', render: (r) => num(r.lossWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.lossWeight) },
  { header: '정산중량(kg)', align: 'right', render: (r) => num(r.settledWeight)?.toLocaleString() ?? '-', sum: (r) => num(r.settledWeight) },
  { header: '단가(원)', align: 'right', render: (r) => num(r.unitPrice)?.toLocaleString() ?? '-' },
  { header: '금액(원)', align: 'right', render: (r) => num(r.amount)?.toLocaleString() ?? '-', sum: (r) => num(r.amount) },
  { header: '구분', render: (r) => show(r.category) },
  { header: '자회사', render: (r) => (r.isSubsidiary ? 'O' : '-') },
  { header: '입금일', nowrap: true, render: (r) => (r.paidDate ? r.paidDate.slice(0, 10) : '-') },
  { header: '비고', render: (r) => show(r.memo) },
];

const DETAIL_FIELDS = (r: OutboundSale) => [
  { label: '계량일', value: r.outboundDate.slice(0, 10) },
  { label: '프로젝트명', value: show(r.project?.roundName) },
  { label: '상차지', value: show(r.loadingPoint) },
  { label: '차종', value: show(r.vehicleType) },
  { label: '차량번호', value: show(r.vehicleNo) },
  { label: '운전자', value: show(r.driverName) },
  { label: '연락처', value: show(r.driverPhone) },
  { label: '거래처명', value: show(r.buyer?.name) },
  { label: '제품명', value: show(r.item?.itemName) },
  { label: '공차중량(kg)', value: num(r.tareWeight)?.toLocaleString() ?? '-' },
  { label: '총중량(kg)', value: num(r.grossWeight)?.toLocaleString() ?? '-' },
  { label: '실중량(kg)', value: num(r.actualWeight)?.toLocaleString() ?? '-' },
  { label: '거래처 감량 전 실중량(kg)', value: num(r.preLossWeight)?.toLocaleString() ?? '-' },
  { label: '감량(kg)', value: num(r.lossWeight)?.toLocaleString() ?? '-' },
  { label: '정산중량(kg)', value: num(r.settledWeight)?.toLocaleString() ?? '-' },
  { label: '재고반영중량(kg)', value: num(r.stockWeight)?.toLocaleString() ?? '-' },
  { label: '단가(원)', value: num(r.unitPrice)?.toLocaleString() ?? '-' },
  { label: '공급가액(원)', value: num(r.amount)?.toLocaleString() ?? '-' },
  { label: '부가세(원)', value: num(r.vatAmount)?.toLocaleString() ?? '-' },
  { label: '구분', value: show(r.category) },
  { label: '자회사 출고', value: r.isSubsidiary ? 'O' : '-' },
  { label: '입금일', value: r.paidDate ? r.paidDate.slice(0, 10) : '-' },
  { label: '비고', value: show(r.memo) },
];

export function OutboundListPage() {
  const [rows, setRows] = useState<OutboundSale[]>([]);
  const [filter, setFilter] = useState<TxFilter>(EMPTY_FILTER);
  const [open, setOpen] = useState(false);

  const load = () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v) params.set(k, v);
    api.get<OutboundSale[]>(`/api/outbounds?${params.toString()}`).then(setRows);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const remove = async (row: OutboundSale) => {
    await api.del(`/api/outbounds/${row.id}`);
    load();
  };

  return (
    <>
      <TransactionListLayout
        title="출고(매각) 현황"
        icon={PackageMinus}
        addLabel="출고 등록"
        dateLabel="출고구간"
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        attachments={(r) => r.attachments ?? []}
        detailFields={DETAIL_FIELDS}
        filter={filter}
        setFilter={setFilter}
        onAdd={() => setOpen(true)}
        onDelete={remove}
        exportType="outbound_sale"
        exportName="출고현황"
        emptyText="등록된 출고 내역이 없습니다."
      />

      {open && (
        <FormModal title="출고(매각) 등록" icon={PackageMinus} onClose={() => setOpen(false)}>
          <OutboundFormPage embedded onCreated={load} />
        </FormModal>
      )}
    </>
  );
}
