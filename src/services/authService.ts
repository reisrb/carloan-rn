import { supabase } from '../lib/supabase';

export const authService = {
  async signUp(username: string, email: string, password: string): Promise<void> {
    const trimmed = username.toLowerCase().trim();
    if (!trimmed) throw new Error('Username obrigatório');
    if (trimmed.length < 2) throw new Error('Username precisa ter ao menos 2 caracteres');
    if (!email.trim()) throw new Error('Email obrigatório');
    if (password.length < 6) throw new Error('Senha precisa ter ao menos 6 caracteres');

    // Pre-check username uniqueness (trigger is the final guard)
    const { data: existing } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', trimmed)
      .maybeSingle();
    if (existing) throw new Error('Username já em uso');

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: trimmed },
        emailRedirectTo: 'https://carloan-rn.vercel.app',
      },
    });

    if (error) {
      if (error.message.includes('already registered')) {
        throw new Error('Email já cadastrado');
      }
      throw new Error(error.message);
    }
    // Profile is created automatically by the DB trigger on_auth_user_created.
    // User will receive a confirmation email before being able to log in.
  },

  async signIn(identifier: string, password: string): Promise<void> {
    const trimmed = identifier.toLowerCase().trim();
    const isEmail = trimmed.includes('@');

    const { data: profile, error: lookupError } = await supabase
      .from('profiles')
      .select('email, status')
      .eq(isEmail ? 'email' : 'username', trimmed)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);
    if (!profile) throw new Error(isEmail ? 'Email não encontrado' : 'Username não encontrado');
    if (profile.status === 'pending') throw new Error('Conta aguardando aprovação do admin');

    const { error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Senha incorreta');
      }
      if (error.message.includes('Email not confirmed')) {
        throw new Error('Conta aprovada, mas o email ainda não foi confirmado. Peça ao admin para desativar a confirmação de email no painel do Supabase.');
      }
      throw new Error(error.message);
    }
  },

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getUsername(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single();
    return data?.username ?? null;
  },
};
