import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Borrower, Loan, Payment, SavingsTransaction } from '../types';

interface DanaNoteDBSchema extends DBSchema {
  borrowers: {
    key: string;
    value: Borrower;
    indexes: {
      'by-name': string;
      'by-created': string;
    };
  };
  loans: {
    key: string;
    value: Loan;
    indexes: {
      'by-borrower': string;
      'by-status': string;
      'by-loan-date': string;
    };
  };
  payments: {
    key: string;
    value: Payment;
    indexes: {
      'by-loan': string;
      'by-date': string;
      'by-created': string;
    };
  };
  savings_transactions: {
    key: string;
    value: SavingsTransaction;
    indexes: {
      'by-borrower': string;
      'by-date': string;
      'by-loan': string;
      'by-type': string;
    };
  };
  settings: {
    key: string;
    value: any;
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      table: 'borrowers' | 'loans' | 'payments';
      action: 'INSERT' | 'UPDATE' | 'DELETE';
      payload: any;
      timestamp: string;
      retries: number;
    };
  };
}

const DB_NAME = 'DanaNoteIndexedDB';
const DB_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<DanaNoteDBSchema>> | null = null;

export function getDB(): Promise<IDBPDatabase<DanaNoteDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DanaNoteDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('borrowers')) {
          const borrowerStore = db.createObjectStore('borrowers', { keyPath: 'id' });
          borrowerStore.createIndex('by-name', 'name');
          borrowerStore.createIndex('by-created', 'created_at');
        }

        if (!db.objectStoreNames.contains('loans')) {
          const loanStore = db.createObjectStore('loans', { keyPath: 'id' });
          loanStore.createIndex('by-borrower', 'borrower_id');
          loanStore.createIndex('by-status', 'status');
          loanStore.createIndex('by-loan-date', 'loan_date');
        }

        if (!db.objectStoreNames.contains('payments')) {
          const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
          paymentStore.createIndex('by-loan', 'loan_id');
          paymentStore.createIndex('by-date', 'payment_date');
          paymentStore.createIndex('by-created', 'created_at');
        }

        if (!db.objectStoreNames.contains('savings_transactions')) {
          const savingsStore = db.createObjectStore('savings_transactions', { keyPath: 'id' });
          savingsStore.createIndex('by-borrower', 'borrower_id');
          savingsStore.createIndex('by-date', 'date');
          savingsStore.createIndex('by-loan', 'loan_id');
          savingsStore.createIndex('by-type', 'type');
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}
