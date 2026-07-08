import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import { FixedExpense } from '../types';

type FixedExpenseRow = {
  id: string;
  financing_id: string;
  name: string;
  value: number;
  created_at: number;
};

const toFixedExpense = (r: FixedExpenseRow): FixedExpense => ({
  id: r.id,
  financingId: r.financing_id,
  name: r.name,
  value: r.value,
  createdAt: r.created_at,
});

export const fixedExpenseService = {
  async listByCar(financingId: string): Promise<FixedExpense[]> {
    const { data, error } = await supabase
      .from('fixed_expenses')
      .select('*')
      .eq('financing_id', financingId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return (data as FixedExpenseRow[]).map(toFixedExpense);
  },

  async create(financingId: string, name: string, value: number): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from('fixed_expenses').insert({
      id: generateId(),
      user_id: userId,
      financing_id: financingId,
      name,
      value,
      created_at: Date.now(),
    });
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('fixed_expenses').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
