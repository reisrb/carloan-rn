import { supabase, getUserId } from '../lib/supabase';
import { generateId } from '../theme';

export interface FinancingShare {
  id: string;
  financingId: string;
  sharedBy: string;
  sharedWithEmail: string;
  sharedWithId: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  permission: 'view' | 'edit';
  createdAt: number;
}

export interface FinancingMember {
  shareId: string;
  userId: string;
  username: string;
  permission: 'view' | 'edit';
}

export const sharingService = {
  async sendInvite(financingId: string, username: string, permission: 'view' | 'edit' = 'view'): Promise<void> {
    const userId = await getUserId();
    const { data: target } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('username', username.toLowerCase().trim())
      .maybeSingle();
    if (!target) throw new Error(`Usuário "@${username}" não encontrado`);
    if (target.id === userId) throw new Error('Não é possível compartilhar consigo mesmo');
    const { data: existing } = await supabase
      .from('financing_shares')
      .select('id')
      .eq('financing_id', financingId)
      .eq('shared_with_id', target.id)
      .maybeSingle();
    if (existing) throw new Error(`@${username} já tem acesso a este financiamento`);
    const { error } = await supabase.from('financing_shares').insert({
      id: generateId(),
      financing_id: financingId,
      shared_by: userId,
      shared_with_email: target.email,
      shared_with_id: target.id,
      status: 'accepted',
      permission,
      created_at: Date.now(),
    });
    if (error) throw error;
  },

  async getMembers(financingId: string): Promise<FinancingMember[]> {
    const { data, error } = await supabase
      .from('financing_shares')
      .select('id, shared_with_id, permission')
      .eq('financing_id', financingId)
      .eq('status', 'accepted');
    if (error || !data?.length) return [];
    const ids = data.map((r: any) => r.shared_with_id).filter(Boolean);
    if (!ids.length) return [];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', ids);
    return data
      .map((r: any) => {
        const profile = (profiles ?? []).find((p: any) => p.id === r.shared_with_id);
        if (!profile) return null;
        return {
          shareId: r.id,
          userId: profile.id,
          username: profile.username,
          permission: (r.permission ?? 'view') as 'view' | 'edit',
        } as FinancingMember;
      })
      .filter((m): m is FinancingMember => m !== null);
  },

  async updateMemberPermission(shareId: string, permission: 'view' | 'edit'): Promise<void> {
    const { error } = await supabase
      .from('financing_shares')
      .update({ permission })
      .eq('id', shareId);
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
      permission: (row.permission ?? 'view') as 'view' | 'edit',
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
