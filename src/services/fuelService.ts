import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import { FuelFillup } from '../types';

type FuelRow = {
  id: string;
  financing_id: string;
  local: string | null;
  flag: string | null;
  fuel_type: string | null;
  date: number | null;
  total_value: number;
  liters: number | null;
  km: number | null;
  km_driven: number | null;
  full_tank: boolean;
  created_at: number;
};

const toFillup = (r: FuelRow): FuelFillup => ({
  id: r.id,
  financingId: r.financing_id,
  local: r.local,
  flag: r.flag,
  fuelType: r.fuel_type,
  date: r.date,
  totalValue: r.total_value,
  liters: r.liters,
  km: r.km,
  kmDriven: r.km_driven,
  fullTank: r.full_tank,
  createdAt: r.created_at,
});

export interface FuelInput {
  local: string | null;
  flag: string | null;
  fuelType: string | null;
  date: number | null;
  totalValue: number;
  liters: number | null;
  km: number | null;
  kmDriven: number | null;
  fullTank: boolean;
}

export const fuelService = {
  async listByCar(financingId: string): Promise<FuelFillup[]> {
    const { data, error } = await supabase
      .from('fuel_fillups')
      .select('*')
      .eq('financing_id', financingId)
      .order('date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as FuelRow[]).map(toFillup);
  },

  async create(financingId: string, input: FuelInput): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from('fuel_fillups').insert({
      id: generateId(),
      user_id: userId,
      financing_id: financingId,
      local: input.local,
      flag: input.flag,
      fuel_type: input.fuelType,
      date: input.date,
      total_value: input.totalValue,
      liters: input.liters,
      km: input.km,
      km_driven: input.kmDriven,
      full_tank: input.fullTank,
      created_at: Date.now(),
    });
    if (error) throw new Error(error.message);
  },

  async update(id: string, input: FuelInput): Promise<void> {
    const { error } = await supabase.from('fuel_fillups').update({
      local: input.local,
      flag: input.flag,
      fuel_type: input.fuelType,
      date: input.date,
      total_value: input.totalValue,
      liters: input.liters,
      km: input.km,
      km_driven: input.kmDriven,
      full_tank: input.fullTank,
    }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('fuel_fillups').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
