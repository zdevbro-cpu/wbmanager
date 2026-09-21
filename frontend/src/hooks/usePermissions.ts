import { useEffect, useState } from 'react';
import { api } from '../api/client';

// 내 권한 (리뷰회의 1-7 · 5-18)
//
// 화면이 메뉴와 단추를 가릴 때 쓴다.
// 계층이 정해지지 않았거나 표가 비어 있으면 unrestricted 로 오고, 그때는 지금까지처럼 다 보인다 —
// 값이 없다고 화면이 막히면 쓰던 사람이 일을 못 한다.

export interface MyPermissions {
  roleKey: string | null;
  unrestricted: boolean;
  permissions: Record<string, { c: boolean; r: boolean; u: boolean; d: boolean }>;
}

const EMPTY: MyPermissions = { roleKey: null, unrestricted: true, permissions: {} };

export function usePermissions() {
  const [my, setMy] = useState<MyPermissions>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api
      .get<MyPermissions>('/api/permissions/me')
      .then(setMy)
      .catch(() => setMy(EMPTY))
      .finally(() => setLoaded(true));
  }, []);

  // 권한 값이 없으면 막지 않는다.
  const can = (screenKey: string, flag: 'c' | 'r' | 'u' | 'd' = 'r') => {
    if (my.unrestricted) return true;
    const p = my.permissions[screenKey];
    if (!p) return true;
    return p[flag];
  };

  return { ...my, loaded, can };
}
