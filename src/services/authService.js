/**
 * Serviço de Autenticação Supabase
 */

import { supabase, isSupabaseReady } from './supabaseClient.js';

export const authService = {
  /**
   * Retorna a sessão ativa
   */
  async getSession() {
    if (!isSupabaseReady()) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn('Erro ao obter sessão Supabase:', error.message);
      return null;
    }
    return data.session;
  },

  /**
   * Retorna o usuário logado atualmente
   */
  async getCurrentUser() {
    if (!isSupabaseReady()) return null;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user;
  },

  /**
   * Cadastrar novo usuário com email, senha e nome completo
   */
  async signUp(email, password, fullName = '') {
    if (!isSupabaseReady()) {
      throw new Error('Supabase não configurado. Adicione suas credenciais no arquivo .env.');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    if (error) throw error;
    return data;
  },

  /**
   * Fazer login com email e senha
   */
  async signIn(email, password) {
    if (!isSupabaseReady()) {
      throw new Error('Supabase não configurado. Adicione suas credenciais no arquivo .env.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
    return data;
  },

  /**
   * Fazer logout
   */
  async signOut() {
    if (!isSupabaseReady()) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Enviar email de redefinição de senha
   */
  async resetPassword(email) {
    if (!isSupabaseReady()) {
      throw new Error('Supabase não configurado.');
    }
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    });
    if (error) throw error;
    return data;
  },

  /**
   * Escuta mudanças no estado de autenticação
   */
  onAuthStateChange(callback) {
    if (!isSupabaseReady()) {
      // Callback com null para modo local
      callback('SIGNED_OUT', null);
      return { unsubscribe: () => {} };
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      callback(event, session?.user ?? null);
    });
    return subscription;
  }
};

