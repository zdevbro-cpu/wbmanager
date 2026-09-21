// 거래에 적은 운반비를 운반비 표에 한 줄로 남긴다 (리뷰회의 5-6).
//
// 손익의 운반비는 운반비 표만 합산한다. 그래서 거래 화면에서 운반비를 적어도
// 이 표에 들어오지 않으면 원가에 잡히지 않는다.
// 거래를 고치면 그 줄이 따라 고쳐지고, 운반비를 지우거나 거래를 지우면 함께 사라진다.
//
// 폐기물 반출은 예전부터 제 함수로 같은 일을 하고 있어 그대로 둔다.

// key: 'inboundId' | 'outboundSaleId' | 'wasteInboundId' | 'moveId'
export async function syncTransport(tx, key, row, { date, origin, destination, weight, cost }) {
  const amount = Number(cost ?? 0);
  const existing = await tx.transport.findUnique({ where: { [key]: row.id } });

  if (!(amount > 0)) {
    if (existing) await tx.transport.delete({ where: { id: existing.id } });
    return null;
  }

  const data = {
    projectId: row.projectId,
    transportDate: date,
    vehicleNo: row.vehicleNo ?? null,
    vehicleType: row.vehicleType ?? null,
    origin: origin ?? null,
    destination: destination ?? null,
    weight: weight ?? null,
    itemCode: row.itemCode ?? null,
    itemName: row.itemName ?? null,
    supplyAmount: amount,
    [key]: row.id,
  };

  if (existing) return tx.transport.update({ where: { id: existing.id }, data });
  return tx.transport.create({ data });
}
