import { useEffect, useState, useCallback } from 'react';
import { api } from '../api/client';
import type { Vendor, ItemMaster, Project } from '../types';

export function useVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const reload = useCallback(() => {
    api.get<Vendor[]>('/api/vendors').then(setVendors);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const quickCreate = useCallback(
    async (name: string) => {
      const vendor = await api.post<Vendor>('/api/vendors/quick-create', { name });
      reload();
      return vendor.id;
    },
    [reload],
  );

  return { vendors, reload, quickCreate };
}

export function useItemMasters() {
  const [items, setItems] = useState<ItemMaster[]>([]);

  const reload = useCallback(() => {
    api.get<ItemMaster[]>('/api/item-masters').then(setItems);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const quickCreate = useCallback(
    async (itemName: string) => {
      const itemCode = `TMP-${Date.now()}`;
      const item = await api.post<ItemMaster>('/api/item-masters/quick-create', {
        itemCode,
        category: '미분류',
        itemName,
      });
      reload();
      return item.itemCode;
    },
    [reload],
  );

  return { items, reload, quickCreate };
}

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  const reload = useCallback(() => {
    api.get<Project[]>('/api/projects').then(setProjects);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { projects, reload };
}
