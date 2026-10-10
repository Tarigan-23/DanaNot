import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSyncConfig, saveSyncConfig, getBorrowers, getLoans, getPayments } from './storage';
import { CloudSyncConfig, SyncStatus } from '../types';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const config = getSyncConfig();
  if (!config.enabled || !config.supabaseUrl || !config.supabaseAnonKey) {
    return null;
  }

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    } catch (e) {
      console.error('Failed to create Supabase client:', e);
      return null;
    }
  }
  return supabaseClient;
}

export async function testCloudConnection(
  url: string,
  key: string
): Promise<{ success: boolean; message: string }> {
  if (!navigator.onLine) {
    return {
      success: false,
      message: 'Perangkat sedang offline. Sambungkan internet untuk menguji koneksi.',
    };
  }

  try {
    const tempClient = createClient(url, key);
    // Simple ping check
    const { error } = await tempClient.from('borrowers').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      // Table might not exist yet or auth issue, but connection reached
      if (error.message.includes('relation "borrowers" does not exist')) {
        return {
          success: true,
          message: 'Terkoneksi ke Supabase! (Tabel belum dibuat di database Supabase).',
        };
      }
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Koneksi ke Supabase berhasil dan siap digunakan!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Gagal terhubung ke URL Supabase.' };
  }
}

export async function syncToCloud(): Promise<{
  success: boolean;
  message: string;
  syncedCounts?: { borrowers: number; loans: number; payments: number };
}> {
  if (!navigator.onLine) {
    return {
      success: false,
      message: 'Sinkronisasi gagal: Perangkat sedang offline.',
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      message: 'Konfigurasi cloud sync belum diaktifkan.',
    };
  }

  try {
    const borrowers = getBorrowers();
    const loans = getLoans();
    const payments = getPayments();

    // 1. Upsert borrowers
    if (borrowers.length > 0) {
      const { error: bErr } = await supabase.from('borrowers').upsert(
        borrowers.map((b) => ({ ...b, sync_status: 'synced' })),
        { onConflict: 'id' }
      );
      if (bErr) throw bErr;
    }

    // 2. Upsert loans
    if (loans.length > 0) {
      const { error: lErr } = await supabase.from('loans').upsert(
        loans.map((l) => ({ ...l, sync_status: 'synced' })),
        { onConflict: 'id' }
      );
      if (lErr) throw lErr;
    }

    // 3. Upsert payments
    if (payments.length > 0) {
      const { error: pErr } = await supabase.from('payments').upsert(
        payments.map((p) => ({ ...p, sync_status: 'synced' })),
        { onConflict: 'id' }
      );
      if (pErr) throw pErr;
    }

    const config = getSyncConfig();
    config.lastSyncedAt = new Date().toISOString();
    saveSyncConfig(config);

    return {
      success: true,
      message: 'Sinkronisasi cloud berhasil diselesaikan!',
      syncedCounts: {
        borrowers: borrowers.length,
        loans: loans.length,
        payments: payments.length,
      },
    };
  } catch (err: any) {
    console.error('Sync failed:', err);
    return {
      success: false,
      message: `Sinkronisasi gagal: ${err.message || 'Terjadi kesalahan jaringan'}`,
    };
  }
}
