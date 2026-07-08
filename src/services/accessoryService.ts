import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import { Accessory } from '../types';

type AccessoryRow = {
  id: string;
  financing_id: string;
  name: string;
  value: number;
  date: number | null;
  created_at: number;
};

const toAccessory = (r: AccessoryRow): Accessory => ({
  id: r.id,
  financingId: r.financing_id,
  name: r.name,
  value: r.value,
  date: r.date,
  createdAt: r.created_at,
});

export interface AccessoryInput {
  name: string;
  value: number;
  date: number | null;
}

export const accessoryService = {
  async listByCar(financingId: string): Promise<Accessory[]> {
    const { data, error } = await supabase
      .from('accessories')
      .select('*')
      .eq('financing_id', financingId)
      .order('date', { ascending: false, nullsFirst: false });
    if (error) throw new Error(error.message);
    return (data as AccessoryRow[]).map(toAccessory);
  },

  async create(financingId: string, input: AccessoryInput): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from('accessories').insert({
      id: generateId(),
      user_id: userId,
      financing_id: financingId,
      name: input.name,
      value: input.value,
      date: input.date,
      created_at: Date.now(),
    });
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('accessories').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
