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
    key: string; // id
    value: any;
    indexes: {
      group_id: string;
      created_at: string;
    };
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
    dbPromise = openDB<BantLoDB>('bantlo-data-cache-v1', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('groups', { keyPath: 'id' });
          db.createObjectStore('balances', { keyPath: 'group_id' });
          db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
        }
        
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains('expenses')) {
            db.deleteObjectStore('expenses');
          }
          const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
          expenseStore.createIndex('group_id', 'group_id');
          expenseStore.createIndex('created_at', 'created_at');
        }
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

export async function getCachedGroups() {
  const db = await getDB();
  return db.getAll('groups');
}

export async function updateCachedGroupsSync(groups: any[]) {
  const db = await getDB();
  const tx = db.transaction('groups', 'readwrite');
  // We keep existing entries that might not be in the fetch (if needed), 
  // but usually for fresh lists we want the most recent from server to define reality.
  // We'll update the ones we got.
  for (const g of groups) {
    await tx.store.put(g);
  }
  await tx.done;
}

export async function updateCachedGroupStanding(groupId: string, standing: number) {
  const db = await getDB();
  const group = await db.get('groups', groupId);
  if (group) {
    group.standing = standing;
    await db.put('groups', group);
  }
}

export async function getExpensesCached(groupId: string, limit: number = 50) {
  const db = await getDB();
  const results = await db.getAllFromIndex('expenses', 'group_id', groupId);
  return results
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export async function updateExpensesSync(expenses: any[]) {
  const db = await getDB();
  const tx = db.transaction('expenses', 'readwrite');
  for (const e of expenses) {
    if (e && e.id) {
      await tx.store.put(e);
    }
  }
  await tx.done;
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
