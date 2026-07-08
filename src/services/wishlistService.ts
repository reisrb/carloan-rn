import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';
import { WishlistItem } from '../types';

type WishlistRow = {
  id: string;
  financing_id: string;
  name: string;
  estimated_value: number;
  priority: number;
  notes: string | null;
  created_at: number;
};

const toItem = (r: WishlistRow): WishlistItem => ({
  id: r.id,
  financingId: r.financing_id,
  name: r.name,
  estimatedValue: r.estimated_value,
  priority: r.priority,
  notes: r.notes,
  createdAt: r.created_at,
});

export interface WishlistInput {
  name: string;
  estimatedValue: number;
  priority: number;
  notes: string | null;
}

export const wishlistService = {
  async listByCar(financingId: string): Promise<WishlistItem[]> {
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('*')
      .eq('financing_id', financingId)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data as WishlistRow[]).map(toItem);
  },

  async create(financingId: string, input: WishlistInput): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from('wishlist_items').insert({
      id: generateId(),
      user_id: userId,
      financing_id: financingId,
      name: input.name,
      estimated_value: input.estimatedValue,
      priority: input.priority,
      notes: input.notes,
      created_at: Date.now(),
    });
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
