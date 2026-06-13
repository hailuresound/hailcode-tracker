// idb.js — Thin IndexedDB wrapper for Hailure Brand Hub
// Stores boards and assets. Images/files stored as native Blobs.

const idb = (() => {
    const DB_NAME = 'HailureBrandHub';
    const DB_VERSION = 1;

    let db = null;

    function open() {
        return new Promise((resolve, reject) => {
            if (db) { resolve(db); return; }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (e) => {
                const d = e.target.result;
                if (!d.objectStoreNames.contains('boards')) {
                    d.createObjectStore('boards', { keyPath: 'id', autoIncrement: true });
                }
                if (!d.objectStoreNames.contains('assets')) {
                    const store = d.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('boardId', 'boardId', { unique: false });
                    store.createIndex('position', 'position', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                db = e.target.result;
                resolve(db);
            };

            request.onerror = (e) => {
                reject(e.target.error);
            };
        });
    }

    // --- Boards ---

    async function getAllBoards() {
        const d = await open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('boards', 'readonly');
            const store = tx.objectStore('boards');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getBoard(id) {
        const d = await open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('boards', 'readonly');
            const store = tx.objectStore('boards');
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function putBoard(board) {
        const d = await open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('boards', 'readwrite');
            const store = tx.objectStore('boards');
            const req = store.put(board);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteBoard(id) {
        const d = await open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('boards', 'readwrite');
            const store = tx.objectStore('boards');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // --- Assets ---

    async function getAssetsByBoard(boardId) {
        const d = await open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('assets', 'readonly');
            const index = tx.objectStore('assets').index('boardId');
            const req = index.getAll(boardId);
            req.onsuccess = () => {
                const assets = req.result;
                assets.sort((a, b) => a.position - b.position);
                resolve(assets);
            };
            req.onerror = () => reject(req.error);
        });
    }

    async function getAllAssets() {
        const d = await open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('assets', 'readonly');
            const store = tx.objectStore('assets');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function putAsset(asset) {
        const d = await open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('assets', 'readwrite');
            const store = tx.objectStore('assets');
            const req = store.put(asset);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function deleteAsset(id) {
        const d = await open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('assets', 'readwrite');
            const store = tx.objectStore('assets');
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async function deleteAssetsByBoard(boardId) {
        const d = await open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction('assets', 'readwrite');
            const store = tx.objectStore('assets');
            const index = store.index('boardId');
            const req = index.getAllKeys(boardId);
            req.onsuccess = () => {
                const keys = req.result;
                keys.forEach(key => store.delete(key));
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // --- Bulk (for export/import) ---

    async function exportAll() {
        const boards = await getAllBoards();
        const assets = await getAllAssets();
        return { boards, assets };
    }

    async function importAll(data) {
        const d = await open();
        return new Promise((resolve, reject) => {
            const tx = d.transaction(['boards', 'assets'], 'readwrite');
            const boardStore = tx.objectStore('boards');
            const assetStore = tx.objectStore('assets');

            // Clear existing
            boardStore.clear();
            assetStore.clear();

            // Import boards
            (data.boards || []).forEach(board => {
                // Strip id so autoIncrement assigns fresh ones
                const { id, ...rest } = board;
                boardStore.add(rest);
            });

            // Import assets
            (data.assets || []).forEach(asset => {
                const { id, ...rest } = asset;
                assetStore.add(rest);
            });

            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    return {
        open,
        getAllBoards,
        getBoard,
        putBoard,
        deleteBoard,
        getAssetsByBoard,
        getAllAssets,
        putAsset,
        deleteAsset,
        deleteAssetsByBoard,
        exportAll,
        importAll,
    };
})();