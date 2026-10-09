/* storage.js - unica camada que grava e le dados da lista (localStorage com fallback em cookie) */
var CCSVStorage = (function () {
  'use strict';

  var CHAVE_LISTA = 'ccsv_lista';
  var CHAVE_LEITURAS = 'ccsv_leituras';
  var PREFIXO_COOKIE = 'ccsv_l_';
  var DIAS_COOKIE = 30;
  var MAX_PARTES_COOKIE = 40;
  var TAMANHO_PARTE = 3500;
  var MAX_LEITURAS = 50;
  var bancoMeta = null;

  /* ---------------- localStorage ---------------- */

  function lerLS(chave) {
    try { return localStorage.getItem(chave); } catch (e) { return null; }
  }

  function gravarLS(chave, valor) {
    try { localStorage.setItem(chave, valor); return true; } catch (e) { return false; }
  }

  function removerLS(chave) {
    try { localStorage.removeItem(chave); } catch (e) { /* ignora */ }
  }

  /* ---------------- cookies (alternativa ao localStorage) ---------------- */

  function gravarCookie(nome, valor, dias) {
    var d = new Date();
    d.setTime(d.getTime() + dias * 86400000);
    document.cookie = nome + '=' + encodeURIComponent(valor) +
      '; expires=' + d.toUTCString() + '; path=/; SameSite=Lax';
  }

  function lerCookie(nome) {
    var partes = document.cookie.split('; ');
    for (var i = 0; i < partes.length; i++) {
      var igual = partes[i].indexOf('=');
      if (igual > 0 && partes[i].slice(0, igual) === nome) {
        return decodeURIComponent(partes[i].slice(igual + 1));
      }
    }
    return null;
  }

  function apagarCookie(nome) {
    document.cookie = nome + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax';
  }

  // Cookies tem limite de ~4 KB cada: a lista e dividida em partes numeradas.
  function gravarCookieDividido(json) {
    apagarCookiesLista();
    var partes = Math.ceil(json.length / TAMANHO_PARTE) || 1;
    if (partes > MAX_PARTES_COOKIE) return false;
    for (var i = 0; i < partes; i++) {
      gravarCookie(
        PREFIXO_COOKIE + i,
        json.slice(i * TAMANHO_PARTE, (i + 1) * TAMANHO_PARTE),
        DIAS_COOKIE
      );
    }
    gravarCookie(PREFIXO_COOKIE + 'n', String(partes), DIAS_COOKIE);
    return lerCookieDividido() === json;
  }

  function lerCookieDividido() {
    var total = parseInt(lerCookie(PREFIXO_COOKIE + 'n'), 10);
    if (!total || total < 1 || total > MAX_PARTES_COOKIE) return null;
    var json = '';
    for (var i = 0; i < total; i++) {
      var parte = lerCookie(PREFIXO_COOKIE + i);
      if (parte == null) return null;
      json += parte;
    }
    return json;
  }

  function apagarCookiesLista() {
    var total = parseInt(lerCookie(PREFIXO_COOKIE + 'n'), 10) || 0;
    for (var i = 0; i < total; i++) apagarCookie(PREFIXO_COOKIE + i);
    apagarCookie(PREFIXO_COOKIE + 'n');
  }

  /* ---------------- API ---------------- */

  // Mini banco so para guardar o handle da pasta escolhida (handle de
  // diretorio nao cabe no localStorage; structured clone so existe no IDB).
  function abrirMeta() {
    if (bancoMeta) return Promise.resolve(bancoMeta);
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('IndexedDB indisponivel.')); return; }
      var req = indexedDB.open('ccsv_meta', 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('chaves')) db.createObjectStore('chaves', { keyPath: 'chave' });
      };
      req.onsuccess = function () { bancoMeta = req.result; resolve(bancoMeta); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function prometerMeta(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  return {
    // registro: { series: [{norm, original}], nomeArquivo, dataImportacao }
    salvarLista: function (registro) {
      var json;
      try { json = JSON.stringify(registro); } catch (e) { return { ok: false, onde: 'nenhum' }; }
      if (gravarLS(CHAVE_LISTA, json)) return { ok: true, onde: 'localStorage' };
      if (gravarCookieDividido(json)) return { ok: true, onde: 'cookie' };
      return { ok: false, onde: 'nenhum', erro: 'Lista grande demais para o cookie.' };
    },

    carregarLista: function () {
      var json = lerLS(CHAVE_LISTA);
      var origem = 'localStorage';
      if (json == null) {
        json = lerCookieDividido();
        origem = 'cookie';
      }
      if (json == null) return null;
      try {
        var registro = JSON.parse(json);
        registro.origem = origem;
        return registro;
      } catch (e) { return null; }
    },

    limparLista: function () {
      removerLS(CHAVE_LISTA);
      apagarCookiesLista();
    },

    // Historico e um extra: vai so no localStorage (cookie so para a lista).
    getLeituras: function () {
      var json = lerLS(CHAVE_LEITURAS);
      if (json == null) return [];
      try {
        var lista = JSON.parse(json);
        return Array.isArray(lista) ? lista.slice(-MAX_LEITURAS) : [];
      } catch (e) { return []; }
    },

    setLeituras: function (leituras) {
      var corte = leituras.slice(-MAX_LEITURAS);
      gravarLS(CHAVE_LEITURAS, JSON.stringify(corte));
      return corte;
    },

    clearLeituras: function () {
      removerLS(CHAVE_LEITURAS);
    },

    salvarChave: function (chave, valor) {
      return abrirMeta().then(function (db) {
        var tx = db.transaction('chaves', 'readwrite');
        tx.objectStore('chaves').put({ chave: chave, valor: valor });
        return new Promise(function (resolve, reject) {
          tx.oncomplete = function () { resolve(true); };
          tx.onerror = function () { reject(tx.error); };
        });
      });
    },

    lerChave: function (chave) {
      return abrirMeta().then(function (db) {
        return prometerMeta(db.transaction('chaves', 'readonly').objectStore('chaves').get(chave));
      }).then(function (registro) { return registro ? registro.valor : null; });
    }
  };
})();
