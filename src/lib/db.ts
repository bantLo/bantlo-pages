import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface BantLoDB extends DBSchema {
  groups: {
    key: string;
    value: any;
  };
  balances: {
    key: string; // group_id
    value: { group_id: string; balances: any[]; updated_at: string };
  };
  expenses: {
    key: string; // group_id
    value: { group_id: string; expenses: any[]; updated_at: string };
  };
  mutations: {
    key: number;
    value: {
      id?: number;
      action: 'CREATE_GROUP' | 'ADD_EXPENSE';
      payload: any;
      created_at: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<BantLoDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<BantLoDB>('bantlo-data-cache-v1', 1, {
      upgrade(db) {
        db.createObjectStore('groups', { keyPath: 'id' });
        db.createObjectStore('balances', { keyPath: 'group_id' });
        db.createObjectStore('expenses', { keyPath: 'group_id' });
        db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
      },
      blocked() {
        console.warn('IDB Connection Blocked: Retrying...');
      },
      terminated() {
        console.error('IDB Connection Terminated.');
        dbPromise = null;
      }
    });
  }
  return dbPromise;
}

export function resetDatabasePromise() {
  dbPromise = null;
}

export async function clearLocalDatabase() {
  const db = await getDB();
  db.close(); // Important: Close the active connection first
  resetDatabasePromise();
  await indexedDB.deleteDatabase('bantlo-data-cache-v1');
}

export async function cacheGroupData(group: any) {
  const db = await getDB();
  await db.put('groups', group);
}

export async function getCachedGroup(groupId: string) {
  const db = await getDB();
  return db.get('groups', groupId);
}

export async function queueMutation(action: 'CREATE_GROUP' | 'ADD_EXPENSE', payload: any) {
  const db = await getDB();
  await db.add('mutations', {
    action,
    payload,
    created_at: Date.now()
  });

  // Attempt to trigger background sync if supported
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register('sync-mutations');
    } catch (err) {
      console.error('Background Sync registration failed, will fallback to online retry', err);
    }
  }
}

export async function getPendingMutations() {
  const db = await getDB();
  return db.getAll('mutations');
}

export async function removeMutation(id: number) {
  const db = await getDB();
  await db.delete('mutations', id);
}
