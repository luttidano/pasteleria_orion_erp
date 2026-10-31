import { apiFetch } from '../lib/api';
import type { Packaging } from '../types';

export const getPackagings = async (type?: string): Promise<Packaging[]> => {
  const query = type ? `?type=${encodeURIComponent(type)}` : '';
  return apiFetch<Packaging[]>(`/packaging${query}`);
};

export const getPackaging = async (id: string): Promise<Packaging> => {
  return apiFetch<Packaging>(`/packaging/${id}`);
};

export const createPackaging = async (data: Partial<Packaging>): Promise<Packaging> => {
  return apiFetch<Packaging>('/packaging', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updatePackaging = async (id: string, data: Partial<Packaging>): Promise<Packaging> => {
  return apiFetch<Packaging>(`/packaging/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const adjustPackagingStock = async (id: string, delta: number): Promise<Packaging> => {
  return apiFetch<Packaging>(`/packaging/${id}/adjust-stock`, {
    method: 'POST',
    body: JSON.stringify({ delta }),
  });
};

export const deletePackaging = async (id: string): Promise<{ success: boolean; message: string }> => {
  return apiFetch<{ success: boolean; message: string }>(`/packaging/${id}`, {
    method: 'DELETE',
  });
};
