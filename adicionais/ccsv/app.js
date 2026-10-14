/* app.js - SerieScan: importa CSV de 1 coluna e valida séries no modal do scanner */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  /* Pedido 1.227: consentimento (banner LGPD/GDPR do index.html). Helper global
     consultado por este app e pelo storage.js antes de gravar conveniências
     (tema, histórico, lembrar planilha/Client ID). Sem estado (probes antigos),
     mantém true para não mudar o comportamento. */
  window.ccsvConsentePreferencias = function () {
    if (window.__ccsvConsent && typeof window.__ccsvConsent.permite === 'function') {
      return window.__ccsvConsent.permite('preferences');
    }
    return true;
  };

  var el = {
    zonaArquivo: $('zona-arquivo'),
    arquivo: $('arquivo'),
    infoArquivo: $('info-arquivo'),
    preview: $('preview'),
    resumo: $('resumo'),
    btnImportar: $('btn-importar'),
    statusImport: $('status-import'),
    gsheetUrl: $('gsheet-url'),
    btnCarregarGsheet: $('btn-carregar-gsheet'),
    gsheetStatus: $('gsheet-status'),
    gsheetEstrutura: $('gsheet-estrutura'),
    gsheetAba: $('gsheet-aba'),
    gsheetColuna: $('gsheet-coluna'),
    btnConectarGoogle: $('btn-conectar-google'),
    btnDesconectarGoogle: $('btn-desconectar-google'),
    gsConexaoStatus: $('gs-conexao-status'),
    gsConexaoBloco: $('gs-conexao-bloco'),
    gsClientidBloco: $('gs-clientid-bloco'),
    gsClientid: $('gs-clientid'),
    btnGsClientidSalvar: $('btn-gs-clientid-salvar'),
    gsClientidEmUso: $('gs-clientid-em-uso'),
    scriptUrl: $('script-url'),
    cartaoLista: $('cartao-lista'),
    listaInfoGrid: $('lista-info-grid'),
    infoLista: $('info-lista'),
    btnAbrirScanner: $('btn-abrir-scanner'),
    btnLimparTudo: $('btn-limpar-tudo'),
    modal: $('modal-scanner'),
    infoModal: $('info-modal'),
    resultado: $('resultado'),
    campo: $('campo'),
    barraFill: $('barra-fill'),
    barraTxt: $('barra-txt'),
    btnNovaLeitura: $('btn-nova-leitura'),
    btnFecharScanner: $('btn-fechar-scanner'),
    btnFecharModal: $('btn-fechar-modal'),
    cntLidas: $('cnt-lidas'),
    cntLocalizadas: $('cnt-localizadas'),
    cntFora: $('cnt-fora'),
    cntFaltando: $('cnt-faltando'),
    btnDesfazer: $('btn-desfazer'),
    btnLimparLeituras: $('btn-limpar-leituras'),
    btnLimparStats: $('btn-limpar-stats'),
    btnExportar: $('btn-exportar'),
    btnEscolherPasta: $('btn-escolher-pasta'),
    infoPasta: $('info-pasta'),
    historico: $('historico'),
    btnTema: $('btn-tema'),
    iconeSol: $('icone-sol'),
    iconeLua: $('icone-lua')
  };

  var state = {
    texto: '',
    nomeArquivo: '',
    codificacao: '',
    linhas: [],
    lista: new Map(),
    leituras: [],
    lidos: new Set(),
    audio: null,
    timerFoco: null,
    armadoLimpeza: false,
    timerArmado: null,
    origemLista: '',
    dirHandle: null,
    ultimoParsed: null,
    transportJsonp: null,      /* Pedido 1.202: injetável nos testes E2E */
    scriptChamados: new Set(), /* Pedido 1.202: 1 chamada por série/sessão */
    scriptAtivo: '',           /* Pedido 1.202: URL do Apps Script LOCALIZADO */
    /* Pedido 1.212: estrutura do Google Sheets carregado */
    gsInfo: null,        /* { id, gid } da planilha aberta */
    gsPrivado: false,   /* veio pela Sheets API (conta conectada)? */
    gsAbas: [],         /* [{ titulo, id }] */
    gsAbaSel: '',       /* título da aba escolhida */
    gsColunas: [],      /* cabeçalhos (rótulos) */
    gsColunaSel: -1,    /* índice da coluna escolhida */
    gsLinhas: new Map(),/* norm -> nº da linha real na planilha */
    gsStatusColOk: false, /* coluna STATUS já criada/confirmada */
    gsUrlCarregada: '',  /* Pedido 1.216: último link carregado com sucesso */
    gsLinkPlanilha: '',  /* Pedido 1.220: link da planilha ativa (nome clicável) */
    /* Pedido 1.224: sessão Google Sheet sobrevive ao F5 */
    restaurandoSessao: false,   /* recarga automática da própria sessão em andamento */
    restauracaoPendente: ''     /* URL aguardando o usuário reconectar o Google */
  };

  var ATRASO_FOCO_MS = 900;

  /* ============================================================
     NORMALIZAÇÃO
     ============================================================ */

  // Mesma regra do code.gs: remove espaços/invisíveis e coloca em maiúsculas.
  function normalizar(valor) {
    return String(valor == null ? '' : valor)
      .normalize('NFC')
      .replace(/[\s\u00A0\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
      .toUpperCase();
  }

  function escapar(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ============================================================
     DECODIFICAÇÃO DO ARQUIVO
     ============================================================ */

  function limparBOM(texto) {
    return texto && texto.charAt(0) === '\uFEFF' ? texto.slice(1) : texto;
  }

  function decodificar(buffer) {
    try {
      var utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      if (utf8.indexOf('\uFFFD') !== -1) throw new Error('substituicao');
      return { texto: limparBOM(utf8), codificacao: 'UTF-8' };
    } catch (e) { /* tenta outra codificação */ }
    try {
      return { texto: limparBOM(new TextDecoder('windows-1252').decode(buffer)), codificacao: 'Windows-1252' };
    } catch (e2) { /* última tentativa */ }
    return { texto: limparBOM(new TextDecoder('utf-8').decode(buffer)), codificacao: 'UTF-8 (com avisos)' };
  }

  /* ============================================================
     ÁUDIO (bips)
     ============================================================ */

  function contextoAudio() {
    if (!state.audio) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { state.audio = new AC(); } catch (e) { return null; }
    }
    if (state.audio.state === 'suspended') {
      var p = state.audio.resume();
      if (p && typeof p.catch === 'function') p.catch(function () { /* sem gesto do usuário */ });
    }
    return state.audio;
  }

  function tom(freq, atraso, duracao, tipo, volume) {
    var ctx = contextoAudio();
    if (!ctx) return;
    var t0 = ctx.currentTime + atraso;
    var osc = ctx.createOscillator();
    var ganho = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, t0);
    ganho.gain.setValueAtTime(0.0001, t0);
    ganho.gain.exponentialRampToValueAtTime(volume, t0 + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + duracao);
    osc.connect(ganho);
    ganho.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duracao + 0.02);
  }

  function bipOk() { tom(880, 0, 0.10, 'sine', 0.3); tom(1318.5, 0.09, 0.22, 'sine', 0.3); }
  function bipErro() { tom(220, 0, 0.10, 'square', 0.18); tom(180, 0.18, 0.10, 'square', 0.18); }

  /* ============================================================
     TOASTS
     ============================================================ */

  function showToast(mensagem, tipo) {
    var cont = $('toasts');
    if (!cont || !mensagem) return;
    var no = document.createElement('div');
    no.className = 'toast' + (tipo ? ' ' + tipo : '');
    no.textContent = mensagem;
    cont.appendChild(no);
    /* Pedido 1.221: toast sem validação fecha sozinho em 2 segundos */
    setTimeout(function () { no.classList.add('sai'); }, 2000);
    setTimeout(function () { if (no.parentNode) no.remove(); }, 2350);
  }

  /* ============================================================
     MODAL DE CONFIRMAÇÃO (Pedido 1.221 — fim dos diálogos nativos)
     ============================================================ */

  var confirmarFila = [];
  var confirmarEmUso = false;

  function confirmarModal(mensagem, titulo) {
    return new Promise(function (resolve) {
      confirmarFila.push({ mensagem: mensagem, titulo: titulo || 'Confirmar', resolve: resolve });
      confirmarProxima();
    });
  }

  function confirmarProxima() {
    if (confirmarEmUso || !confirmarFila.length) return;
    var pedido = confirmarFila.shift();
    var dlg = $('modal-confirmar');
    if (!dlg) { pedido.resolve(true); return; } /* sem modal no DOM: mantém o fluxo */
    if (window.__ccsvTest && window.__ccsvTest.confirmarAuto) { pedido.resolve(true); return; }
    confirmarEmUso = true;
    var msg = $('confirmar-msg');
    var tit = $('confirmar-titulo');
    var btnOk = $('confirmar-ok');
    var btnCancelar = $('confirmar-cancelar');
    if (msg) msg.textContent = pedido.mensagem;
    if (tit) tit.textContent = pedido.titulo;
    function fim(res) {
      btnOk.onclick = null; btnCancelar.onclick = null; dlg.oncancel = null;
      dlg.close();
      confirmarEmUso = false;
      pedido.resolve(res);
      setTimeout(confirmarProxima, 0);
    }
    btnOk.onclick = function () { fim(true); };
    btnCancelar.onclick = function () { fim(false); };
    dlg.oncancel = function (ev) { ev.preventDefault(); fim(false); }; /* Esc = Cancelar */
    dlg.showModal();
  }

  /* ============================================================
     UTILITÁRIOS DE DATA/HORA
     ============================================================ */

  function dataHora(ms) {
    var d = new Date(ms);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  function dataHoraCompleta(ms) {
    var d = new Date(ms);
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' +
      p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  /* ============================================================
     TXT AUTOMÁTICO DAS LOCALIZADAS
     ============================================================ */

  function mostrarInfoPasta(texto) {
    el.infoPasta.textContent = texto;
  }

  function conteudoTxtLocalizadas() {
    var linhas = [];
    state.lidos.forEach(function (norm) { linhas.push(state.lista.get(norm) || norm); });
    return linhas.length ? linhas.join('\r\n') + '\r\n' : '';
  }

  function gravarTxtAgora() {
    if (!state.dirHandle) return Promise.resolve();
    var nome = 'series_localizadas.txt';
    return state.dirHandle.getFileHandle(nome, { create: true })
      .then(function (arquivo) { return arquivo.createWritable(); })
      .then(function (escrita) {
        return escrita.write(conteudoTxtLocalizadas()).then(function () { return escrita.close(); });
      })
      .then(function () {
        mostrarInfoPasta('Arquivo "' + nome + '" gravado em "' + state.dirHandle.name +
          '" (' + state.lidos.size + ' séries).');
      })
      .catch(function (e) {
        showToast('Falha ao gravar o txt: ' + (e && e.message ? e.message : e), 'erro');
      });
  }

  function gravarTxtAutomatico() {
    if (!state.dirHandle) return;
    var perm;
    try { perm = state.dirHandle.queryPermission({ mode: 'readwrite' }); } catch (e) { return; }
    if (perm === 'granted') {
      gravarTxtAgora();
    } else if (perm === 'prompt') {
      mostrarInfoPasta('A pasta pede autorização de novo: clique em "Pasta do txt automático".');
    }
  }

  function escolherPasta() {
    if (!window.showDirectoryPicker) {
      showToast('Este navegador não permite escolher pasta. Use o botão "Exportar (CSV)".', 'aviso');
      return;
    }
    window.showDirectoryPicker({ mode: 'readwrite' }).then(function (handle) {
      state.dirHandle = handle;
      CCSVStorage.salvarChave('pasta_localizadas', handle).catch(function () { /* sem IDB */ });
      mostrarInfoPasta('TXT será gravado em "' + handle.name + '" a cada série encontrada.');
      showToast('Pasta escolhida: ' + handle.name + '.', 'ok');
      return gravarTxtAgora();
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return; // usuário cancelou
      showToast('Falha ao escolher pasta: ' + (e && e.message ? e.message : e), 'erro');
    });
  }

  function restaurarPasta() {
    CCSVStorage.lerChave('pasta_localizadas').then(function (handle) {
      if (!handle) return;
      state.dirHandle = handle;
      var perm;
      try { perm = handle.queryPermission({ mode: 'readwrite' }); } catch (e) { return; }
      if (perm === 'granted') {
        mostrarInfoPasta('TXT automático ativo em "' + handle.name + '".');
      } else {
        mostrarInfoPasta('Pasta "' + handle.name + '" guardada, mas pede autorização: ' +
          'clique em "Pasta do txt automático".');
      }
    }).catch(function () { /* sem IDB */ });
  }

  /* ============================================================
     LEITURA E PARSING DO CSV
     ============================================================ */

  // CSV de 1 coluna: cada linha não vazia é uma série.
  function parseLista(texto) {
    var linhas = texto.split(/\r\n|\n|\r/);
    var mapa = new Map();
    var vazias = 0;
    linhas.forEach(function (linha) {
      var bruto = linha.trim();
      // Remove delimitadores residuais no final da linha (ex: export do Excel com ponto-e-vírgula)
      bruto = bruto.replace(/[,;]+$/, '').trim();
      // Remove aspas duplas envolventes (ex: "SERIE123" -> SERIE123)
      if (bruto.length >= 2 && bruto.charAt(0) === '"' && bruto.charAt(bruto.length - 1) === '"') {
        bruto = bruto.slice(1, -1).replace(/""/g, '"').trim();
      }
      var norm = normalizar(bruto);
      if (!norm) { vazias++; return; }
      if (!mapa.has(norm)) mapa.set(norm, bruto);
    });
    return {
      mapa: mapa,
      totalLinhas: linhas.length,
      vazias: vazias,
      duplicadas: Math.max(0, linhas.length - vazias - mapa.size)
    };
  }

  function renderPreview() {
    if (!state.linhas.length) {
      el.preview.innerHTML = '<p class="vazio" style="padding:.5rem .65rem">Carregue um arquivo para ver o conteúdo.</p>';
      return;
    }
    var visiveis = state.linhas.filter(function (l) { return l.trim(); }).slice(0, 10);
    var itens = visiveis.map(function (linha) {
      return '<li>' + escapar(linha) + '</li>';
    }).join('');
    el.preview.innerHTML = '<ul>' + itens + '</ul>';
  }

  function renderResumo(resultado) {
    if (!state.linhas.length) {
      el.resumo.innerHTML = '<p class="vazio">Sem dados.</p>';
      return;
    }
    el.resumo.innerHTML =
      '<div class="item"><b>' + resultado.totalLinhas + '</b><span>linhas no arquivo</span></div>' +
      '<div class="item"><b>' + resultado.vazias + '</b><span>linhas vazias</span></div>' +
      '<div class="item"><b>' + resultado.duplicadas + '</b><span>duplicadas</span></div>' +
      '<div class="item"><b>' + resultado.mapa.size + '</b><span>séries únicas</span></div>';
  }

  /* Pedido 1.220: nome da planilha clicável — o link da origem Google Sheets
     (validado pelo extrairGsheet) abre em _blank no info-modal, no cartão da
     lista e no info do arquivo. Origem de arquivo local continua texto puro. */
  function linkPlanilhaAtivo(cfg) {
    var url = state.gsLinkPlanilha || (cfg && cfg.linkPlanilha) || '';
    return extrairGsheet(url) ? url : '';
  }
  function anchorOuTexto(nome, url) {
    if (!url) return escapar(nome);
    return '<a href="' + escapar(url) + '" target="_blank" rel="noopener">' + escapar(nome) + '</a>';
  }

  function renderInfoArquivo() {
    el.infoArquivo.innerHTML = state.nomeArquivo
      ? anchorOuTexto(state.nomeArquivo, linkPlanilhaAtivo(null)) +
        ' — ' + state.linhas.length + ' linhas (' + escapar(state.codificacao) + ')'
      : 'Nenhum arquivo carregado.';
  }

  function carregarArquivo(file) {
    if (!file) return;
    el.statusImport.textContent = '';
    gsResetEstrutura(); /* Pedido 1.212: arquivo local invalida a estrutura do Sheets */
    /* Pedido 1.202: XLSX lido com SheetJS carregado sob demanda (mesma
       biblioteca/CDN do app principal) — CSV/TXT seguem o caminho de texto. */
    if (/\.xlsx$/i.test(file.name) || /\.xlsm$/i.test(file.name)) {
      var leitorX = new FileReader();
      leitorX.onload = function () {
        parseXLSX(leitorX.result).then(function (texto) {
          aplicarTexto(texto, file.name, 'XLSX — 1ª coluna da 1ª aba');
        }).catch(function (erro) {
          el.statusImport.textContent = 'XLSX: ' + (erro && erro.message ? erro.message : erro);
          showToast('Não foi possível ler o XLSX.', 'erro');
        });
      };
      leitorX.onerror = function () { el.statusImport.textContent = 'Não foi possível ler o arquivo.'; };
      leitorX.readAsArrayBuffer(file);
      return;
    }
    var leitor = new FileReader();
    leitor.onload = function () {
      var d = decodificar(leitor.result);
      aplicarTexto(d.texto, file.name, d.codificacao);
    };
    leitor.onerror = function () {
      el.statusImport.textContent = 'Não foi possível ler o arquivo.';
    };
    leitor.readAsArrayBuffer(file);
  }

  /* ============================================================
     PEDIDO 1.202: APLICAÇÃO COMUM DO TEXTO EXTRAÍDO
     (CSV, TXT, XLSX e Google Sheets usam o mesmo pipeline)
     ============================================================ */

  function aplicarTexto(texto, nome, codificacao) {
    state.texto = texto;
    state.codificacao = codificacao;
    state.nomeArquivo = nome;
    state.linhas = texto.split(/\r\n|\n|\r/);
    renderPreview();
    var resultado = parseLista(texto);
    state.ultimoParsed = resultado;
    renderResumo(resultado);
    renderInfoArquivo();
    el.btnImportar.disabled = resultado.mapa.size === 0;
    el.statusImport.textContent = resultado.mapa.size
      ? '✓ Arquivo carregado — ' + resultado.mapa.size + ' séries únicas.'
      : 'Nenhuma série válida no arquivo.';
    /* Pedido 1.217: carga 100% válida (arquivo OU planilha) abre a consulta
       sozinha — importa a lista e abre o modal-scanner para iniciar a busca.
       Com lista anterior, o importar() pergunta antes de substituir. */
    if (resultado.mapa.size) setTimeout(function () { importar(); }, 0);
  }

  var promiseXLSX = null;
  function carregarLibXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (promiseXLSX) return promiseXLSX;
    promiseXLSX = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = function () { window.XLSX ? resolve(window.XLSX) : reject(new Error('leitor XLSX indisponível')); };
      s.onerror = function () { reject(new Error('falha ao carregar o leitor XLSX (CDN)')); };
      document.head.appendChild(s);
      setTimeout(function () { reject(new Error('tempo esgotado ao carregar o leitor XLSX')); }, 15000);
    });
    return promiseXLSX;
  }

  function parseXLSX(buffer) {
    return carregarLibXLSX().then(function (XLSX) {
      var wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
      var nome = wb.SheetNames[0];
      var matriz = XLSX.utils.sheet_to_json(wb.Sheets[nome], { header: 1, raw: false });
      var linhas = [];
      (matriz || []).forEach(function (linha) {
        linhas.push(linha && linha.length ? String(linha[0] == null ? '' : linha[0]) : '');
      });
      return linhas.join('\n');
    });
  }

  /* ============================================================
     PEDIDO 1.202: GOOGLE SHEETS (link público via gviz CSV)
     ============================================================ */

  function extrairGsheet(url) {
    var m = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(String(url || ''));
    if (!m) return null;
    var gid = /[?#&]gid=([0-9]+)/.exec(String(url || ''));
    return { id: m[1], gid: gid ? gid[1] : '' };
  }

  /* ============================================================
     PEDIDO 1.202: GOOGLE OAUTH (planilhas privadas)
     Mesma tecnologia do "Importar dados" do app principal: Google
     Identity Services (token em memória reutilizado até expirar) +
     leitura pela Sheets API v4. GS_CID_KEY é a MESMA chave do app
     principal — um Client ID salvo lá vale aqui (mesma origem).
     ============================================================ */

  var GS_CID_KEY = 'etiquetasZebra.gsClientId';
  var GS_CLIENT_ID_PROJETO = '686748375741-su504he100nrogd9u1ibgsaho6u8qv9k.apps.googleusercontent.com';
  /* Pedido 1.212: escopo de GRAVAÇÃO — "LOCALIZADO" é escrito na planilha
     automaticamente. Um token só de leitura (conectado pelo app principal,
     pedido 1.211) é detectado no 1º erro 403 e reautorizado na hora. */
  var GS_SCOPE_PROJETO = 'https://www.googleapis.com/auth/spreadsheets';
  var gsTokenMem = { valor: null, expira: 0 };

  function gsTokenValido() {
    return !!(gsTokenMem.valor && Date.now() < gsTokenMem.expira);
  }

  /* Pedido 1.211: conexão COMPARTILHADA entre as páginas da mesma origem
     (app principal e SerieScan) — o token vive no localStorage e vale até
     expirar; conectar em uma página conecta a outra, desconectar idem. */
  var GS_TOKEN_KEY = 'etiquetasZebra.gsToken';
  function gsRestaurarToken() {
    try {
      var bruto = localStorage.getItem(GS_TOKEN_KEY);
      if (!bruto) return;
      var reg = JSON.parse(bruto);
      if (reg && reg.valor && Date.now() < (reg.expira || 0)) {
        gsTokenMem = { valor: reg.valor, expira: reg.expira };
      } else {
        localStorage.removeItem(GS_TOKEN_KEY);
      }
    } catch (e) { /* sem localStorage */ }
  }
  function gsSalvarToken() {
    try { localStorage.setItem(GS_TOKEN_KEY, JSON.stringify(gsTokenMem)); } catch (e) { /* sem localStorage */ }
  }
  function gsLimparToken() {
    try { localStorage.removeItem(GS_TOKEN_KEY); } catch (e) { /* sem localStorage */ }
  }
  function gsStatusPorToken() {
    gsAtualizarStatus(gsTokenValido()
      ? 'Conectado — planilhas privadas da sua conta podem ser lidas.'
      : 'Não conectado — planilhas privadas pedem autorização da sua conta Google.');
  }

  function gsClientIdEfetivo() {
    var cidUsuario = '';
    try { cidUsuario = (localStorage.getItem(GS_CID_KEY) || '').trim(); } catch (e) { /* sem localStorage */ }
    return cidUsuario || GS_CLIENT_ID_PROJETO;
  }

  /* Diagnóstico (Pedido 1.202, refino pós-teste do usuário): mostra qual
     Client ID está em uso NESTA origem — localStorage é por origem, então
     o ID salvo em http://localhost não existe em https://localhost. */
  function gsRenderClientidEmUso() {
    if (!el.gsClientidEmUso) return;
    var cid = gsClientIdEfetivo();
    var personalizado = '';
    try { personalizado = (localStorage.getItem(GS_CID_KEY) || '').trim(); } catch (e) { /* sem localStorage */ }
    el.gsClientidEmUso.textContent = 'Client ID em uso nesta página (origem ' + location.origin + '): ' +
      (cid ? cid.slice(0, 10) + '…' + cid.slice(-30) : 'nenhum') +
      (cid === GS_CLIENT_ID_PROJETO
        ? ' — Client ID do PROJETO'
        : ' — o SEU Client ID salvo nesta origem');
  }

  function gsAtualizarStatus(txt) {
    if (el.gsConexaoStatus) el.gsConexaoStatus.textContent = txt;
    if (el.btnDesconectarGoogle) el.btnDesconectarGoogle.hidden = !gsTokenValido();
  }

  function gsErrouMotivo(resp) {
    var r = String((resp && (resp.error && resp.error.type)) || (resp && resp.error) || '');
    if (/popup_closed/i.test(r)) return 'Você fechou a janela de autorização antes de concluir.';
    if (/access_blocked/i.test(r)) return 'Acesso bloqueado pelo Google — a conta provavelmente não está na lista de USUÁRIOS DE TESTE da tela de consentimento do projeto.';
    if (/invalid_client|idpiframe|origin/i.test(r)) return 'Client ID/origem não autorizado pelo Google — registre a origem exata ' + location.origin + ' nas “Origens JavaScript autorizadas” do seu Client ID no Google Cloud Console (Erro 400: origin_mismatch).';
    if (/token_failed/i.test(r)) return 'Não foi possível obter o token da sua conta Google — tente de novo.';
    return 'Não foi possível conectar à sua conta Google (' + (r || 'sem detalhe') + ').';
  }

  function gsConectar(quandoPronto) {
    if (location.protocol === 'file:') {
      showToast('O login do Google não funciona abrindo o arquivo direto do disco (file://). Abra via http(s).', 'erro');
      return;
    }
    if (!(window.google && window.google.accounts && window.google.accounts.oauth2)) {
      showToast('Biblioteca da Google ainda está carregando — aguarde alguns segundos e tente de novo.', 'aviso');
      return;
    }
    /* Pedido 1.211: mesmas validações do app principal — em localhost o
       botão conecta normalmente; só avisa o que fazer se o Google recusar. */
    if (location.origin !== 'https://canalqb.github.io') {
      showToast('Atenção: se o Google recusar com Erro 400 origin_mismatch, registre a origem ' + location.origin + ' nas “Origens JavaScript autorizadas” do seu Client ID no Google Cloud Console.', 'aviso');
    }
    if (gsTokenValido()) { if (quandoPronto) quandoPronto(gsTokenMem.valor); return; }
    var clientCfg = {
      client_id: gsClientIdEfetivo(),
      scope: GS_SCOPE_PROJETO,
      callback: function (resp) {
        if (!resp || !resp.access_token) { showToast(gsErrouMotivo(resp), 'erro'); return; }
        gsTokenMem.valor = resp.access_token;
        gsTokenMem.expira = Date.now() + Math.max(60, (resp.expires_in || 3600) - 60) * 1000;
        gsSalvarToken(); /* Pedido 1.211: compartilha com as demais páginas da origem */
        try { if (ccsvConsentePreferencias()) localStorage.setItem('ccsv_gs_conectado', '1'); } catch (e) { /* sem localStorage */ }
        gsAtualizarStatus('Conectado — planilhas privadas da sua conta podem ser lidas.');
        showToast('Conectado com Google — planilhas privadas liberadas para leitura.', 'ok');
        if (quandoPronto) quandoPronto(gsTokenMem.valor);
        /* Pedido 1.224: reconectou por iniciativa própria — se uma sessão de
           planilha ficou pendente (token expirado no F5), retoma sozinha. */
        if (!quandoPronto && state.restauracaoPendente) {
          var uPend = state.restauracaoPendente;
          state.restauracaoPendente = '';
          if (el.gsheetUrl) el.gsheetUrl.value = uPend;
          restaurarGsheetSessao(uPend);
        }
      },
      error_callback: function (errResp) {
        showToast(gsErrouMotivo(errResp), 'erro');
      }
    };
    try {
      var tokenClient = google.accounts.oauth2.initTokenClient(clientCfg);
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (eGis) {
      showToast(gsErrouMotivo({ error: String(eGis && eGis.message || eGis) }), 'erro');
    }
  }

  function gsDesconectar() {
    var t = gsTokenMem.valor;
    gsTokenMem = { valor: null, expira: 0 };
    gsLimparToken(); /* Pedido 1.211 */
    try { localStorage.removeItem('ccsv_gs_conectado'); } catch (e) { /* sem localStorage */ }
    state.restauracaoPendente = ''; /* Pedido 1.224: desconectar encerra a retomada */
    gsAtualizarStatus('Não conectado — planilhas privadas pedem autorização da sua conta Google.');
    try { if (t && google && google.accounts && google.accounts.oauth2 && google.accounts.oauth2.revoke) google.accounts.oauth2.revoke(t, function () {}); } catch (eRev) { /* sem GIS */ }
    showToast('Conta Google desconectada.', 'aviso');
  }

  /* ============================================================
     PEDIDO 1.224: SESSÃO GOOGLE SHEET SOBREVIVE AO F5
     No load, com lista vinda de um Google Sheet, a planilha é
     RECARREGADA antes de abrir o scanner: sincronismo (gravação
     "LOCALIZADO"), aba e coluna voltam pela própria carga (dicas
     ccsv_gsheet_aba / ccsv_gsheet_col). Token expirado tenta
     reconexão silenciosa (prompt:'none') UMA vez quando a origem
     já tinha conectado antes (ccsv_gs_conectado); sem resposta, o
     bloco de conexão fica visível e o scanner NÃO abre sem a
     conexão garantida.
     ============================================================ */

  function gsConectarSilencioso(quandoResposta) {
    var atendeu = false;
    function responder(okSil) {
      if (atendeu) return;
      atendeu = true;
      quandoResposta(okSil);
    }
    if (location.protocol === 'file:') { responder(false); return; }
    if (!(window.google && window.google.accounts && window.google.accounts.oauth2)) { responder(false); return; }
    try {
      var tcSilencioso = google.accounts.oauth2.initTokenClient({
        client_id: gsClientIdEfetivo(),
        scope: GS_SCOPE_PROJETO,
        callback: function (respSil) {
          if (!respSil || !respSil.access_token) { responder(false); return; }
          gsTokenMem.valor = respSil.access_token;
          gsTokenMem.expira = Date.now() + Math.max(60, (respSil.expires_in || 3600) - 60) * 1000;
          gsSalvarToken();
          try { if (ccsvConsentePreferencias()) localStorage.setItem('ccsv_gs_conectado', '1'); } catch (e) { /* sem localStorage */ }
          gsAtualizarStatus('Conectado — planilhas privadas da sua conta podem ser lidas.');
          responder(true);
        },
        error_callback: function () { responder(false); }
      });
      tcSilencioso.requestAccessToken({ prompt: 'none' });
    } catch (eSil) { responder(false); }
    setTimeout(function () { responder(false); }, 12000);
  }

  function restaurarGsheetSessao(url) {
    var info = extrairGsheet(url);
    if (!info) {
      el.gsheetStatus.textContent = 'Link salvo inválido — cole o link da planilha de novo.';
      return;
    }
    state.restaurandoSessao = true;
    if (el.gsheetUrl) el.gsheetUrl.value = url;
    el.gsheetStatus.textContent = 'Restaurando a planilha salva (' + (gsTokenValido() ? 'sua conta Google' : 'CSV público') + ')…';
    gsResetEstrutura();
    function falha(motivo, pedirConexao) {
      state.restaurandoSessao = false;
      if (pedirConexao) state.restauracaoPendente = url;
      gsResetEstrutura(); /* limpa gsInfo para o bloco “Conectar com Google” aparecer */
      el.gsheetStatus.textContent = motivo;
    }
    var pedido = gsTokenValido() ? gsAbrirPrivado(info) : gsAbrirPublico(info);
    pedido.then(function () {
      /* Sucesso: gsFinalizarCarga → aplicarTexto → importar abre o scanner
         com aba, coluna e sincronismo de volta (pedidos 1.217/1.224). */
    }, function (erro) {
      var msg = erro && erro.message ? erro.message : String(erro);
      if (msg === 'privada' && !gsTokenValido()) {
        var jaConectou = false;
        try { jaConectou = localStorage.getItem('ccsv_gs_conectado') === '1'; } catch (e) { /* sem localStorage */ }
        if (jaConectou) {
          el.gsheetStatus.textContent = 'Planilha privada — reconectando com sua conta Google…';
          gsConectarSilencioso(function (okSil) {
            if (!okSil) {
              falha('Sessão do Google expirada — clique em “Conectar com Google” para continuar de onde parou.', true);
              return;
            }
            gsAbrirPrivado(info).then(null, function (eSil2) {
              falha('Não foi possível recarregar a planilha (' + (eSil2 && eSil2.message ? eSil2.message : eSil2) + ').');
            });
          });
          return;
        }
        falha('Planilha privada — clique em “Conectar com Google” para continuar de onde parou.', true);
        return;
      }
      falha('Não foi possível recarregar a planilha (' + msg + ').');
    });
  }

  /* ============================================================
     PEDIDO 1.212: ESTRUTURA DA PLANILHA — aba + coluna (cabeçalho)
     Privada: Sheets API v4 (Bearer). Pública: gviz (JSON p/ rótulos,
     CSV p/ dados). A coluna escolhida vira a lista de séries; com a
     conta conectada, "LOCALIZADO" é gravado na linha da série.
     ============================================================ */

  function colunaLetra(n) {
    var s = '';
    n = Math.max(1, Math.floor(n));
    while (n > 0) { var r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s || 'A';
  }

  function montarColunas(cabecalhos) {
    var cols = [];
    (cabecalhos || []).forEach(function (c, i) {
      var rot = String(c == null ? '' : c).trim();
      cols.push(rot || 'Coluna ' + (i + 1));
    });
    if (!cols.length) for (var k = 1; k <= 8; k++) cols.push('Coluna ' + k);
    return cols;
  }

  function escolherColuna(cols) {
    var lembrada = '';
    try { lembrada = (localStorage.getItem('ccsv_gsheet_col') || '').trim(); } catch (e) { /* sem localStorage */ }
    for (var i = 0; i < cols.length; i++) if (lembrada && cols[i] === lembrada) return i;
    for (var j = 0; j < cols.length; j++) if (cols[j].indexOf('Coluna ') !== 0) return j;
    return 0;
  }

  function gsRenderSeletores() {
    var mostra = state.gsAbas.length > 0 && state.gsColunas.length > 0;
    if (el.gsheetEstrutura) el.gsheetEstrutura.hidden = !mostra;
    if (el.gsheetAba) {
      el.gsheetAba.innerHTML = state.gsAbas.map(function (a) {
        return '<option value="' + escapar(a.titulo) + '"' + (a.titulo === state.gsAbaSel ? ' selected' : '') + '>' + escapar(a.titulo) + '</option>';
      }).join('');
      el.gsheetAba.disabled = state.gsAbas.length <= 1;
    }
    if (el.gsheetColuna) {
      el.gsheetColuna.innerHTML = state.gsColunas.map(function (c, i) {
        return '<option value="' + escapar(c) + '"' + (i === state.gsColunaSel ? ' selected' : '') + '>' +
          escapar(c) + ' (coluna ' + colunaLetra(i + 1) + ')</option>';
      }).join('');
    }
  }

  function gsResetEstrutura() {
    state.gsInfo = null;
    state.gsPrivado = false;
    state.gsAbas = [];
    state.gsAbaSel = '';
    state.gsColunas = [];
    state.gsColunaSel = -1;
    state.gsLinhas = new Map();
    state.gsStatusColOk = false;
    state.gsUrlCarregada = '';
    state.gsLinkPlanilha = '';
    gsRenderSeletores();
    gsRenderVisibilidadePrivada();
  }

  /* Pedido 1.216: o bloco de conexão Google + o Client ID avançado só
     aparecem quando a planilha em uso é PRIVADA (ou antes de qualquer
     carga) — planilha pública mostra apenas os seletores de aba/coluna. */
  function gsRenderVisibilidadePrivada() {
    var mostrar = !(state.gsInfo && !state.gsPrivado);
    if (el.gsConexaoBloco) el.gsConexaoBloco.hidden = !mostrar;
    if (el.gsClientidBloco) el.gsClientidBloco.hidden = !mostrar;
  }

  function gsErroLer(erro) {
    state.restaurandoSessao = false; /* Pedido 1.224: carga que falha não deixa a flag pendurada */
    el.gsheetStatus.textContent = 'Não foi possível ler a planilha (' + (erro && erro.message ? erro.message : erro) + ').';
    showToast('Falha ao ler o Google Sheets.', 'erro');
    return false;
  }

  function gsFinalizarCarga(linhas, rotuloColuna) {
    /* Pedido 1.220: o link precisa estar ativo ANTES do aplicarTexto — o
       renderInfoArquivo e o auto-import (1.217) leem state.gsLinkPlanilha
       imediatamente, e o nome clicável sumia por ordem de execução. */
    try {
      if (ccsvConsentePreferencias()) localStorage.setItem('ccsv_gsheet_url', el.gsheetUrl.value.trim());
      state.gsUrlCarregada = el.gsheetUrl.value.trim();
      state.gsLinkPlanilha = el.gsheetUrl.value.trim();
    } catch (e) { /* sem persistência */ }
    aplicarTexto(linhas.join('\n'),
      'Google Sheets — ' + (state.gsInfo ? state.gsInfo.id.slice(0, 10) : ''),
      state.gsPrivado ? 'Google Sheets (sua conta Google)' : 'Google Sheets (CSV público)');
    var total = state.ultimoParsed ? state.ultimoParsed.mapa.size : 0;
    el.gsheetStatus.textContent = '✓ Planilha lida — ' + total + ' séries únicas na coluna “' + rotuloColuna + '”' +
      (state.gsAbaSel ? ' (aba ' + state.gsAbaSel + ')' : '') + '.';
    showToast('Planilha carregada: ' + total + ' séries únicas.', 'ok');
    gsRenderSeletores();
    gsRenderVisibilidadePrivada();
    return total;
  }

  /* ---------- Planilha PRIVADA (Sheets API v4, Bearer token) ---------- */

  function gsChecarStatus(r) {
    if (r.status === 401) {
      gsTokenMem = { valor: null, expira: 0 };
      gsLimparToken(); /* Pedido 1.211 */
      gsAtualizarStatus('Não conectado — planilhas privadas pedem autorização da sua conta Google.');
      throw new Error('autorização expirada — clique em Conectar com Google e tente de novo');
    }
    if (r.status === 403) throw new Error('sua conta Google não tem permissão nesta planilha — solicite acesso ao proprietário');
    if (r.status === 404) throw new Error('planilha não encontrada — confira o link');
    if (r.status === 429) throw new Error('limite de requisições do Google excedido — aguarde um pouco');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r;
  }

  function gsLerJsonPrivado(caminho) {
    return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.gsInfo.id + '/' + caminho, {
      headers: { Authorization: 'Bearer ' + gsTokenMem.valor, Accept: 'application/json' }
    }).then(function (r) { return gsChecarStatus(r); }).then(function (r) { return r.json(); });
  }

  function gsAbrirPrivado(info) {
    state.gsPrivado = true;
    state.gsInfo = info;
    el.gsheetStatus.textContent = 'Lendo a planilha com sua conta Google…';
    return gsLerJsonPrivado('?fields=sheets(properties(sheetId,title))').then(function (meta) {
      state.gsAbas = (meta.sheets || []).map(function (s) {
        var p = s.properties || {};
        return { titulo: String(p.title || 'Aba'), id: String(p.sheetId != null ? p.sheetId : '') };
      });
      if (!state.gsAbas.length) throw new Error('planilha sem abas');
      var escolhida = null;
      var lembrada = '';
      try { lembrada = (localStorage.getItem('ccsv_gsheet_aba') || '').trim(); } catch (e) { /* sem localStorage */ }
      /* Pedido 1.224: na restauração de sessão (F5) a aba lembrada vence o gid
         do link — o gid aponta para a aba de onde o link foi copiado, não
         necessariamente para a que o usuário escolheu no select. */
      if (state.restaurandoSessao && lembrada) state.gsAbas.forEach(function (a) { if (a.titulo === lembrada) escolhida = a.titulo; });
      if (!escolhida && info.gid) state.gsAbas.forEach(function (a) { if (a.id === String(info.gid)) escolhida = a.titulo; });
      if (!escolhida) {
        state.gsAbas.forEach(function (a) { if (a.titulo === lembrada) escolhida = a.titulo; });
      }
      if (!escolhida) escolhida = state.gsAbas[0].titulo;
      return gsAbrirAbaPrivado(escolhida);
    });
  }

  function gsAbrirAbaPrivado(aba) {
    state.gsAbaSel = aba;
    var range = encodeURIComponent("'" + aba + "'!1:1");
    return gsLerJsonPrivado('values/' + range + '?majorDimension=ROWS').then(function (data) {
      state.gsColunas = montarColunas((data.values || [])[0]);
      return gsAplicarColunaPrivada(aba, escolherColuna(state.gsColunas));
    });
  }

  function gsAplicarColunaPrivada(aba, idx) {
    state.gsColunaSel = idx;
    var letra = colunaLetra(idx + 1);
    var range = encodeURIComponent("'" + aba + "'!" + letra + '2:' + letra + '5000');
    el.gsheetStatus.textContent = 'Lendo a coluna ' + letra + ' da aba ' + aba + '…';
    return gsLerJsonPrivado('values/' + range + '?majorDimension=ROWS').then(function (data) {
      state.gsLinhas = new Map();
      var linhas = [];
      (data.values || []).forEach(function (linha, i) {
        var v = linha && linha.length ? String(linha[0] == null ? '' : linha[0]) : '';
        linhas.push(v);
        var norm = normalizar(v);
        if (norm && !state.gsLinhas.has(norm)) state.gsLinhas.set(norm, i + 2); /* linha real na planilha */
      });
      return gsFinalizarCarga(linhas, state.gsColunas[idx] || ('Coluna ' + (idx + 1)));
    });
  }

  /* ---------- Planilha PÚBLICA (gviz, sem login) ---------- */

  function gsAbrirPublico(info) {
    state.gsPrivado = false;
    state.gsInfo = info;
    var urlJson = 'https://docs.google.com/spreadsheets/d/' + info.id + '/gviz/tq?tqx=out:json&headers=1' +
      (info.gid ? '&gid=' + info.gid : '');
    el.gsheetStatus.textContent = 'Lendo a planilha…';
    return fetch(urlJson).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (r.redirected) throw new Error('privada'); /* redirect de login = planilha não pública */
      return r.text();
    }).then(function (texto) {
      if (!texto || texto.charAt(0) === '<') throw new Error('privada'); /* HTML = pedido de login */
      /* gviz responde google.visualization.Query.setResponse({...}) — não é
         JSON puro; os rótulos vêm como "label":"…". Extrai por regex. */
      var rotulos = [];
      var reRotulo = /"label"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
      var mR;
      while ((mR = reRotulo.exec(texto))) rotulos.push(mR[1]);
      if (!rotulos.length) {
        var mCols = /"cols"\s*:/.exec(texto);
        if (!mCols) throw new Error('planilha sem conteúdo');
      }
      var rotuloAba = 'Aba do link' + (info.gid ? ' (gid ' + info.gid + ')' : '');
      state.gsAbas = [{ titulo: rotuloAba, id: info.gid || '' }];
      state.gsAbaSel = rotuloAba;
      state.gsColunas = montarColunas(rotulos);
      return gsAplicarColunaPublica(escolherColuna(state.gsColunas));
    });
  }

  function gsAplicarColunaPublica(idx) {
    state.gsColunaSel = idx;
    var letra = colunaLetra(idx + 1);
    var urlCsv = 'https://docs.google.com/spreadsheets/d/' + state.gsInfo.id + '/gviz/tq?tqx=out:csv&headers=1' +
      (state.gsInfo.gid ? '&gid=' + state.gsInfo.gid : '') + '&tq=' + encodeURIComponent('select ' + letra);
    el.gsheetStatus.textContent = 'Lendo a planilha…';
    return fetch(urlCsv).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      if (r.redirected) throw new Error('privada');
      return r.text();
    }).then(function (texto) {
      if (!texto || texto.charAt(0) === '<') throw new Error('privada');
      var linhas = texto.split(/\r\n|\n|\r/);
      var rotulo = state.gsColunas[idx] || '';
      var comCabecalho = linhas.length > 0 && rotulo && normalizar(linhas[0]) === normalizar(rotulo);
      var dados = linhas.slice(comCabecalho ? 1 : 0);
      state.gsLinhas = new Map();
      var saida = [];
      dados.forEach(function (v, i) {
        var norm = normalizar(v);
        if (norm && !state.gsLinhas.has(norm)) state.gsLinhas.set(norm, (comCabecalho ? 2 : 1) + i);
        saida.push(v);
      });
      return gsFinalizarCarga(saida, rotulo || ('Coluna ' + (idx + 1)));
    });
  }

  function carregarGsheet(auto) {
    var bruto = (el.gsheetUrl.value || '').trim();
    if (!bruto) {
      el.gsheetStatus.textContent = 'Cole o link da planilha primeiro.';
      return Promise.resolve(false);
    }
    var info = extrairGsheet(bruto);
    if (!info) {
      el.gsheetStatus.textContent = 'Link inválido — use o endereço do Google Sheets (docs.google.com/spreadsheets/d/…).';
      return Promise.resolve(false);
    }
    /* Pedido 1.224: retomada da sessão pendente (mesma planilha do F5 que
       ficou sem token) — a carga não pede confirmação e mantém as leituras. */
    if (state.restauracaoPendente) {
      var infoPend = extrairGsheet(state.restauracaoPendente);
      if (infoPend && infoPend.id === info.id) state.restaurandoSessao = true;
      state.restauracaoPendente = '';
    }
    gsResetEstrutura();
    /* Conectado: lê pela API (planilhas privadas E públicas). Sem token:
       tenta gviz; planilha privada conecta a conta na hora (1.202/1.212). */
    if (gsTokenValido()) return gsAbrirPrivado(info).catch(gsErroLer);
    return gsAbrirPublico(info).catch(function (erro) {
      var msg = erro && erro.message ? erro.message : String(erro);
      if (msg === 'privada' && !gsTokenValido()) {
        if (auto) {
          /* Pedido 1.216: no carregamento AUTOMÁTICO (colar/digitar o link) o
             popup do Google precisa de um clique do usuário — mostre o bloco
             de conexão em vez de tentar abrir sozinho. */
          gsResetEstrutura();
          el.gsheetStatus.textContent = 'Planilha privada — clique em “Conectar com Google” para lê-la.';
          return false;
        }
        el.gsheetStatus.textContent = 'Planilha privada detectada — conectando com sua conta Google…';
        return new Promise(function (resolve) {
          gsConectar(function () {
            gsAbrirPrivado(info).then(function (v) { resolve(v); }, function (e2) { resolve(gsErroLer(e2)); });
          });
        });
      }
      if (gsTokenValido()) return gsAbrirPrivado(info).catch(gsErroLer);
      return gsErroLer(erro);
    });
  }

  /* ============================================================
     PEDIDO 1.202: GRAVAR "LOCALIZADO" NO GOOGLE SHEETS (Apps Script)
     JSONP igual ao webhook do app principal — o script do usuário é
     que decide se cria (ou não) a coluna e grava na linha. 1 chamada
     por série por sessão; transporte injetável para os testes.
     ============================================================ */

  var seqJsonpScript = 0;

  function chamarScriptLocalizado(norm, original) {
    var base = (state.scriptAtivo || '').trim();
    if (!base || !norm) return;
    if (state.scriptChamados.has(norm)) return;
    state.scriptChamados.add(norm);
    seqJsonpScript++;
    var nomeCb = '__ccsvJsonp' + seqJsonpScript;
    var sep = base.indexOf('?') === -1 ? '?' : '&';
    var url = base + sep + 'serie=' + encodeURIComponent(original || norm) + '&callback=' + nomeCb;
    /* Pedido 1.212: informa a aba e a coluna escolhidas (quando vieram de um Google Sheet) */
    if (state.gsAbas.length && state.gsAbaSel) url += '&aba=' + encodeURIComponent(state.gsAbaSel);
    if (state.gsColunaSel >= 0 && state.gsColunas[state.gsColunaSel]) url += '&col=' + encodeURIComponent(state.gsColunas[state.gsColunaSel]);
    var finalizado = false;
    function finalizar() {
      if (finalizado) return;
      finalizado = true;
      try { delete window[nomeCb]; } catch (e) { window[nomeCb] = undefined; }
    }
    window[nomeCb] = function (res) {
      finalizar();
      if (res && res.ok === false) {
        showToast('Script LOCALIZADO respondeu falha' + (res.erro ? ': ' + res.erro : '') + '.', 'aviso');
        return;
      }
      /* Pedido 1.212: confirma a gravação no resultado do scan */
      var ultima = state.leituras[state.leituras.length - 1];
      if (ultima && ultima.norm === norm) {
        mostrarResultado(ultima.original, 'ok', 'Aparelho encontrado ✓\nAtualizado no Google Sheet, na última coluna');
      }
    };
    var transport = state.transportJsonp || function (urlAlvo) {
      var s = document.createElement('script');
      s.src = urlAlvo;
      s.onerror = function () {
        finalizar();
        showToast('Script LOCALIZADO não respondeu — confira a implantação (executar como "Qualquer pessoa").', 'aviso');
      };
      document.head.appendChild(s);
    };
    try { transport(url, nomeCb); } catch (e) { finalizar(); }
    setTimeout(finalizar, 20000);
  }

  /* ============================================================
     PEDIDO 1.212: GRAVAÇÃO AUTOMÁTICA DE "LOCALIZADO" (Sheets API)
     Com a conta Google conectada e a lista vinda de um Google Sheet,
     escreve na linha da série — coluna "STATUS" existente ou uma nova
     coluna após o último cabeçalho. Sem script visível, sem colar nada.
     ============================================================ */

  function gsResultadoEscrita(original, ok) {
    var ultima = state.leituras[state.leituras.length - 1];
    if (ultima && ultima.norm === normalizar(original)) {
      mostrarResultado(ultima.original, 'ok', ok
        ? 'Aparelho encontrado ✓\nAtualizado no Google Sheet, na última coluna'
        : 'Aparelho encontrado ✓\nFalha ao atualizar o Google Sheet');
    }
    if (!ok) showToast('Falha ao gravar “LOCALIZADO” no Google Sheet.', 'aviso');
  }

  function gravarLocalizado(norm, original) {
    if (gsTokenValido() && state.gsInfo && state.gsLinhas.has(norm)) {
      return gravarLocalizadoApi(norm).then(function (ok) {
        gsResultadoEscrita(original, ok);
      }).catch(function () {
        gsResultadoEscrita(original, false);
      });
    }
    /* Sem conta conectada (ou lista que não veio de um Google Sheet):
       caminho antigo via Apps Script público (pedido 1.202). */
    return chamarScriptLocalizado(norm, original);
  }

  function gravarLocalizadoApi(norm, reautorizado) {
    var aba = state.gsAbaSel;
    var linha = state.gsLinhas.get(norm);
    var idxStatus = -1;
    state.gsColunas.forEach(function (c, i) {
      if (idxStatus === -1 && String(c).trim().toUpperCase() === 'STATUS') idxStatus = i;
    });
    var letra = idxStatus !== -1 ? colunaLetra(idxStatus + 1) : colunaLetra(state.gsColunas.length + 1);
    var dados = [];
    if (idxStatus === -1 && !state.gsStatusColOk) {
      dados.push({ range: "'" + aba + "'!" + letra + '1', values: [['STATUS']] });
    }
    dados.push({ range: "'" + aba + "'!" + letra + linha, values: [['LOCALIZADO']] });
    return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.gsInfo.id + '/values:batchUpdate', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + gsTokenMem.valor, 'Content-Type': 'application/json' },
      body: JSON.stringify({ valueInputOption: 'RAW', data: dados })
    }).then(function (r) {
      if ((r.status === 401 || r.status === 403) && !reautorizado) return gsReautorizar(norm);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function () {
      state.gsStatusColOk = true;
      return true;
    });
  }

  function gsReautorizar(norm) {
    /* Token só de leitura (conectado pelo app principal, pedido 1.211)
       ou expirado: pede o escopo de GRAVAÇÃO e tenta 1× mais. */
    gsTokenMem = { valor: null, expira: 0 };
    gsLimparToken();
    return new Promise(function (resolve) {
      try {
        var tc = google.accounts.oauth2.initTokenClient({
          client_id: gsClientIdEfetivo(),
          scope: GS_SCOPE_PROJETO,
          callback: function (resp) {
            if (!resp || !resp.access_token) { resolve(false); return; }
            gsTokenMem.valor = resp.access_token;
            gsTokenMem.expira = Date.now() + Math.max(60, (resp.expires_in || 3600) - 60) * 1000;
            gsSalvarToken();
            gsAtualizarStatus('Conectado — planilhas privadas da sua conta podem ser lidas.');
            gravarLocalizadoApi(norm, true).then(function (ok) { resolve(ok); }, function () { resolve(false); });
          },
          error_callback: function () { resolve(false); }
        });
        tc.requestAccessToken({ prompt: 'consent' });
      } catch (e) { resolve(false); }
    });
  }

  /* ============================================================
     IMPORTAÇÃO
     ============================================================ */

  function importar() {
    // Usa cache se disponível para não reparsear
    var resultado = state.ultimoParsed || parseLista(state.texto);
    if (!resultado.mapa.size) {
      el.statusImport.textContent = 'Nenhuma série válida para importar.';
      return;
    }
    if (state.lista.size) {
      /* Pedido 1.224: recarga da própria sessão (F5) não pede confirmação —
         é a mesma planilha/aba/coluna sendo restaurada. */
      if (state.restaurandoSessao) { importarConfirmado(resultado); return; }
      /* Pedido 1.221: modal delicado no lugar do confirm() nativo */
      var msg = 'Substituir a lista atual (' + state.lista.size + ' séries) por ' +
        resultado.mapa.size + ' séries?\nAs leituras também serão apagadas.';
      confirmarModal(msg, 'Trocar lista')
        .then(function (ok) { if (ok) importarConfirmado(resultado); });
      return;
    }
    importarConfirmado(resultado);
  }

  function importarConfirmado(resultado) {
    var manterLeituras = !!state.restaurandoSessao; /* Pedido 1.224 */
    state.restaurandoSessao = false;
    var series = [];
    resultado.mapa.forEach(function (original, norm) { series.push({ norm: norm, original: original }); });

    var salvamento = CCSVStorage.salvarLista({
      series: series,
      nomeArquivo: state.nomeArquivo,
      dataImportacao: new Date().toISOString(),
      linkPlanilha: linkPlanilhaAtivo(null) /* Pedido 1.220: sobrevive ao F5 com a lista */
    });

    if (!salvamento.ok) {
      el.statusImport.textContent = 'Falha ao salvar a lista: ' + (salvamento.erro || 'armazenamento indisponível.');
      showToast('Falha ao salvar a lista.', 'erro');
      return;
    }

    state.lista = resultado.mapa;
    state.origemLista = salvamento.onde;   // FIX: era 'origem', propriedade correta é 'onde'
    if (manterLeituras) {
      /* Pedido 1.224: F5 na mesma sessão mantém o histórico — re-scan de
         série já consultada continua sem duplicar a contagem (pedido 1.212).
         Leituras de séries que saíram da planilha são descartadas. */
      var mapaNovo = resultado.mapa;
      state.leituras = state.leituras.filter(function (l) { return mapaNovo.has(l.norm); });
      state.lidos = new Set();
      state.leituras.forEach(function (l) { if (l.status === 'encontrada') state.lidos.add(l.norm); });
      CCSVStorage.setLeituras(state.leituras);
    } else {
      state.leituras = [];
      state.lidos = new Set();
      CCSVStorage.clearLeituras();
    }
    state.ultimoParsed = null;
    gravarTxtAutomatico();

    showToast('Lista salva: ' + resultado.mapa.size + ' séries únicas (' + salvamento.onde + ').', 'ok');
    renderCartaoLista();
    abrirScanner();
  }

  function renderCartaoLista() {
    var temLista = state.lista.size > 0;
    el.cartaoLista.hidden = !temLista;
    if (!temLista) return;

    var cfg = CCSVStorage.carregarLista() || {};

    // Grid de informações
    var gridHtml = '';
    if (cfg.nomeArquivo) {
      var nomeCurtoL = cfg.nomeArquivo.length > 22 ? cfg.nomeArquivo.slice(0, 20) + '…' : cfg.nomeArquivo;
      gridHtml += '<div class="lista-info-item"><span class="val" title="' + escapar(cfg.nomeArquivo) + '">' +
        anchorOuTexto(nomeCurtoL, linkPlanilhaAtivo(cfg)) +
        '</span><span class="rot">Arquivo</span></div>';
    }
    gridHtml += '<div class="lista-info-item"><span class="val">' + state.lista.size +
      '</span><span class="rot">Séries na lista</span></div>';
    if (cfg.dataImportacao) {
      gridHtml += '<div class="lista-info-item"><span class="val" style="font-size:.85rem">' +
        dataHoraCompleta(new Date(cfg.dataImportacao).getTime()) +
        '</span><span class="rot">Importada em</span></div>';
    }
    if (state.origemLista) {
      gridHtml += '<div class="lista-info-item"><span class="val" style="font-size:.9rem">' +
        escapar(state.origemLista) + '</span><span class="rot">Armazenamento</span></div>';
    }
    el.listaInfoGrid.innerHTML = gridHtml;
    el.infoLista.style.display = 'none'; // oculta o parágrafo simples — já temos o grid
  }

  function limparTudo() {
    /* Pedido 1.221: modal delicado no lugar do confirm() nativo */
    confirmarModal('Limpar lista, leituras e configurações?', 'Limpar tudo')
      .then(function (ok) { if (ok) limparTudoConfirmado(); });
  }

  function limparTudoConfirmado() {
    fecharScanner();
    CCSVStorage.limparLista();
    CCSVStorage.clearLeituras();
    state.lista = new Map();
    state.leituras = [];
    state.lidos = new Set();
    state.texto = '';
    state.nomeArquivo = '';
    state.codificacao = '';
    state.linhas = [];
    state.origemLista = '';
    state.ultimoParsed = null;
    state.scriptChamados = new Set(); /* Pedido 1.202 */
    gsResetEstrutura(); /* Pedido 1.212 */
    gravarTxtAutomatico();
    el.arquivo.value = '';
    el.btnImportar.disabled = true;
    renderPreview();
    renderResumo({ totalLinhas: 0, vazias: 0, duplicadas: 0, mapa: new Map() });
    renderInfoArquivo();
    renderCartaoLista();
    el.statusImport.textContent = 'Tudo limpo.';
    showToast('Lista e leituras apagados.', 'ok');
  }

  /* ============================================================
     MODAL DO SCANNER
     ============================================================ */

  function abrirScanner() {
    if (!state.lista.size) {
      showToast('Importe um CSV antes de abrir o scanner.', 'aviso');
      return;
    }
    renderInfoModal();
    mostrarResultado('Aguardando leitura', 'neutro');
    renderContadores();
    renderHistorico();
    renderBarraProgresso();
    if (!el.modal.open) el.modal.showModal();
    setTimeout(selecionarCampo, 0);
  }

  function fecharScanner() {
    if (state.timerFoco) { clearTimeout(state.timerFoco); state.timerFoco = null; }
    if (el.modal.open) el.modal.close();
  }

  function renderInfoModal() {
    var cfg = CCSVStorage.carregarLista() || {};
    /* Pedido 1.218: só séries + arquivo — as dicas de "Trocar lista" e de
       gravação "LOCALIZADO" saíram do rodapé do scanner.
       Pedido 1.220: nome da planilha vira link para a origem (abre em _blank). */
    var partes = [state.lista.size + ' séries carregadas'];
    if (cfg.nomeArquivo) partes.push('arquivo: ' + anchorOuTexto(cfg.nomeArquivo, linkPlanilhaAtivo(cfg)));
    el.infoModal.innerHTML = partes.join(' · ');
  }

  function selecionarCampo() {
    if (!el.modal.open) return;
    el.campo.focus();
    el.campo.select();
  }

  function agendarSelecao() {
    if (state.timerFoco) clearTimeout(state.timerFoco);
    state.timerFoco = setTimeout(function () {
      state.timerFoco = null;
      selecionarCampo();
    }, ATRASO_FOCO_MS);
  }

  function mostrarResultado(texto, tipo, situacao) {
    var mensagens = {
      ok: 'Aparelho encontrado ✓',
      erro: 'Aparelho não encontrado ✗',
      neutro: 'Pronto para scanear'
    };
    /* Pedido 1.212: situacao opcional substitui/acrescenta a mensagem
       padrão; "\n" vira quebra de linha (<br>) na tela. */
    var situacaoFinal = situacao || mensagens[tipo] || '';
    // Remove animação para pode re-disparar
    el.resultado.classList.remove('entrada');
    void el.resultado.offsetWidth; // reflow para reiniciar animação
    el.resultado.className = 'resultado' + (tipo === 'neutro' ? '' : ' ' + tipo) +
      (tipo !== 'neutro' ? ' entrada' : '');
    el.resultado.querySelector('.serie').textContent = texto;
    el.resultado.querySelector('.situacao').innerHTML =
      escapar(situacaoFinal).replace(/\n/g, '<br>');
  }

  function renderBarraProgresso() {
    if (!state.lista.size) {
      el.barraFill.style.width = '0%';
      el.barraTxt.textContent = '0%';
      return;
    }
    var pct = Math.round((state.lidos.size / state.lista.size) * 100);
    el.barraFill.style.width = pct + '%';
    el.barraTxt.textContent = pct + '%';
  }

  function validar() {
    var bruto = el.campo.value.trim();
    if (!bruto) { selecionarCampo(); return; }

    var norm = normalizar(bruto);

    /* Pedido 1.212: re-scan de valor já consultado NÃO conta 2× —
       repete o status anterior e sai sem novo registro no histórico. */
    var anterior = null;
    for (var iR = state.leituras.length - 1; iR >= 0; iR--) {
      if (state.leituras[iR].norm === norm) { anterior = state.leituras[iR]; break; }
    }
    if (anterior) {
      var eraAchou = anterior.status === 'encontrada';
      mostrarResultado(bruto, eraAchou ? 'ok' : 'erro',
        (eraAchou ? 'Aparelho encontrado ✓' : 'Aparelho não encontrado ✗') + '\nJá consultada' +
        (eraAchou ? ' (na lista)' : ' (fora da lista)') + ' — sem contar 2×');
      try { eraAchou ? bipOk() : bipErro(); } catch (e) { /* sem áudio */ }
      agendarSelecao();
      return;
    }

    var achou = state.lista.has(norm);

    mostrarResultado(bruto, achou ? 'ok' : 'erro');
    try { achou ? bipOk() : bipErro(); } catch (e) { /* sem áudio */ }

    var registro = {
      norm: norm,
      original: achou ? state.lista.get(norm) : bruto,
      status: achou ? 'encontrada' : 'fora_da_lista',
      quando: Date.now()
    };
    state.leituras.push(registro);
    if (achou) {
      state.lidos.add(norm);
      gravarLocalizado(norm, registro.original); /* Pedidos 1.202/1.212: LOCALIZADO no Sheets */
    }
    state.leituras = CCSVStorage.setLeituras(state.leituras);

    renderContadores();
    renderHistorico();
    renderBarraProgresso();
    if (achou) gravarTxtAutomatico();
    agendarSelecao();
  }

  /* ============================================================
     CONTADORES, HISTÓRICO, DESFAZER, EXPORTAR
     ============================================================ */

  function renderContadores() {
    var localizadas = 0, fora = 0;
    state.leituras.forEach(function (l) {
      if (l.status === 'encontrada') localizadas++;
      else fora++;
    });
    el.cntLidas.textContent = state.leituras.length;
    el.cntLocalizadas.textContent = localizadas;
    el.cntFora.textContent = fora;
    el.cntFaltando.textContent = Math.max(0, state.lista.size - state.lidos.size);
  }

  function renderHistorico() {
    if (!state.leituras.length) {
      el.historico.innerHTML = '<li class="vazio">Nenhuma leitura ainda.</li>';
      return;
    }
    var ultimos = state.leituras.slice(-60).reverse();
    el.historico.innerHTML = ultimos.map(function (l) {
      var tipo = l.status === 'encontrada' ? 'ok' : 'erro';
      var rotulo = l.status === 'encontrada' ? 'na lista' : 'fora';
      return '<li class="' + tipo + '">' +
        '<span class="hora">' + dataHora(l.quando) + '</span>' +
        '<span class="serie">' + escapar(l.original) + '</span>' +
        '<span class="st">' + rotulo + '</span>' +
        '</li>';
    }).join('');
  }

  function desfazer() {
    var ultima = state.leituras.pop();
    if (!ultima) {
      showToast('Nada para desfazer.', 'aviso');
      return;
    }
    // Reconstrói o Set de lidos a partir das leituras restantes
    state.lidos = new Set();
    state.leituras.forEach(function (l) {
      if (l.status === 'encontrada') state.lidos.add(l.norm);
    });
    CCSVStorage.setLeituras(state.leituras);
    renderContadores();
    renderHistorico();
    renderBarraProgresso();
    gravarTxtAutomatico();
    mostrarResultado('Desfeito: ' + ultima.original, 'neutro');
    showToast('Última leitura desfeita.', 'ok');
    agendarSelecao();
  }

  function desarmarLimpeza() {
    state.armadoLimpeza = false;
    el.btnLimparLeituras.setAttribute('data-dica', 'Limpar leituras');
    el.btnLimparLeituras.setAttribute('aria-label', 'Limpar as leituras');
    el.btnLimparLeituras.classList.remove('ativo');
    if (state.timerArmado) { clearTimeout(state.timerArmado); state.timerArmado = null; }
  }

  function limparLeituras() {
    if (!state.armadoLimpeza) {
      // Primeiro clique: armar confirmação
      state.armadoLimpeza = true;
      el.btnLimparLeituras.setAttribute('data-dica', 'Clique de novo para confirmar!');
      el.btnLimparLeituras.setAttribute('aria-label', 'Confirmar exclusão de todas as leituras');
      el.btnLimparLeituras.classList.add('ativo');
      state.timerArmado = setTimeout(desarmarLimpeza, 4000);
      showToast('Clique novamente para confirmar a exclusão.', 'aviso');
      return;
    }
    desarmarLimpeza();
    CCSVStorage.clearLeituras();
    state.leituras = [];
    state.lidos = new Set();
    renderContadores();
    renderHistorico();
    renderBarraProgresso();
    mostrarResultado('Aguardando leitura', 'neutro');
    gravarTxtAutomatico();
    showToast('Todas as leituras foram apagadas.', 'ok');
    agendarSelecao();
  }

  function celulaCSV(valor) {
    var v = String(valor == null ? '' : valor);
    if (v.indexOf(';') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1 || v.indexOf('\r') !== -1) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  }

  // Exporta SOMENTE as séries localizadas em CSV de 1 coluna.
  function exportar() {
    if (!state.lidos.size) {
      showToast('Nenhuma série localizada para exportar.', 'aviso');
      return;
    }
    var linhas = [];
    state.lidos.forEach(function (norm) { linhas.push(celulaCSV(state.lista.get(norm) || norm)); });
    var csv = '\uFEFF' + linhas.join('\r\n') + '\r\n';
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var d = new Date();
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    a.href = url;
    a.download = 'seriescan_localizadas_' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '_' +
      p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
    showToast('CSV exportado: ' + state.lidos.size + ' séries localizadas.', 'ok');
    agendarSelecao();
  }

  /* ============================================================
     TEMA CLARO / ESCURO
     ============================================================ */

  function temaAtual() {
    return document.documentElement.getAttribute('data-theme') === 'escuro' ? 'escuro' : 'claro';
  }

  function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    try { if (ccsvConsentePreferencias()) localStorage.setItem('tema', tema); } catch (e) { /* sem persistência */ }
    var escuro = tema === 'escuro';
    el.btnTema.setAttribute('aria-pressed', escuro ? 'true' : 'false');
    el.btnTema.setAttribute('aria-label', escuro ? 'Ativar tema claro' : 'Ativar tema escuro');
    // Alterna ícone sol/lua
    if (el.iconeSol) el.iconeSol.style.display = escuro ? 'none' : '';
    if (el.iconeLua) el.iconeLua.style.display = escuro ? '' : 'none';
  }

  el.btnTema.addEventListener('click', function () {
    aplicarTema(temaAtual() === 'escuro' ? 'claro' : 'escuro');
    if (el.modal.open) agendarSelecao();
  });
  aplicarTema(temaAtual());

  /* ============================================================
     EVENTOS
     ============================================================ */

  // Desbloqueia o AudioContext na primeira interação do usuário
  document.addEventListener('pointerdown', function initAudio() {
    contextoAudio();
    document.removeEventListener('pointerdown', initAudio);
  }, { once: true, passive: true });

  el.arquivo.addEventListener('click', function () {
    this.value = ''; // permite re-selecionar o mesmo arquivo se necessário
  });

  el.arquivo.addEventListener('change', function () {
    if (el.arquivo.files && el.arquivo.files[0]) carregarArquivo(el.arquivo.files[0]);
  });

  // Suporte a clicar na zona inteira (sem precisar mirar no label)
  el.zonaArquivo.addEventListener('click', function (e) {
    if (e.target.closest('label') || e.target === el.arquivo) return;
    el.arquivo.click();
  });

  el.zonaArquivo.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.arquivo.click(); }
  });

  ['dragenter', 'dragover'].forEach(function (nome) {
    el.zonaArquivo.addEventListener(nome, function (e) {
      e.preventDefault();
      el.zonaArquivo.classList.add('arrastando');
    });
  });
  ['dragleave', 'drop'].forEach(function (nome) {
    el.zonaArquivo.addEventListener(nome, function (e) {
      e.preventDefault();
      el.zonaArquivo.classList.remove('arrastando');
    });
  });
  el.zonaArquivo.addEventListener('drop', function (e) {
    var arquivos = e.dataTransfer && e.dataTransfer.files;
    if (arquivos && arquivos[0]) carregarArquivo(arquivos[0]);
  });

  el.btnImportar.addEventListener('click', importar);
  el.btnAbrirScanner.addEventListener('click', function () { contextoAudio(); abrirScanner(); });
  el.btnLimparTudo.addEventListener('click', limparTudo);

  /* Pedido 1.202: Google Sheets + script LOCALIZADO */
  el.btnCarregarGsheet.addEventListener('click', function () { carregarGsheet(); });
  /* Pedido 1.216: conectou — se há link válido ainda não lido, carrega sozinho. */
  el.btnConectarGoogle.addEventListener('click', function () {
    gsConectar(function () {
      var v = (el.gsheetUrl.value || '').trim();
      if (v && extrairGsheet(v) && !state.gsInfo) carregarGsheet();
    });
  });
  el.btnDesconectarGoogle.addEventListener('click', gsDesconectar);
  if (el.gsClientid) {
    try { el.gsClientid.value = localStorage.getItem(GS_CID_KEY) || ''; } catch (e) { /* sem localStorage */ }
    gsRenderClientidEmUso();
    var salvarCid = function () {
      var v = (el.gsClientid.value || '').trim();
      try { if (ccsvConsentePreferencias()) localStorage.setItem(GS_CID_KEY, v); } catch (e) { /* sem localStorage */ }
      gsRenderClientidEmUso();
      showToast(v ? 'Client ID personalizado salvo — substitui o Client ID do projeto neste navegador (nesta origem).' : 'Client ID personalizado limpo — voltando ao Client ID do projeto.', 'ok');
    };
    el.btnGsClientidSalvar.addEventListener('click', salvarCid);
    el.gsClientid.addEventListener('change', salvarCid);
  }
  /* Pedido 1.211: outra página da origem conectou/desconectou — acompanha em tempo real */
  window.addEventListener('storage', function (ev) {
    if (!ev || ev.key !== GS_TOKEN_KEY) return;
    gsTokenMem = { valor: null, expira: 0 };
    gsRestaurarToken();
    gsStatusPorToken();
    /* Pedido 1.224: outra página da origem conectou — sessão pendente retoma */
    if (gsTokenValido() && state.restauracaoPendente) {
      var uOutra = state.restauracaoPendente;
      state.restauracaoPendente = '';
      if (el.gsheetUrl) el.gsheetUrl.value = uOutra;
      restaurarGsheetSessao(uOutra);
    }
  });
  el.gsheetUrl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); carregarGsheet(); }
  });
  /* Pedido 1.216: colar/terminar de digitar o link carrega a planilha
     sozinha (debounce 900ms — só link válido e diferente do já carregado). */
  var gsTimerAuto = null;
  el.gsheetUrl.addEventListener('input', function () {
    if (gsTimerAuto) clearTimeout(gsTimerAuto);
    gsTimerAuto = setTimeout(function () {
      gsTimerAuto = null;
      var v = (el.gsheetUrl.value || '').trim();
      if (!v || v === state.gsUrlCarregada || !extrairGsheet(v)) return;
      carregarGsheet(true);
    }, 900);
  });
  /* Pedido 1.212: trocar de aba (privada) recarrega cabeçalhos e séries;
     trocar de coluna recarrega só as séries da coluna escolhida. */
  el.gsheetAba.addEventListener('change', function () {
    state.gsAbaSel = el.gsheetAba.value;
    try { if (ccsvConsentePreferencias()) localStorage.setItem('ccsv_gsheet_aba', state.gsAbaSel); } catch (e) { /* sem localStorage */ }
    if (!state.gsInfo || !state.gsPrivado) return; /* pública: só existe a aba do link */
    el.gsheetStatus.textContent = 'Lendo a aba ' + state.gsAbaSel + '…';
    gsAbrirAbaPrivado(state.gsAbaSel).catch(gsErroLer);
  });
  el.gsheetColuna.addEventListener('change', function () {
    var idx = el.gsheetColuna.selectedIndex;
    if (idx < 0 || !state.gsInfo) return;
    try { if (ccsvConsentePreferencias()) localStorage.setItem('ccsv_gsheet_col', state.gsColunas[idx] || ''); } catch (e) { /* sem localStorage */ }
    var pedido = state.gsPrivado
      ? gsAplicarColunaPrivada(state.gsAbaSel, idx)
      : gsAplicarColunaPublica(idx);
    pedido.catch(gsErroLer);
  });
  el.scriptUrl.addEventListener('change', function () {
    state.scriptAtivo = (el.scriptUrl.value || '').trim();
    try { if (ccsvConsentePreferencias()) localStorage.setItem('ccsv_script_url', state.scriptAtivo); } catch (e) { /* sem persistência */ }
    state.scriptChamados = new Set();
    showToast(state.scriptAtivo ? 'Gravação “LOCALIZADO” ativada.' : 'Gravação “LOCALIZADO” desativada.', 'ok');
  });

  el.btnNovaLeitura.addEventListener('click', function () {
    if (state.timerFoco) { clearTimeout(state.timerFoco); state.timerFoco = null; }
    selecionarCampo();
  });
  /* Pedido 1.218: fechar o scanner limpa o cache do LINK da planilha (evita o
     duplo carregamento da origem de dados no próximo uso), mantendo o login
     do Google e o link do Apps Script para uso futuro. */
  el.btnFecharScanner.addEventListener('click', function () {
    try {
      localStorage.removeItem('ccsv_gsheet_url');
      localStorage.removeItem('ccsv_gsheet_aba');
      localStorage.removeItem('ccsv_gsheet_col');
    } catch (e) { /* sem localStorage */ }
    if (el.gsheetUrl) el.gsheetUrl.value = '';
    state.gsUrlCarregada = '';
    gsResetEstrutura();
    el.gsheetStatus.textContent = 'Cole o link da planilha — ela carrega sozinha. Depois escolha a aba e a coluna (pelo cabeçalho) com as séries. Planilhas privadas: o botão “Conectar com Google” aparece quando for o caso — conectado, a série localizada grava “LOCALIZADO” na planilha automaticamente.';
    fecharScanner();
  });
  el.btnFecharModal.addEventListener('click', fecharScanner);

  el.campo.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    contextoAudio();
    validar();
  });

  // Suporte a colar: valida imediatamente após paste
  el.campo.addEventListener('paste', function () {
    setTimeout(function () {
      if (el.campo.value.trim()) {
        contextoAudio();
        validar();
      }
    }, 50);
  });

  // Foco permanente: se o campo perder o foco dentro do modal, devolve.
  el.campo.addEventListener('blur', function () {
    if (!el.modal.open) return;
    setTimeout(function () {
      if (!el.modal.open) return;
      var ativo = document.activeElement;
      if (!ativo || ativo === document.body || ativo === el.campo) selecionarCampo();
    }, 150);
  });

  el.btnDesfazer.addEventListener('click', desfazer);
  el.btnLimparLeituras.addEventListener('click', limparLeituras);
  el.btnExportar.addEventListener('click', exportar);
  el.btnEscolherPasta.addEventListener('click', escolherPasta);

  // Botão de limpar estatísticas e histórico (dentro do <summary>, precisa de stopPropagation)
  /* Pedido 1.217: 1 clique só — a confirmação em 2 tempos foi removida. */
  function limparStats(e) {
    e.stopPropagation(); // impede abrir/fechar o <details>
    if (!state.leituras.length) {
      showToast('Nenhuma estatística para limpar.', 'aviso');
      return;
    }
    CCSVStorage.clearLeituras();
    state.leituras = [];
    state.lidos = new Set();
    renderContadores();
    renderHistorico();
    renderBarraProgresso();
    mostrarResultado('Aguardando leitura', 'neutro');
    gravarTxtAutomatico();
    showToast('Estatísticas e histórico limpos.', 'ok');
    agendarSelecao();
  }

  el.btnLimparStats.addEventListener('click', limparStats);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && state.armadoLimpeza) desarmarLimpeza();
  });

  el.modal.addEventListener('close', function () {
    if (state.timerFoco) { clearTimeout(state.timerFoco); state.timerFoco = null; }
  });

  /* ============================================================
     INICIALIZAÇÃO
     ============================================================ */

  function iniciar() {
    var registro = CCSVStorage.carregarLista();
    var temLista = !!(registro && registro.series && registro.series.length);
    /* Pedido 1.202: restaura os links salvos (Google Sheets + script LOCALIZADO) */
    try {
      var uG = localStorage.getItem('ccsv_gsheet_url');
      var uS = localStorage.getItem('ccsv_script_url');
      if (uG && el.gsheetUrl) el.gsheetUrl.value = uG;
      if (uS) { state.scriptAtivo = uS; if (el.scriptUrl) el.scriptUrl.value = uS; }
    } catch (e) { /* sem localStorage */ }
    /* Pedido 1.211: reconecta sozinho se outra página da origem já conectou */
    gsRestaurarToken();
    if (gsTokenValido()) gsStatusPorToken();
    restaurarPasta();
    if (temLista) {
      state.lista = new Map();
      registro.series.forEach(function (s) { state.lista.set(s.norm, s.original); });
      state.origemLista = registro.origem || 'localStorage';
      state.leituras = CCSVStorage.getLeituras();
      state.leituras.forEach(function (l) {
        if (l.status === 'encontrada') state.lidos.add(l.norm);
      });
      renderCartaoLista();
    }
    /* Pedido 1.224: lista vinda de Google Sheet recarrega a planilha ANTES de
       abrir o scanner — sincronismo ("LOCALIZADO"), aba e coluna voltam pela
       própria carga; o modal só abre com a conexão garantida. */
    var urlSessao = '';
    try { urlSessao = (localStorage.getItem('ccsv_gsheet_url') || '').trim(); } catch (e) { /* sem localStorage */ }
    if (!urlSessao && temLista && registro.linkPlanilha) urlSessao = String(registro.linkPlanilha).trim();
    var origemGsheet = temLista && /^Google Sheets/i.test(String(registro.nomeArquivo || ''));
    if (origemGsheet && urlSessao && extrairGsheet(urlSessao)) {
      restaurarGsheetSessao(urlSessao);
      return;
    }
    if (origemGsheet && temLista) {
      /* Origem Google Sheet sem link recuperável: a lista anterior continua
         salva, mas o scanner não abre sem reconectar a planilha. */
      el.gsheetStatus.textContent = 'Cole o link da planilha para reconectar o scanner — a lista anterior continua salva.';
      return;
    }
    if (temLista) abrirScanner(); /* arquivo: abre direto como antes */
  }

  /* Pedido 1.202: gancho de testes E2E (mesmo padrão __zebraTest do app principal) */
  window.__ccsvTest = {
    carregarArquivo: carregarArquivo,
    carregarGsheet: carregarGsheet,
    extrairGsheet: extrairGsheet,
    chamarScriptLocalizado: chamarScriptLocalizado,
    aplicarTexto: aplicarTexto,
    setTransporteJsonp: function (fn) { state.transportJsonp = fn; },
    gsRestaurarToken: gsRestaurarToken,
    gsSimularToken: function (token, expires_in) {
      gsTokenMem.valor = token;
      gsTokenMem.expira = Date.now() + Math.max(60, (expires_in || 3600) - 60) * 1000;
      gsAtualizarStatus('Conectado — planilhas privadas da sua conta podem ser lidas.');
    },
    get gsConexaoTexto() { return el.gsConexaoStatus ? el.gsConexaoStatus.textContent : ''; },
    setScriptUrl: function (u) { state.scriptAtivo = u || ''; state.scriptChamados = new Set(); },
    get listaSize() { return state.lista.size; },
    get lidosSize() { return state.lidos.size; },
    get scriptChamados() { return state.scriptChamados.size; },
    /* Pedido 1.212 */
    get leiturasLength() { return state.leituras.length; },
    get gsLinhasSize() { return state.gsLinhas.size; },
    get resultadoTexto() { return el.resultado ? el.resultado.querySelector('.situacao').textContent : ''; },
    /* Pedido 1.221: modal de confirmação + toast 2s (usados pelo probe t115) */
    confirmarModal: confirmarModal,
    showToast: showToast,
    confirmarAuto: false
  };

  iniciar();
})();
