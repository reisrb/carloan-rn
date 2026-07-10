import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import { Maintenance, MaintenanceStatus } from '../types';

type MaintenanceRow = {
  id: string;
  financing_id: string;
  status: MaintenanceStatus;
  description: string;
  total_value: number;
  item_value: number;
  labor_value: number;
  service_date: number | null;
  km_at_service: number | null;
  item_purchase_date: number | null;
  due_km: number | null;
  due_date: number | null;
  receipt_paths: string[] | null;
  created_at: number;
};

const toMaintenance = (r: MaintenanceRow): Maintenance => ({
  id: r.id,
  financingId: r.financing_id,
  status: r.status,
  description: r.description,
  totalValue: r.total_value,
  itemValue: r.item_value,
  laborValue: r.labor_value,
  serviceDate: r.service_date,
  kmAtService: r.km_at_service,
  itemPurchaseDate: r.item_purchase_date,
  dueKm: r.due_km,
  dueDate: r.due_date,
  receiptPaths: r.receipt_paths ?? [],
  createdAt: r.created_at,
});

export interface MaintenanceInput {
  status: MaintenanceStatus;
  description: string;
  totalValue: number;
  itemValue: number;
  laborValue: number;
  serviceDate: number | null;
  kmAtService: number | null;
  itemPurchaseDate: number | null;
  dueKm: number | null;
  dueDate: number | null;
  receiptPaths: string[];
}

const toRow = (i: MaintenanceInput) => ({
  status: i.status,
  description: i.description,
  total_value: i.totalValue,
  item_value: i.itemValue,
  labor_value: i.laborValue,
  service_date: i.serviceDate,
  km_at_service: i.kmAtService,
  item_purchase_date: i.itemPurchaseDate,
  due_km: i.dueKm,
  due_date: i.dueDate,
  receipt_paths: i.receiptPaths,
});

export const maintenanceService = {
  async listByCar(financingId: string): Promise<Maintenance[]> {
    const { data, error } = await supabase
      .from('maintenances')
      .select('*')
      .eq('financing_id', financingId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as MaintenanceRow[]).map(toMaintenance);
  },

  async create(financingId: string, input: MaintenanceInput): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from('maintenances').insert({
      id: generateId(),
      user_id: userId,
      financing_id: financingId,
      created_at: Date.now(),
      ...toRow(input),
    });
    if (error) throw new Error(error.message);
  },

  async update(id: string, input: MaintenanceInput): Promise<void> {
    const { error } = await supabase.from('maintenances').update(toRow(input)).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('maintenances').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
