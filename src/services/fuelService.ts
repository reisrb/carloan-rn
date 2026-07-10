import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import { FuelFillup } from '../types';

type FuelRow = {
  id: string;
  financing_id: string;
  date: number | null;
  total_value: number;
  liters: number | null;
  km: number | null;
  created_at: number;
};

const toFillup = (r: FuelRow): FuelFillup => ({
  id: r.id,
  financingId: r.financing_id,
  date: r.date,
  totalValue: r.total_value,
  liters: r.liters,
  km: r.km,
  createdAt: r.created_at,
});

export interface FuelInput {
  date: number | null;
  totalValue: number;
  liters: number | null;
  km: number | null;
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
      date: input.date,
      total_value: input.totalValue,
      liters: input.liters,
      km: input.km,
      created_at: Date.now(),
    });
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('fuel_fillups').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
