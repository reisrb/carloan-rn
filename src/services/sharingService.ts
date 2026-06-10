import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';

export interface FinancingShare {
  id: string;
  financingId: string;
  sharedBy: string;
  sharedWithEmail: string;
  sharedWithId: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export const sharingService = {
  async sendInvite(financingId: string, email: string): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase.from('financing_shares').insert({
      id: generateId(),
      financing_id: financingId,
      shared_by: userId,
      shared_with_email: email,
      status: 'pending',
      created_at: Date.now(),
    });
    if (error) throw error;
  },

  async getSharedWithMe(): Promise<FinancingShare[]> {
    const userId = await getUserId();
    const { data, error } = await supabase
      .from('financing_shares')
      .select('*')
      .eq('shared_with_id', userId)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(row => ({
      id: row.id,
      financingId: row.financing_id,
      sharedBy: row.shared_by,
      sharedWithEmail: row.shared_with_email,
      sharedWithId: row.shared_with_id,
      status: row.status,
      createdAt: row.created_at,
    }));
  },

  async acceptInvite(shareId: string): Promise<void> {
    const userId = await getUserId();
    const { error } = await supabase
      .from('financing_shares')
      .update({ shared_with_id: userId, status: 'accepted' })
      .eq('id', shareId);
    if (error) throw error;
  },

  async rejectInvite(shareId: string): Promise<void> {
    const { error } = await supabase
      .from('financing_shares')
      .delete()
      .eq('id', shareId);
    if (error) throw error;
  },

  async removeShare(shareId: string): Promise<void> {
    const { error } = await supabase
      .from('financing_shares')
      .delete()
      .eq('id', shareId);
    if (error) throw error;
  },
};
