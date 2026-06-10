import { supabase } from '../lib/supabase';

export type UserProfile = {
  id: string;
  username: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};

export const adminService = {
  async getMyProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('id, username, email, role, status, created_at')
      .eq('id', user.id)
      .single();
    return data ?? null;
  },

  async getPendingUsers(): Promise<UserProfile[]> {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, email, role, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    return data ?? [];
  },

  async searchUsernames(query: string): Promise<string[]> {
    if (query.trim().length < 2) return [];
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .ilike('username', `${query.trim()}%`)
      .eq('status', 'active')
      .neq('id', user?.id ?? '')
      .limit(6);
    return (data ?? []).map((r: any) => r.username);
  },

  async approveUser(id: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'active' })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },
};
