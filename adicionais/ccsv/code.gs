/**
 * @OnlyCurrentDoc
 * Limita a autorização apenas a esta planilha (escopo mínimo).
 */

const NOME_ABA = 'validador';
const NOME_ABA_ERROS = 'erros';
const CABECALHO_ERROS = ['Data/Hora', 'Origem', 'Mensagem', 'Detalhe (stack)', 'Contexto'];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Validação')
    .addItem('Abrir scanner', 'abrirScanner')
    .addToUi();
}

function abrirScanner() {
  try {
    const html = HtmlService.createHtmlOutputFromFile('Scanner')
      .setWidth(500)
      .setHeight(440);
    SpreadsheetApp.getUi().showModalDialog(html, 'Validar série');
  } catch (e) {
    registrarErro('servidor:abrirScanner', e.message, e.stack, '');
    throw e;
  }
}

// Rode UMA vez pelo editor (botão Executar) para conceder a autorização.
function autorizar() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_ABA);
  if (!aba) throw new Error('A aba "' + NOME_ABA + '" não existe.');
  obterAbaErros_(); // já cria a aba de erros, se não existir
  console.log('Autorizado. Linhas na aba: ' + aba.getLastRow());
}

function normalizar_(valor) {
  return String(valor || '')
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
    .toUpperCase();
}

// Lê a coluna A (a partir da linha 2) UMA vez e devolve a lista normalizada.
// A conferência de cada leitura é feita no navegador, sem chamar o servidor.
function carregarSeries() {
  try {
    const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(NOME_ABA);
    if (!aba) throw new Error('A aba "' + NOME_ABA + '" não foi encontrada.');

    const ultima = aba.getLastRow();
    if (ultima < 2) return [];

    const valores = aba.getRange(2, 1, ultima - 1, 1).getDisplayValues();
    const lista = [];
    for (let i = 0; i < valores.length; i++) {
      const v = normalizar_(valores[i][0]);
      if (v) lista.push(v);
    }
    return lista;
  } catch (e) {
    registrarErro('servidor:carregarSeries', e.message, e.stack, '');
    throw e;
  }
}

// ---------------------------------------------------------------
// ABA DE ERROS
// ---------------------------------------------------------------

// Devolve a aba "erros"; cria (com cabeçalho) se ela não existir.
function obterAbaErros_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(NOME_ABA_ERROS);

  if (!aba) {
    const ativa = ss.getActiveSheet();
    aba = ss.insertSheet(NOME_ABA_ERROS);
    aba.getRange(1, 1, 1, CABECALHO_ERROS.length).setValues([CABECALHO_ERROS]).setFontWeight('bold');
    aba.setFrozenRows(1);
    aba.setColumnWidth(1, 150);
    aba.setColumnWidth(2, 200);
    aba.setColumnWidth(3, 350);
    aba.setColumnWidth(4, 450);
    aba.setColumnWidth(5, 200);
    if (ativa) ss.setActiveSheet(ativa); // não tira o usuário da aba em que estava
  }
  return aba;
}

// Evita que um texto iniciado por = + - @ seja interpretado como fórmula,
// e respeita o limite de tamanho da célula.
function textoSeguro_(valor) {
  let t = String(valor === undefined || valor === null ? '' : valor);
  if (t.length > 5000) t = t.substring(0, 5000) + '…[cortado]';
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return t;
}

/**
 * Grava UMA linha na aba "erros".
 * Chamada tanto pelo servidor quanto pelo navegador (google.script.run).
 */
function registrarErro(origem, mensagem, detalhe, contexto) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = obterAbaErros_();
    const dataHora = Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm:ss');

    aba.appendRow([
      dataHora,
      textoSeguro_(origem),
      textoSeguro_(mensagem),
      textoSeguro_(detalhe),
      textoSeguro_(contexto)
    ]);
    return true;
  } catch (e) {
    console.error('Falha ao registrar erro: ' + (e.stack || e.message));
    return false;
  }
}

<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; text-align: center; background: #f8fafc; }
    h2 { margin-top: 0; color: #1e293b; }
    input { width: 95%; box-sizing: border-box; padding: 15px; font-size: 20px;
            border: 2px solid #94a3b8; border-radius: 8px; margin: 12px 0; outline: none; }
    input:disabled { background: #e2e8f0; }
    #resultado { min-height: 130px; border-radius: 12px; display: flex; flex-direction: column;
                 align-items: center; justify-content: center; color: white; background: #64748b;
                 padding: 10px; box-sizing: border-box; overflow-wrap: anywhere; }
    #status { font-size: 23px; font-weight: bold; }
    #serieLida { font-size: 18px; margin-top: 12px; }
    .azul { background: #2563eb !important; }
    .vermelho { background: #dc2626 !important; }
    button { padding: 10px 20px; border: none; border-radius: 6px; background: #334155;
             color: white; font-size: 15px; cursor: pointer; margin: 14px 4px 0; }
    .ajuda { color: #64748b; font-size: 13px; }
  </style>
</head>
<body>
  <h2>Scanner de séries</h2>
  <p>Leia o código de barras do aparelho:</p>

  <input id="codigo" type="text" placeholder="Carregando lista..." autocomplete="off" disabled>

  <div id="resultado" role="status" aria-live="polite">
    <div id="status">CARREGANDO LISTA...</div>
    <div id="serieLida"></div>
  </div>

  <p class="ajuda" id="info"></p>

  <button onclick="campo.focus()">Nova leitura</button>
  <button onclick="carregar()">Atualizar lista</button>

  <script>
    const campo = document.getElementById('codigo');
    const resultado = document.getElementById('resultado');
    const status = document.getElementById('status');
    const serieLida = document.getElementById('serieLida');
    const info = document.getElementById('info');

    let series = new Set();

    // ---------- Registro de erros na aba "erros" ----------
    function logErro(origem, erro, contexto) {
      try {
        const mensagem = (erro && erro.message) ? erro.message : String(erro);
        const detalhe = (erro && erro.stack) ? erro.stack : '';
        google.script.run
          .withFailureHandler(function() { /* silencioso: evita laço infinito */ })
          .registrarErro(origem, mensagem, detalhe, contexto || '');
      } catch (_) { /* nunca deixa o log quebrar o scanner */ }
    }

    window.addEventListener('error', function(ev) {
      logErro('cliente:erro-js', ev.error || ev.message,
        (ev.filename || '') + ':' + (ev.lineno || '') + ':' + (ev.colno || ''));
    });

    window.addEventListener('unhandledrejection', function(ev) {
      logErro('cliente:promise-rejeitada', ev.reason, '');
    });

    // ---------- Sons (Web Audio) ----------
    let ctx;
    function audio() {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    function tom(freq, inicio, dur, tipo, vol) {
      const c = audio();
      const o = c.createOscillator();
      const g = c.createGain();
      const t = c.currentTime + inicio;
      o.type = tipo;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(c.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    // Um bip agradável: duas notas suaves ascendentes
    function bipOk() { tom(880, 0, 0.12, 'sine', 0.35); tom(1318.5, 0.1, 0.25, 'sine', 0.35); }
    // Dois bips curtos e graves
    function bipErro() { tom(220, 0, 0.12, 'square', 0.2); tom(220, 0.2, 0.12, 'square', 0.2); }

    // ---------- Carga da lista (uma vez) ----------
    function carregar() {
      campo.disabled = true;
      campo.placeholder = 'Carregando lista...';
      resultado.className = '';
      status.textContent = 'CARREGANDO LISTA...';
      serieLida.textContent = '';

      google.script.run
        .withSuccessHandler(function(lista) {
          series = new Set(lista);
          status.textContent = 'PRONTO PARA SCANNEAR';
          info.textContent = series.size + ' séries carregadas. Use "Atualizar lista" se a planilha mudar.';
          campo.placeholder = 'Aguardando leitura...';
          campo.disabled = false;
          campo.focus();
        })
        .withFailureHandler(function(erro) {
          logErro('cliente:carregarSeries(falha na chamada)', erro, '');
          resultado.className = 'vermelho';
          status.textContent = 'ERRO AO CARREGAR';
          serieLida.textContent = (erro && erro.message) || 'Tente novamente';
        })
        .carregarSeries();
    }

    // ---------- Validação instantânea (local) ----------
    function normalizar(v) {
      return String(v || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').toUpperCase();
    }

    function validar() {
      const bruto = campo.value.trim();
      if (!bruto) return;

      const achou = series.has(normalizar(bruto));
      resultado.className = achou ? 'azul' : 'vermelho';
      status.textContent = achou ? 'APARELHO ENCONTRADO' : 'APARELHO NÃO ENCONTRADO';
      serieLida.textContent = bruto;

      try {
        if (achou) bipOk(); else bipErro();
      } catch (e) {
        logErro('cliente:audio', e, 'serie=' + bruto);
      }

      // Mantém a série no campo, já selecionada: a próxima leitura do
      // scanner substitui o texto anterior automaticamente.
      campo.focus();
      campo.select();
    }

    campo.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        validar();
      }
    });

    carregar();
  </script>
</body>
</html>