/* app.js - SerieScan: importa CSV de 1 coluna e valida séries no modal do scanner */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    zonaArquivo: $('zona-arquivo'),
    arquivo: $('arquivo'),
    infoArquivo: $('info-arquivo'),
    preview: $('preview'),
    resumo: $('resumo'),
    btnImportar: $('btn-importar'),
    statusImport: $('status-import'),
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
    armadoStats: false,
    timerArmadoStats: null,
    origemLista: '',
    dirHandle: null,
    ultimoParsed: null
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
    setTimeout(function () { no.classList.add('sai'); }, 3400);
    setTimeout(function () { if (no.parentNode) no.remove(); }, 3750);
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

  function renderInfoArquivo() {
    el.infoArquivo.textContent = state.nomeArquivo
      ? state.nomeArquivo + ' — ' + state.linhas.length + ' linhas (' + state.codificacao + ')'
      : 'Nenhum arquivo carregado.';
  }

  function carregarArquivo(file) {
    if (!file) return;
    el.statusImport.textContent = '';
    var leitor = new FileReader();
    leitor.onload = function () {
      var d = decodificar(leitor.result);
      state.texto = d.texto;
      state.codificacao = d.codificacao;
      state.nomeArquivo = file.name;
      state.linhas = d.texto.split(/\r\n|\n|\r/);
      renderPreview();
      var resultado = parseLista(d.texto);
      state.ultimoParsed = resultado;
      renderResumo(resultado);
      renderInfoArquivo();
      el.btnImportar.disabled = resultado.mapa.size === 0;
      el.statusImport.textContent = resultado.mapa.size
        ? '✓ Arquivo carregado — ' + resultado.mapa.size + ' séries únicas. Clique em "Importar lista".'
        : 'Nenhuma série válida no arquivo.';
    };
    leitor.onerror = function () {
      el.statusImport.textContent = 'Não foi possível ler o arquivo.';
    };
    leitor.readAsArrayBuffer(file);
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
      var msg = 'Substituir a lista atual (' + state.lista.size + ' séries) por ' +
        resultado.mapa.size + ' séries?\nAs leituras também serão apagadas.';
      if (!window.confirm(msg)) return;
    }

    var series = [];
    resultado.mapa.forEach(function (original, norm) { series.push({ norm: norm, original: original }); });

    var salvamento = CCSVStorage.salvarLista({
      series: series,
      nomeArquivo: state.nomeArquivo,
      dataImportacao: new Date().toISOString()
    });

    if (!salvamento.ok) {
      el.statusImport.textContent = 'Falha ao salvar a lista: ' + (salvamento.erro || 'armazenamento indisponível.');
      showToast('Falha ao salvar a lista.', 'erro');
      return;
    }

    state.lista = resultado.mapa;
    state.origemLista = salvamento.onde;   // FIX: era 'origem', propriedade correta é 'onde'
    state.leituras = [];
    state.lidos = new Set();
    state.ultimoParsed = null;
    CCSVStorage.clearLeituras();
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
      gridHtml += '<div class="lista-info-item"><span class="val" title="' + escapar(cfg.nomeArquivo) + '">' +
        escapar(cfg.nomeArquivo.length > 22 ? cfg.nomeArquivo.slice(0, 20) + '…' : cfg.nomeArquivo) +
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
    if (!window.confirm('Limpar lista, leituras e configurações?')) return;
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
    var partes = [state.lista.size + ' séries carregadas'];
    if (cfg.nomeArquivo) partes.push('arquivo: ' + cfg.nomeArquivo);
    partes.push('use "Trocar lista" para importar outro CSV');
    el.infoModal.textContent = partes.join(' · ');
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

  function mostrarResultado(texto, tipo) {
    var mensagens = {
      ok: 'Aparelho encontrado ✓',
      erro: 'Aparelho não encontrado ✗',
      neutro: 'Pronto para scanear'
    };
    var situacao = mensagens[tipo] || '';
    // Remove animação para pode re-disparar
    el.resultado.classList.remove('entrada');
    void el.resultado.offsetWidth; // reflow para reiniciar animação
    el.resultado.className = 'resultado' + (tipo === 'neutro' ? '' : ' ' + tipo) +
      (tipo !== 'neutro' ? ' entrada' : '');
    el.resultado.querySelector('.serie').textContent = texto;
    el.resultado.querySelector('.situacao').textContent = situacao;
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
    var achou = state.lista.has(norm);

    // Verifica se já foi lida antes (duplicata de sessão)
    var jaLida = state.lidos.has(norm);

    mostrarResultado(bruto, achou ? 'ok' : 'erro');
    try { achou ? bipOk() : bipErro(); } catch (e) { /* sem áudio */ }

    var registro = {
      norm: norm,
      original: achou ? state.lista.get(norm) : bruto,
      status: achou ? 'encontrada' : 'fora_da_lista',
      duplicata: achou && jaLida,  // marcação extra para histórico
      quando: Date.now()
    };
    state.leituras.push(registro);
    if (achou) state.lidos.add(norm);
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
      var rotulo = l.status === 'encontrada'
        ? (l.duplicata ? 'duplicada' : 'na lista')
        : 'fora';
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
    try { localStorage.setItem('tema', tema); } catch (e) { /* sem persistência */ }
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

  el.btnNovaLeitura.addEventListener('click', function () {
    if (state.timerFoco) { clearTimeout(state.timerFoco); state.timerFoco = null; }
    selecionarCampo();
  });
  el.btnFecharScanner.addEventListener('click', fecharScanner);
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
  function desarmarStats() {
    state.armadoStats = false;
    if (state.timerArmadoStats) { clearTimeout(state.timerArmadoStats); state.timerArmadoStats = null; }
    el.btnLimparStats.classList.remove('armado');
    el.btnLimparStats.textContent = '';
    el.btnLimparStats.insertAdjacentHTML('afterbegin',
      '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>Limpar');
  }

  function limparStats(e) {
    e.stopPropagation(); // impede abrir/fechar o <details>
    if (!state.leituras.length) {
      showToast('Nenhuma estatística para limpar.', 'aviso');
      return;
    }
    if (!state.armadoStats) {
      state.armadoStats = true;
      el.btnLimparStats.classList.add('armado');
      el.btnLimparStats.textContent = '';
      el.btnLimparStats.insertAdjacentHTML('afterbegin',
        '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/></svg>Confirmar?');
      state.timerArmadoStats = setTimeout(desarmarStats, 4000);
      return;
    }
    // Segundo clique: executa a limpeza
    desarmarStats();
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
    if (e.key === 'Escape' && state.armadoStats) desarmarStats();
  });

  el.modal.addEventListener('close', function () {
    if (state.timerFoco) { clearTimeout(state.timerFoco); state.timerFoco = null; }
  });

  /* ============================================================
     INICIALIZAÇÃO
     ============================================================ */

  function iniciar() {
    var registro = CCSVStorage.carregarLista();
    if (registro && registro.series && registro.series.length) {
      state.lista = new Map();
      registro.series.forEach(function (s) { state.lista.set(s.norm, s.original); });
      state.origemLista = registro.origem || 'localStorage';
      state.leituras = CCSVStorage.getLeituras();
      state.leituras.forEach(function (l) {
        if (l.status === 'encontrada') state.lidos.add(l.norm);
      });
      renderCartaoLista();
      // Lista já salva: o scanner abre direto.
      abrirScanner();
    }
    restaurarPasta();
  }

  iniciar();
})();
