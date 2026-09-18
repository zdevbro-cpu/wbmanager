import { useState } from 'react';
import { Coins } from 'lucide-react';
import { pageTitleCls } from '../components/ui/classes';
import { LatestPriceTab } from '../components/price/LatestPriceTab';
import { PriceLookupTab } from '../components/price/PriceLookupTab';
import { PriceEntryTab } from '../components/price/PriceEntryTab';
import { PriceNoticeTab } from '../components/price/PriceNoticeTab';
import { LmeTab } from '../components/price/LmeTab';

// 단가관리 — 메뉴 하나 안의 탭 5개. 엑셀 「단가관리」 파일 한 권을 그대로 대신한다.
// 화면설계서 PRC-01~05.
const TABS = [
  { key: 'latest', label: '최신단가 현황' },
  { key: 'lookup', label: '단가조회 · 추이' },
  { key: 'entry', label: '단가 입력' },
  { key: 'notice', label: '공지 등록' },
  { key: 'lme', label: 'LME 계산기' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function PricePage() {
  const [tab, setTab] = useState<TabKey>('latest');
  // 최신단가에서 한 줄을 누르면 그 품목을 들고 조회 탭으로 넘어간다.
  const [focusItemId, setFocusItemId] = useState<string | null>(null);

  const openLookup = (vendorItemId: string) => {
    setFocusItemId(vendorItemId);
    setTab('lookup');
  };

  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Coins size={20} className="text-primary" />
        <h1 className={pageTitleCls}>단가관리</h1>
      </div>
      <p className="mb-5 text-[13px] text-text-sub">매각처별 판매단가 — 엑셀 「단가관리」를 대체합니다</p>

      <div className="mb-5 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              '-mb-px border-b-2 px-4 py-2 text-[14px] font-bold transition-colors',
              tab === t.key
                ? 'border-primary text-text-strong'
                : 'border-transparent text-text-sub hover:text-text-strong',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'latest' && <LatestPriceTab onOpenItem={openLookup} />}
      {tab === 'lookup' && <PriceLookupTab initialItemId={focusItemId} />}
      {tab === 'entry' && <PriceEntryTab />}
      {tab === 'notice' && <PriceNoticeTab />}
      {tab === 'lme' && <LmeTab />}
    </div>
  );
}
