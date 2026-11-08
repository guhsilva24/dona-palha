/**
 * Serviço de Monitoramento de Conexão e Sincronização
 */

import { isSupabaseReady } from './supabaseClient.js';

export const syncService = {
  status: 'local',
  listeners: new Set(),

  init() {
    window.addEventListener('online', () => {
      this.setStatus(isSupabaseReady() ? 'ok' : 'local');
    });

    window.addEventListener('offline', () => {
      this.setStatus('err');
    });

    if (!navigator.onLine) {
      this.status = 'err';
    } else if (isSupabaseReady()) {
      this.status = 'busy';
    } else {
      this.status = 'local';
    }
  },

  getStatus() {
    return this.status;
  },

  setStatus(statusKey) {
    this.status = statusKey;
    this.notify();
  },

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.status);
    return () => this.listeners.delete(callback);
  },

  notify() {
    for (const cb of this.listeners) {
      try {
        cb(this.status);
      } catch (e) {
        console.error(e);
      }
    }
  }
};
