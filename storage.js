/* ================================================================
   window.storage シム — 端末のブラウザにデータを保存する
   ----------------------------------------------------------------
   このアプリは元々ネイティブラッパーが用意する window.storage
   ( async get(key)->{value} / async set(key,value) ) で保存する
   設計になっている。素のブラウザにはそれが無いので、ここで
   IndexedDB(容量に実質上限なし・写真の base64 も安全)を主、
   localStorage をフォールバックにした実装を用意する。

   note.js より前に読み込むこと。ネイティブ側が既に window.storage
   を注入している場合は上書きしない。
================================================================ */
(function(){
  if (window.storage && typeof window.storage.get === 'function') return;

  const DB_NAME = 'banso-store';
  const STORE   = 'kv';
  const hasIDB  = (function(){ try { return !!window.indexedDB; } catch(_) { return false; } })();

  let dbp = null;
  function openDB(){
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject)=>{
      let req;
      try { req = indexedDB.open(DB_NAME, 1); }
      catch(e){ reject(e); return; }
      req.onupgradeneeded = ()=>{ req.result.createObjectStore(STORE); };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror   = ()=> reject(req.error);
    });
    return dbp;
  }
  function idbGet(key){
    return openDB().then(db => new Promise((resolve, reject)=>{
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = ()=> resolve(r.result);
      r.onerror   = ()=> reject(r.error);
    }));
  }
  function idbSet(key, value){
    return openDB().then(db => new Promise((resolve, reject)=>{
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = ()=> resolve();
      tx.onerror    = ()=> reject(tx.error);
    }));
  }

  const lsGet = key => { try { return localStorage.getItem(key); } catch(_) { return null; } };
  const lsSet = (key, value) => { localStorage.setItem(key, value); };

  window.storage = {
    async get(key){
      if (hasIDB){
        try {
          const v = await idbGet(key);
          if (v != null) return { value: v };
          // IndexedDB は空でも、旧 localStorage 保存分があれば拾う
        } catch(_) { /* IndexedDB 不可 → localStorage へ */ }
      }
      const v = lsGet(key);
      return v == null ? null : { value: v };
    },
    async set(key, value){
      if (hasIDB){
        try { await idbSet(key, value); return; }
        catch(_) { /* IndexedDB 不可 → localStorage へ */ }
      }
      lsSet(key, value); // 容量超過時は例外 → 呼び出し側(saveNow)が toast 表示
    }
  };
})();
