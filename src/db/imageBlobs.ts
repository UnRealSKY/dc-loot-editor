// 圖片 blob 暫存（IndexedDB）：上傳成功前的本地檔案本體。
// localStorage 放不下二進位檔，metadata（DcImage）仍在紀錄內。

const DB_NAME = 'dc-loot-images'
const STORE = 'blobs'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = run(db.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => {
          resolve(req.result)
          db.close()
        }
        req.onerror = () => {
          reject(req.error)
          db.close()
        }
      }),
  )
}

export function putBlob(id: string, blob: Blob): Promise<IDBValidKey> {
  return tx('readwrite', (s) => s.put(blob, id))
}

export async function getBlob(id: string): Promise<Blob | null> {
  const v = await tx<unknown>('readonly', (s) => s.get(id))
  return v instanceof Blob ? v : null
}

export function deleteBlob(id: string): Promise<undefined> {
  return tx('readwrite', (s) => s.delete(id))
}
