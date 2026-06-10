import { supabase } from '../lib/supabase';

export const realtimeService = {
  watchProfileStatus(profileId: string, onActive: () => void): () => void {
    const channel = supabase
      .channel(`profile-status-${profileId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profileId}` },
        (payload: any) => {
          if (payload.new?.status === 'active') onActive();
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  },

  async getProfileIdByIdentifier(identifier: string): Promise<string | null> {
    const isEmail = identifier.includes('@');
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq(isEmail ? 'email' : 'username', identifier.toLowerCase().trim())
      .maybeSingle();
    return data?.id ?? null;
  },
};
