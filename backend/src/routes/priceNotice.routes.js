import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { dayOf, noticePreview, upsertPrice } from '../lib/pricing.js';

// 공지 등록 · 일괄반영(PRC-04) — 엑셀에서 손으로 복사해 붙여 넣던 단계를 없앤다.
// 저장만으로 단가를 바꾸지 않는다. 바뀔 단가를 보여 준 뒤 [일괄 반영]을 눌러야 쌓인다(검토의견 ③).
const router = Router();

function fail(res, e) {
  const status = e.status ?? 500;
  if (status === 500) console.error('[price-notice]', e.message);
  res.status(status).json({ error: status === 500 ? '처리하지 못했습니다.' : e.message });
}

const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

router.get('/', async (req, res) => {
  try {
    const { vendorId } = req.query;
    const rows = await prisma.priceNotice.findMany({
      where: vendorId ? { vendorId } : undefined,
      include: { vendor: { select: { name: true } }, targetVendorItem: { select: { vendorItemName: true } } },
      orderBy: [{ noticeDate: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });
    res.json(
      rows.map((r) => ({
        id: r.id,
        noticeDate: dayOf(r.noticeDate),
        vendorId: r.vendorId,
        vendorName: r.vendor.name,
        series: r.series,
        scope: r.scope,
        targetVendorItemName: r.targetVendorItem?.vendorItemName ?? null,
        adjustAmount: Number(r.adjustAmount),
        content: r.content,
        appliedAt: r.appliedAt,
      })),
    );
  } catch (e) {
    fail(res, e);
  }
});

// 미리보기 — 아직 아무것도 저장하지 않는다.
router.post('/preview', async (req, res) => {
  try {
    const { vendorId, adjustAmount, noticeDate } = req.body;
    if (!vendorId) throw bad('업체를 고르세요.');
    if (!noticeDate) throw bad('공지일을 고르세요.');
    if (adjustAmount === undefined || adjustAmount === '') throw bad('조정금액을 적어 주세요.');
    const rows = await noticePreview(req.body);
    res.json({ rows, count: rows.length });
  } catch (e) {
    fail(res, e);
  }
});

// 저장 + 일괄 반영. apply=false면 공지만 남기고 단가는 그대로 둔다.
router.post('/', async (req, res) => {
  try {
    const { vendorId, noticeDate, series, scope = '전품목', targetVendorItemId, adjustAmount, content } = req.body;
    if (!vendorId) throw bad('업체를 고르세요.');
    if (!noticeDate) throw bad('공지일을 고르세요.');
    if (adjustAmount === undefined || adjustAmount === '') throw bad('조정금액을 적어 주세요.');
    if (scope === '지정' && !targetVendorItemId) throw bad('지정 공지는 대상 품목을 고르세요.');

    const apply = req.body.apply !== false;
    const rows = apply ? await noticePreview(req.body) : [];

    const notice = await prisma.priceNotice.create({
      data: {
        vendorId,
        noticeDate: new Date(`${dayOf(noticeDate)}T00:00:00.000Z`),
        series: series ?? null,
        scope,
        targetVendorItemId: scope === '지정' ? targetVendorItemId : null,
        adjustAmount: Number(adjustAmount),
        content: content ?? null,
        appliedAt: apply ? new Date() : null,
        createdById: req.appUser?.id ?? null,
      },
    });

    // 공지로 만든 값은 「참고」로 쌓는다. 실제 거래단가와 섞이지 않게 구분을 남긴다.
    let applied = 0;
    for (const r of rows) {
      if (r.nextPrice == null) continue;
      await upsertPrice(
        {
          vendorItemId: r.vendorItemId,
          effectiveDate: noticeDate,
          price: r.nextPrice,
          priceType: '참고',
          source: '공지',
          memo: content ?? null,
          noticeId: notice.id,
        },
        req.appUser?.id,
      );
      applied += 1;
    }
    res.status(201).json({ id: notice.id, applied });
  } catch (e) {
    fail(res, e);
  }
});

// 반영 취소 — 그 공지로 쌓인 참고단가만 지운다. 공지 기록은 남는다.
router.delete('/:id/apply', async (req, res) => {
  try {
    const { count } = await prisma.vendorPrice.updateMany({
      where: { noticeId: req.params.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await prisma.priceNotice.update({ where: { id: req.params.id }, data: { appliedAt: null } });
    res.json({ count });
  } catch (e) {
    fail(res, e);
  }
});

export default router;
