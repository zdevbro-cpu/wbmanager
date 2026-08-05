import { useState } from 'react';
import { Settings } from 'lucide-react';
import { api } from '../api/client';
import { useVendors, useItemMasters } from '../hooks/useMasters';
import { Badge } from '../components/ui/Badge';
import { pageTitleCls, sectionTitleCls, outlineBtnCls, inputCls, cardPadCls } from '../components/ui/classes';
import type { Vendor, ItemMaster } from '../types';

export function MasterManagementPage({ embedded = false }: { embedded?: boolean }) {
  const { vendors, reload: reloadVendors } = useVendors();
  const { items, reload: reloadItems } = useItemMasters();

  return (
    <div>
      {!embedded && (
        <div className="mb-5 flex items-center gap-2">
          <Settings size={20} className="text-primary" />
          <h1 className={pageTitleCls}>마스터 관리</h1>
        </div>
      )}

      <div className="flex flex-wrap gap-6">
        <VendorSection vendors={vendors} reload={reloadVendors} />
        <ItemSection items={items} reload={reloadItems} />
      </div>
    </div>
  );
}

function VendorSection({ vendors, reload }: { vendors: Vendor[]; reload: () => void }) {
  const [name, setName] = useState('');
  const [vendorType, setVendorType] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post('/api/vendors', { name, vendorType: vendorType || undefined });
    setName('');
    setVendorType('');
    reload();
  };

  const promote = async (id: string) => {
    await api.patch(`/api/vendors/${id}/promote`, {});
    reload();
  };

  return (
    <div className="flex-1 min-w-[300px]">
      <h2 className={`${sectionTitleCls} mb-2`}>거래처 마스터</h2>
      <form onSubmit={handleAdd} className={`${cardPadCls} mb-3 flex gap-2`}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="거래처명" className={inputCls} />
        <input value={vendorType} onChange={(e) => setVendorType(e.target.value)} placeholder="구분" className={inputCls} />
        <button type="submit" className={`${outlineBtnCls} shrink-0`}>
          추가
        </button>
      </form>
      <ul className="space-y-1.5">
        {vendors.map((v) => (
          <li key={v.id} className="flex items-center justify-between border-b border-border pb-1.5 text-[13px] text-text">
            <span className="flex items-center gap-1.5">
              {v.name} {v.vendorType && <span className="text-text-faint">({v.vendorType})</span>}
              {v.isTemporary && <Badge tone="amber">임시</Badge>}
            </span>
            {v.isTemporary && (
              <button type="button" onClick={() => promote(v.id)} className="text-[12px] font-semibold text-primary hover:underline">
                정식 승격
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ItemSection({ items, reload }: { items: ItemMaster[]; reload: () => void }) {
  const [itemCode, setItemCode] = useState('');
  const [category, setCategory] = useState('');
  const [itemName, setItemName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemCode.trim() || !category.trim() || !itemName.trim()) return;
    await api.post('/api/item-masters', { itemCode, category, itemName });
    setItemCode('');
    setCategory('');
    setItemName('');
    reload();
  };

  const promote = async (code: string) => {
    await api.patch(`/api/item-masters/${code}/promote`, {});
    reload();
  };

  return (
    <div className="flex-1 min-w-[300px]">
      <h2 className={`${sectionTitleCls} mb-2`}>품목 마스터</h2>
      <form onSubmit={handleAdd} className={`${cardPadCls} mb-3 flex gap-2`}>
        <input value={itemCode} onChange={(e) => setItemCode(e.target.value)} placeholder="코드" className={`${inputCls} w-[90px]`} />
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="대분류" className={`${inputCls} w-[90px]`} />
        <input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="품목명" className={inputCls} />
        <button type="submit" className={`${outlineBtnCls} shrink-0`}>
          추가
        </button>
      </form>
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between border-b border-border pb-1.5 text-[13px] text-text">
            <span className="flex items-center gap-1.5">
              {i.itemName} <span className="text-text-faint">({i.itemCode}, {i.category})</span>
              {i.isTemporary && <Badge tone="amber">임시</Badge>}
            </span>
            {i.isTemporary && (
              <button type="button" onClick={() => promote(i.itemCode)} className="text-[12px] font-semibold text-primary hover:underline">
                정식 승격
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
