#!/usr/bin/env node
/*
 * Servidor local de impressão para Zebra via FTP (login/senha em branco).
 *
 * O navegador não fala FTP, então a página envia o ZPL para este servidor
 * (POST /print com {ip, zpl}) e ele faz o upload para a impressora usando
 * FTP na porta 21, com login e senha EM BRANCO — sem driver.
 * A impressora imprime o arquivo "etiqueta.zpl" recebido.
 *
 * Segurança: escuta apenas em 127.0.0.1 (somente esta máquina),
 * assim visitantes do GitHub Pages (ou da rede local) NÃO conseguem
 * usar este servidor para enviar impressões.
 *
 * Consultas de dados (ponte local — "Opção B" do plano de fontes de dados):
 *   POST /query-odbc { dsn, usuario, senha, sql }
 *   POST /query-db   { tipo: "mysql|postgres|sqlserver", host, porta, usuario, senha, banco, sql }
 *   Resposta: { ok: true, colunas: [...], linhas: [[...]] } ou { ok: false, error: "mensagem" }
 *   Módulos opcionais (instale só o que for usar): npm install odbc | mysql2 | pg | mssql
 *   Credenciais trafegam apenas nesta máquina e NUNCA são gravadas em disco.
 *
 * Impressão em streaming (Pedido 1.130):
 *   POST /print-one { ip, zpl, protocol: "tcp"|"ftp", esperado }
 *   Envia UM bloco de etiqueta por vez; no TCP 9100 espera a impressora
 *   confirmar a impressão física pelo odômetro SGD (odometer.total_printed)
 *   antes de responder — o navegador só dispara a próxima ao receber ok.
 *   Resposta: { ok: true, validado: true|false, odometro? } ou { ok: false, error }.
 *   Env PRINT_ONE_TIMEOUT ajusta o tempo máximo por etiqueta (padrão 60s).
 *
 * Descoberta de impressoras na rede (análise https.txt — GET /descobrir):
 *   mDNS/Bonjour pelos serviços Zebra (_pdl-datastream._tcp e _printer._tcp,
 *   RFC 6762/6763) e, se nada responder, varredura da porta 9100 na sub-rede
 *   local. Resposta: { ok: true, metodo: "mdns"|"varredura", impressoras: [{nome, ip, porta}] }.
 *   Cache de 30s — cliques repetidos não bombardeiam a rede.
 *
 * Uso: node print-server.js   (escuta na porta 3001)
 */
"use strict";

var http = require("http");
var https = require("https");
var net = require("net");
var os = require("os");
var dgram = require("dgram");

var PORTA = 3001;            // porta do servidor HTTP local
var FTP_PORTA = parseInt(process.env.FTP_PORT, 10) || 21; // porta FTP da Zebra (padrão 21)
var TIMEOUT_FTP = 12000; // ms por etapa do diálogo FTP
var TIMEOUT_TCP_ENVIO = parseInt(process.env.TCP_SEND_TIMEOUT, 10) || 10000; // ms sem progresso enviando ZPL (auditoria A7)

/* ---------------- CORS (auditoria A1) ----------------
   Só origens legítimas do app podem dirigir a ponte: file:// (null),
   localhost, IPs de rede privada (XAMPP servindo a LAN) e o Pages do
   projeto. Site aleatório aberto no navegador do usuário NÃO passa no
   preflight — antes, Access-Control-Allow-Origin:* deixava qualquer
   página imprimir/consultar pela ponte. */
var ORIGENS_EXTRA = String(process.env.PRINT_SERVER_ORIGENS || "").split(",").map(function (o) { return o.trim(); }).filter(Boolean);
function origemPermitida(origin) {
  if (!origin) return true;          // mesma origem / curl (requisição sem Origin)
  if (origin === "null") return true; // file:// (app aberto direto do disco)
  var m = /^https?:\/\/([^:/]+)(?::\d+)?$/i.exec(origin);
  var h = m ? m[1].toLowerCase() : "";
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true;
  if (/^10(\.\d{1,3}){3}$/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}$/.test(h)) return true;
  if (h === "canalqb.github.io" || h === "canalqb.github.io." ) return true;
  if (ORIGENS_EXTRA.indexOf(origin) !== -1) return true;
  return false;
}

/* ---------------- Cliente FTP mínimo (login/senha em branco) ---------------- */

function FTPCliente(ip) {
  this.ip = ip;
  this.porta = FTP_PORTA;
  this.sock = null;
  this.dados = null;
  this.buffer = "";
  this.fila = []; // respostas pendentes: {codigos, cb}
}

// Fecha os dois sockets (controle e dados).
FTPCliente.prototype.fechar = function () {
  if (this.dados) { try { this.dados.destroy(); } catch (e) {} }
  if (this.sock) { try { this.sock.destroy(); } catch (e) {} }
};

// Processa linhas CRLF; respostas finais "NNN " encerram uma espera.
FTPCliente.prototype.onDados = function (chunk) {
  this.buffer += chunk.toString("utf8");
  var idx;
  while ((idx = this.buffer.indexOf("\r\n")) >= 0) {
    var linha = this.buffer.slice(0, idx);
    this.buffer = this.buffer.slice(idx + 2);
    var m = /^(\d{3})([- ])(.*)$/.exec(linha);
    if (!m) continue;
    if (m[2] === "-") continue; // linha intermediária (ex.: banner multi-linha)
    var codigo = +m[1]; // comparação numérica com os códigos esperados
    var pend = this.fila.shift();
    if (pend) pend.cb(null, codigo, m[3]);
  }
};

// Envia um comando e registra a espera da(s) resposta(s) esperada(s).
FTPCliente.prototype.enviar = function (linha) {
  if (!this.sock) return;
  this.sock.write(linha + "\r\n");
};

FTPCliente.prototype.esperar = function (codigos, cb, rotulo) {
  var self = this;
  var pend = null;
  var t = setTimeout(function () {
    self.fila = self.fila.filter(function (p) { return p !== pend; });
    cb(new Error("FTP: timeout aguardando " + (rotulo || codigos.join("/"))));
  }, TIMEOUT_FTP);
  pend = {
    codigos: codigos,
    cb: function (err, codigo, texto) {
      clearTimeout(t);
      if (err) return cb(err);
      if (codigos.indexOf(codigo) < 0) {
        return cb(new Error("FTP: resposta inesperada " + codigo + (texto ? " (" + texto + ")" : "")));
      }
      cb(null, codigo, texto);
    }
  };
  this.fila.push(pend);
};

/*
 * Fluxo FTP: banner 220 -> USER (em branco) -> PASS (em branco) -> TYPE I ->
 * PASV (porta de dados) -> STOR etiqueta.zpl -> 226 -> QUIT.
 * cb(err, {porta}) — err não nulo em qualquer falha.
 */
function enviarFTP(ip, zpl, cb) {
  var ftp = new FTPCliente(ip);
  var terminado = false;

  function terminar(err, info) {
    if (terminado) return;
    terminado = true;
    ftp.fechar();
    cb(err || null, info);
  }

  var sock = net.connect(FTP_PORTA, ip, function () {
    ftp.sock = sock;
    ftp.esperar([220], function (err) {
      if (err) return terminar(err);
      ftp.enviar("USER ");
      ftp.esperar([230, 331], function (err, cod) {
        if (err) return terminar(err);
        if (cod === 331) {
          ftp.enviar("PASS ");
          ftp.esperar([230], function (err2) {
            if (err2) return terminar(err2);
            prepararEnvio();
          });
        } else {
          prepararEnvio();
        }
      });
    });
  });
  sock.on("error", function (e) {
    terminar(new Error("Conexão FTP com " + ip + ":" + FTP_PORTA + " falhou (" + e.code + "). Confira o IP e a rede."));
  });
  sock.on("data", function (d) { ftp.onDados(d); });

  function prepararEnvio() {
    ftp.enviar("TYPE I");
    ftp.esperar([200], function (err) {
      if (err) return terminar(err);
      ftp.enviar("PASV");
      ftp.esperar([227], function (err2, cod, texto) {
        if (err2) return terminar(err2);
        var h = /\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)/.exec(texto);
        if (!h) return terminar(new Error("FTP: resposta PASV inválida: " + texto));
        var dport = (+h[5]) * 256 + (+h[6]);
        // Ordem dos waiters: 150 (início do envio) vem antes do 226 (fim).
        ftp.esperar([125, 150], function (err3) {
          if (err3) return terminar(err3);
          ftp.dados.end(Buffer.from(zpl, "utf8")); // envia o ZPL e fecha o canal de dados
        });
        ftp.esperar([226, 250], function (err3) {
          if (err3) return terminar(err3);
          ftp.enviar("QUIT");
          setTimeout(function () { terminar(null, { porta: 21 }); }, 300);
        });
        var dsock = net.connect(dport, ip, function () {
          ftp.enviar("STOR etiqueta.zpl");
        });
        ftp.dados = dsock;
        dsock.on("error", function (e) {
          terminar(new Error("FTP: erro no canal de dados (" + e.code + ")."));
        });
      });
    });
  }
}

/* ---------------- Envio TCP Direct (Porta 9100 Raw) ---------------- */
function enviarTCP(ip, zpl, cb) {
  var porta = parseInt(process.env.TCP_PORT, 10) || 9100;
  var respondido = false;
  var socket = net.connect(porta, ip, function () {
    socket.write(Buffer.from(zpl, "utf8"), function () {
      socket.end();
      if (!respondido) { respondido = true; cb(null, { porta: porta }); }
    });
  });
  socket.setTimeout(TIMEOUT_TCP_ENVIO, function () {
    socket.destroy();
    if (!respondido) {
      respondido = true;
      cb(new Error("TCP 9100: tempo esgotado ENVIANDO para " + ip + ":" + porta + " (sem progresso) — etiqueta pode ter saido parcial."));
    }
  });
  socket.on("error", function (e) {
    if (!respondido) { respondido = true; cb(new Error("TCP 9100: erro no socket com " + ip + ":" + porta + " (" + e.code + ").")); }
  });
}

/* ---------------- Impressão uma-por-uma com validação (Pedido 1.130) ----------------
   POST /print-one {ip, zpl, protocol, esperado}
   TCP 9100: envia UM bloco de etiqueta e espera a impressora confirmar a
   impressão física pelo odômetro SGD (odometer.total_printed — contador de
   etiquetas impressas, só sobe quando a etiqueta sai de verdade). O ~HS serve
   de detector de erros na hora (cabeça aberta / papel acabou). FTP: envia um
   bloco por vez, sem validação (o canal FTP não devolve status). */
var PRINT_ONE_TIMEOUT = parseInt(process.env.PRINT_ONE_TIMEOUT, 10) || 60000;

/* Conexão de uma pergunta só: escreve o comando, lê a primeira linha
   completa (CRLF) e fecha — sem estado, sem emoldurar respostas. */
function consultarZebra(ip, porta, cmd, cb) {
  var s = net.connect(porta, ip);
  var buf = "";
  var fechado = false;
  var t = setTimeout(function () { terminar(null); }, 3000);
  function terminar(txt) {
    if (fechado) return;
    fechado = true;
    clearTimeout(t);
    try { s.destroy(); } catch (e) {}
    cb(txt);
  }
  s.on("connect", function () { s.write(cmd); });
  s.on("data", function (d) {
    buf += d.toString("utf8");
    if (buf.indexOf("\r\n") >= 0) terminar(buf);
  });
  s.on("error", function () { terminar(null); });
  s.on("close", function () { terminar(buf); });
}

function imprimirUmValidado(ip, zpl, esperado, proto, cb) {
  if (proto !== "tcp") {
    enviarFTP(ip, zpl, function (err) {
      cb(err ? { ok: false, error: err.message } : { ok: true, validado: false, protocolo: "ftp" });
    });
    return;
  }
  var porta = parseInt(process.env.TCP_PORT, 10) || 9100;
  var inicio = Date.now();
  var terminado = false;

  function fim(resp) {
    if (terminado) return;
    terminado = true;
    cb(resp);
  }
  function lerOdo(cb2) {
    consultarZebra(ip, porta, '!U1 getvar "odometer.total_printed"\r\n', function (txt) {
      var m = /\"(\d+)\"/.exec(txt || "");
      cb2(m ? parseInt(m[1], 10) : null);
    });
  }
  function errosHS(cb2) {
    consultarZebra(ip, porta, "~HS\r\n", function (txt) {
      if (!txt) { cb2(null); return; }
      var l1 = (String(txt).split(/\r?\n/)[0] || "").split(",");
      if (String(l1[1] || "").trim() === "1") { cb2("cabeça de impressão aberta"); return; }
      if (String(l1[2] || "").trim() === "1") { cb2("papel acabou (sem mídia)"); return; }
      cb2(null);
    });
  }
  function aguardar(base) {
    errosHS(function (erro) {
      if (erro) return fim({ ok: false, error: erro, validado: false });
      if (Date.now() - inicio > PRINT_ONE_TIMEOUT) {
        return fim({ ok: false, error: "tempo esgotado esperando a impressora confirmar a etiqueta (checou papel/cabeça e o medidor?)", validado: false });
      }
      lerOdo(function (atual) {
        if (base != null && atual != null && atual >= base + esperado) {
          return fim({ ok: true, validado: true, odometro: atual, protocolo: "tcp" });
        }
        if (base == null && atual == null && Date.now() - inicio > 2500) {
          return fim({ ok: true, validado: false, protocolo: "tcp" }); /* impressora sem odômetro legível: enviada sem validação física */
        }
        if (base == null && atual != null) {
          /* auditoria A6: a leitura inicial falhou mas as seguintes funcionam —
             sem baseline não há como validar; devolver ok ANTES evita os 60s
             de espera (e o falso erro que levava o usuário a reenviar = etiqueta
             duplicada). Enviada sem validação física, mesma semântica do caso
             sem odômetro. */
          return fim({ ok: true, validado: false, odometro: atual, protocolo: "tcp" });
        }
        setTimeout(function () { aguardar(base); }, 500);
      });
    });
  }

  lerOdo(function (base) {
    enviarTCP(ip, zpl, function (err) {
      if (err) return fim({ ok: false, error: err.message });
      aguardar(base);
    });
  });
}


/* ---------------- Consulta a bancos/ODBC (ponte local — Opção B) ----------------
   O navegador não fala socket de banco nem ODBC; estas rotas usam módulos
   Node (opcionais, instalados via npm) para executar a consulta e devolver
   JSON no mesmo formato {colunas, linhas} do importador. Respostas nunca
   fatais: qualquer falha vira { ok: false, error: "mensagem legível" }. */

function carregarModulo(nome) {
  try { return require(nome); } catch (e) { return null; }
}

function respostaConsulta(res, err, colunas, linhas) {
  if (err) {
    responder(res, 200, { ok: false, error: String(err && err.message ? err.message : err) });
    return;
  }
  responder(res, 200, { ok: true, colunas: colunas, linhas: linhas });
}

function consultarODBC(dados, res) {
  var odbc = carregarModulo("odbc");
  if (!odbc) { respostaConsulta(res, "Módulo 'odbc' não instalado nesta ponte. Rode no terminal: npm install odbc", null, null); return; }
  var connStr = "DSN=" + String(dados.dsn || "");
  if (dados.usuario) connStr += ";UID=" + String(dados.usuario);
  if (dados.senha) connStr += ";PWD=" + String(dados.senha);
  odbc.connect(connStr, function (err, conn) {
    if (err) { respostaConsulta(res, err, null, null); return; }
    conn.query(String(dados.sql || ""), function (err2, resultado, campos) {
      try { conn.close(); } catch (e) {}
      if (err2) { respostaConsulta(res, err2, null, null); return; }
      var colunas = (campos || []).map(function (c) { return (c && c.name) ? c.name : "Coluna"; });
      var linhas = (resultado || []).map(function (l) {
        return colunas.map(function (_, i) { return l[i] == null ? "" : String(l[i]); });
      });
      respostaConsulta(res, null, colunas, linhas);
    });
  });
}

function consultarDB(dados, res) {
  var tipo = String(dados.tipo || "").toLowerCase();
  if (tipo === "mysql") {
    var mysql = carregarModulo("mysql2");
    if (!mysql) { respostaConsulta(res, "Módulo 'mysql2' não instalado nesta ponte. Rode no terminal: npm install mysql2", null, null); return; }
    var connM = mysql.createConnection({
      host: dados.host, port: parseInt(dados.porta, 10) || 3306,
      user: dados.usuario, password: dados.senha, database: dados.banco
    });
    connM.query(String(dados.sql || ""), function (err, rows, fields) {
      try { connM.end(); } catch (e) {}
      if (err) { respostaConsulta(res, err, null, null); return; }
      var colunas = (fields || []).map(function (f) { return f.name; });
      var linhas = (rows || []).map(function (r) {
        return colunas.map(function (c) { return r[c] == null ? "" : String(r[c]); });
      });
      respostaConsulta(res, null, colunas, linhas);
    });
    return;
  }
  if (tipo === "postgres") {
    var pg = carregarModulo("pg");
    if (!pg) { respostaConsulta(res, "Módulo 'pg' não instalado nesta ponte. Rode no terminal: npm install pg", null, null); return; }
    var cliente = new pg.Client({
      host: dados.host, port: parseInt(dados.porta, 10) || 5432,
      user: dados.usuario, password: dados.senha, database: dados.banco
    });
    cliente.connect(function (err) {
      if (err) { respostaConsulta(res, err, null, null); return; }
      cliente.query(String(dados.sql || ""), function (err2, resultado) {
        try { cliente.end(); } catch (e) {}
        if (err2) { respostaConsulta(res, err2, null, null); return; }
        var rows = (resultado && resultado.rows) || [];
        var colunas = rows.length ? Object.keys(rows[0]) : [];
        var linhas = rows.map(function (r) {
          return colunas.map(function (c) { return r[c] == null ? "" : String(r[c]); });
        });
        respostaConsulta(res, null, colunas, linhas);
      });
    });
    return;
  }
  if (tipo === "sqlserver") {
    var mssql = carregarModulo("mssql");
    if (!mssql) { respostaConsulta(res, "Módulo 'mssql' não instalado nesta ponte. Rode no terminal: npm install mssql", null, null); return; }
    var cfg = {
      server: dados.host, port: parseInt(dados.porta, 10) || 1433,
      user: dados.usuario, password: dados.senha, database: dados.banco,
      options: { encrypt: false }
    };
    mssql.connect(cfg).then(function (pool) {
      return pool.request().query(String(dados.sql || ""));
    }).then(function (resultado) {
      try { mssql.close(); } catch (e) {}
      var rows = (resultado && resultado.recordset) || [];
      var colunas = rows.length ? Object.keys(rows[0]) : [];
      var linhas = rows.map(function (r) {
        return colunas.map(function (c) { return r[c] == null ? "" : String(r[c]); });
      });
      respostaConsulta(res, null, colunas, linhas);
    }).catch(function (err) {
      try { mssql.close(); } catch (e) {}
      respostaConsulta(res, err, null, null);
    });
    return;
  }
  respostaConsulta(res, "Tipo de banco não suportado nesta ponte: use mysql, postgres ou sqlserver (para Access/ODBC use a rota /query-odbc).", null, null);
}

/* ---------------- Servidor HTTP ---------------- */

function responder(res, status, obj) {
  var corpo = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(corpo);
}

/* auditoria A5/A9: leitor de corpo único com Buffer.concat — a concatenação
   por string (corpo += chunk) corrompia acentos quando um caractere UTF-8
   caía entre dois chunks; e o leitor estava copiado 3×. */
function lerCorpo(req, limite, cb) {
  var pedacos = [];
  var total = 0;
  req.on("data", function (d) {
    total += d.length;
    if (total > limite) { req.destroy(); return; }
    pedacos.push(d);
  });
  req.on("end", function () {
    cb(Buffer.concat(pedacos).toString("utf8"));
  });
}

/* ---------------- HTTPS Direct (Pedido 1.169g) ----------------
   Impressoras Link-OS 7.6+ atendem /pstprnt só em HTTPS, com certificado
   AUTOASSINADO — o navegador recusa o handshake a menos que o usuário
   aceite manualmente "Avançado → Prosseguir". A ponte envia o POST
   tolerando o certificado próprio (rejectUnauthorized:false), então o app
   usa esta rota como fallback automático do HTTPS direto: se o fetch do
   navegador falhou, o handshake caiu ANTES do POST (nada foi impresso) —
   sem risco de etiqueta duplicada. */
function enviarHTTPS(ip, zpl, cb) {
  var porta = parseInt(process.env.HTTPS_PORT, 10) || 443;
  var respondido = false;
  var req = https.request({
    host: ip,
    port: porta,
    path: "/pstprnt",
    method: "POST",
    rejectUnauthorized: false,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(zpl, "utf8")
    }
  }, function (res) {
    var pedacos = [];
    res.on("data", function (d) { pedacos.push(d); });
    res.on("end", function () {
      if (respondido) return;
      respondido = true;
      var corpo = Buffer.concat(pedacos).toString("utf8").slice(0, 300);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cb(null, { porta: porta, status: res.statusCode, corpo: corpo });
      } else {
        cb(new Error("HTTPS " + porta + ": a impressora respondeu " + res.statusCode + (corpo ? " (" + corpo.slice(0, 120) + ")" : "")));
      }
    });
  });
  req.setTimeout(parseInt(process.env.HTTPS_SEND_TIMEOUT, 10) || 15000, function () {
    req.destroy();
    if (!respondido) { respondido = true; cb(new Error("HTTPS " + porta + ": tempo esgotado enviando para " + ip + " (sem resposta).")); }
  });
  req.on("error", function (e) {
    if (!respondido) {
      respondido = true;
      cb(new Error("HTTPS " + porta + ": " + (e.code || e.message) + " — impressora sem HTTPS (firmware < 7.6?) ou porta " + porta + " fechada."));
    }
  });
  req.end(zpl);
}

/* ---------- Descoberta de impressoras na rede (análise https.txt) ----------
   O navegador não fala UDP multicast nem socket cru — quem procura é a ponte:
   1) mDNS/Bonjour pelos serviços Zebra (porta 9100 via _pdl-datastream._tcp);
   2) se nenhum responder, varredura da porta 9100 no /24 de cada interface. */

var MCAST_ENDERECO = "224.0.0.251";
var MCAST_PORTA = 5353;
var SERVICOS_MDNS = ["_pdl-datastream._tcp.local", "_printer._tcp.local"];
var MDNS_JANELA_MS = 4000;       /* janela coletando respostas mDNS */
var MDNS_REENVIO_MS = 1200;      /* 2ª rodada de consultas p/ pacote perdido */
var VARREDURA_TIMEOUT_MS = 400;  /* tempo máximo por host na varredura */
var DESCOBERTA_CACHE_MS = 30000;  /* repetição do clique não refaz a busca */

function montarConsultaMDNS(servico) {
  /* Consulta DNS padrão (RFC 1035): header + QNAME + QTYPE=PTR(12) + QCLASS=IN(1). */
  var rotulos = servico.split(".").filter(Boolean);
  var corpo = [];
  rotulos.forEach(function (r) {
    corpo.push(r.length);
    for (var i = 0; i < r.length; i++) corpo.push(r.charCodeAt(i));
  });
  corpo.push(0);
  var buf = Buffer.alloc(12 + corpo.length + 4);
  buf.writeUInt16BE(0, 0);  /* ID 0 (mDNS aceita) */
  buf.writeUInt16BE(0, 2);  /* flags: consulta */
  buf.writeUInt16BE(1, 4);  /* QDCOUNT 1 */
  buf.writeUInt16BE(0, 6);
  buf.writeUInt16BE(0, 8);
  buf.writeUInt16BE(0, 10);
  corpo.forEach(function (b, i) { buf[12 + i] = b; });
  buf.writeUInt16BE(12, 12 + corpo.length);    /* QTYPE PTR */
  buf.writeUInt16BE(1, 12 + corpo.length + 2); /* QCLASS IN */
  return buf;
}

function lerNomeMDNS(buf, off) {
  /* Lê um nome DNS seguindo ponteiros de compressão (0xC0, RFC 1035 §4.1.4).
     Retorna { nome, prox } — prox é onde o registro continua no fluxo original. */
  var rotulos = [];
  var saltos = 0;
  var pos = off;
  var fim = -1;
  while (true) {
    if (pos < 0 || pos >= buf.length) return null;
    var n = buf[pos];
    if (n === 0) { pos += 1; if (fim < 0) fim = pos; break; }
    if ((n & 0xC0) === 0xC0) {
      if (pos + 1 >= buf.length) return null;
      var alvo = ((n & 0x3F) << 8) | buf[pos + 1];
      if (fim < 0) fim = pos + 2;
      pos = alvo;
      saltos += 1;
      if (saltos > 10) return null; /* laço de ponteiro: desiste */
      continue;
    }
    if (n > 63 || pos + 1 + n > buf.length) return null;
    rotulos.push(buf.toString("utf8", pos + 1, pos + 1 + n));
    pos += 1 + n;
  }
  return { nome: rotulos.join("."), prox: fim };
}

function parseMDNSResposta(buf) {
  /* Interpreta uma resposta DNS-SD (RFC 1035 + 6763): junta SRV (porta + alvo)
     e A (IPv4) de cada instância de serviço em {nome, ip, porta}. Pula a
     seção de perguntas (respostas legadas ecoam a consulta). */
  if (!buf || buf.length < 12) return [];
  var qd = buf.readUInt16BE(4);
  var off = 12;
  var i;
  for (i = 0; i < qd; i++) {
    var q = lerNomeMDNS(buf, off);
    if (!q) return [];
    off = q.prox + 4; /* QTYPE + QCLASS */
  }
  var srvPorNome = {}; /* instância -> {alvo, porta} */
  var ipPorNome = {};  /* hostname -> IPv4 */
  var total = buf.readUInt16BE(6) + buf.readUInt16BE(8) + buf.readUInt16BE(10);
  for (i = 0; i < total; i++) {
    if (off + 10 > buf.length) break;
    var lido = lerNomeMDNS(buf, off);
    if (!lido) break;
    var dono = lido.nome.toLowerCase();
    off = lido.prox;
    var tipo = buf.readUInt16BE(off);
    var rdlen = buf.readUInt16BE(off + 8);
    var rdata = off + 10;
    if (rdata + rdlen > buf.length) break;
    if (tipo === 33 && rdlen >= 7) { /* SRV: prioridade(2) peso(2) porta(2) alvo */
      var alvoL = lerNomeMDNS(buf, rdata + 6);
      if (alvoL) srvPorNome[dono] = { alvo: alvoL.nome.toLowerCase(), porta: buf.readUInt16BE(rdata + 4), exibe: lido.nome.split(".")[0] };
    } else if (tipo === 1 && rdlen === 4) { /* A: IPv4 */
      ipPorNome[dono] = buf[rdata] + "." + buf[rdata + 1] + "." + buf[rdata + 2] + "." + buf[rdata + 3];
    }
    off = rdata + rdlen;
  }
  var achadas = {};
  var lista = [];
  Object.keys(srvPorNome).forEach(function (inst) {
    var srv = srvPorNome[inst];
    var ip = ipPorNome[srv.alvo] || ipPorNome[inst];
    if (!ip) return;
    var chave = ip + ":" + srv.porta;
    if (achadas[chave]) return;
    achadas[chave] = true;
    lista.push({ nome: srv.exibe || inst.split(".")[0], ip: ip, porta: srv.porta });
  });
  return lista;
}

function consultarMDNS(cb) {
  /* Envia as consultas por multicast da porta 224.0.0.251:5353 a partir de uma
     porta efêmera — respostas chegam unicast (RFC 6762 §5.1) e não briga com
     o serviço Bonjour que já ocupa a 5353 no Windows. */
  var achadas = {};
  var soquete = null;
  var reenvio = null;
  var cronometro = null;
  var encerrado = false;
  function encerrar() {
    if (encerrado) return;
    encerrado = true;
    if (reenvio) clearTimeout(reenvio);
    if (cronometro) clearTimeout(cronometro);
    if (soquete) { try { soquete.close(); } catch (eFe) {} }
    cb(Object.keys(achadas).map(function (k) { return achadas[k]; }));
  }
  try {
    soquete = dgram.createSocket("udp4");
    soquete.on("message", function (msg) {
      parseMDNSResposta(msg).forEach(function (imp) {
        achadas[imp.ip + ":" + imp.porta] = imp;
      });
    });
    soquete.on("error", function () { /* sem multicast (firewall?) — cai na varredura */
      encerrar();
    });
    soquete.bind(0, function () {
      try { soquete.setMulticastTTL(255); } catch (eTtl) {}
      function enviarConsultas() {
        SERVICOS_MDNS.forEach(function (s) {
          var pacote = montarConsultaMDNS(s);
          try { soquete.send(pacote, 0, pacote.length, MCAST_PORTA, MCAST_ENDERECO); } catch (eS) {}
        });
      }
      enviarConsultas();
      reenvio = setTimeout(enviarConsultas, MDNS_REENVIO_MS);
      cronometro = setTimeout(encerrar, MDNS_JANELA_MS);
    });
  } catch (e) {
    encerrar();
  }
}

function subredesLocais() {
  /* Prefixos /24 das interfaces IPv4 não-internas desta máquina. */
  var saida = [];
  var vistos = {};
  var ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(function (nomeIf) {
    (ifaces[nomeIf] || []).forEach(function (inf) {
      if (inf.family !== "IPv4" || inf.internal) return;
      var pref = inf.address.split(".").slice(0, 3).join(".");
      if (pref && !vistos[pref]) { vistos[pref] = true; saida.push(pref); }
    });
  });
  return saida;
}

function varrerPorta(porta, cb) {
  /* Varre a porta nas sub-redes locais (reserva quando o mDNS não acha). */
  var candidatos = [];
  subredesLocais().forEach(function (pref) {
    for (var f = 1; f <= 254; f++) candidatos.push(pref + "." + f);
  });
  var achados = [];
  var pendentes = candidatos.length;
  if (!pendentes) { cb(achados); return; }
  candidatos.forEach(function (ipC) {
    var s = new net.Socket();
    var fechou = false;
    function fim(abriu) {
      if (fechou) return;
      fechou = true;
      s.destroy();
      if (abriu) achados.push(ipC);
      pendentes -= 1;
      if (pendentes === 0) cb(achados);
    }
    s.setTimeout(VARREDURA_TIMEOUT_MS, function () { fim(false); });
    s.once("connect", function () { fim(true); });
    s.once("error", function () { fim(false); });
    s.connect(porta, ipC);
  });
}

var descobertaCache = { quando: 0, resposta: null };

function descobrirImpressoras(cb) {
  /* Orquestra: mDNS primeiro (nomes de verdade); se nada, varre a 9100.
     Cache curto para o clique repetido não refazer a varredura. */
  if (descobertaCache.resposta && Date.now() - descobertaCache.quando < DESCOBERTA_CACHE_MS) {
    cb(null, descobertaCache.resposta.impressoras, descobertaCache.resposta.metodo + " (cache)");
    return;
  }
  consultarMDNS(function (viaMdns) {
    if (viaMdns.length) {
      descobertaCache = { quando: Date.now(), resposta: { impressoras: viaMdns, metodo: "mdns" } };
      cb(null, viaMdns, "mdns");
      return;
    }
    varrerPorta(9100, function (ipsVarredura) {
      var achadas = ipsVarredura.map(function (ipV) {
        return { nome: "Impressora (porta 9100)", ip: ipV, porta: 9100 };
      });
      descobertaCache = { quando: Date.now(), resposta: { impressoras: achadas, metodo: "varredura" } };
      cb(null, achadas, "varredura");
    });
  });
}

var servidor = http.createServer(function (req, res) {
  /* auditoria A1: o header CORS só sai para origens legítimas — origem de
     site aleatório não recebe ACAO e o preflight do navegador bloqueia a
     requisição antes de chegar aqui de fato */
  if (origemPermitida(req.headers.origin)) {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  }

  if (req.method === "OPTIONS") { /* 204 não tem corpo (auditoria A4) */
    /* Private Network Access: o site publicado (GitHub Pages) é "public" e o
       Chrome exige este header no preflight para liberar fetch → localhost */
    res.writeHead(204, {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Private-Network": "true"
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/") {
    responder(res, 200, { ok: true, servico: "print-server Zebra (FTP porta 21, TCP porta 9100, consultas /query-odbc e /query-db)" });
    return;
  }

  /* Descoberta de impressoras na rede (análise https.txt): mDNS + varredura */
  if (req.method === "GET" && req.url === "/descobrir") {
    descobrirImpressoras(function (errD, achadas, metodoD) {
      if (errD) responder(res, 200, { ok: false, error: errD.message });
      else responder(res, 200, { ok: true, metodo: metodoD, impressoras: achadas });
    });
    return;
  }

  /* Rotas da ponte de dados: o navegador manda os parâmetros, esta ponte
     executa a consulta (ODBC/banco tradicional) e devolve {colunas, linhas}. */
  if (req.method === "POST" && (req.url === "/query-odbc" || req.url === "/query-db")) {
    lerCorpo(req, 4e6, function (corpoQ) {
      var dadosQ;
      try { dadosQ = JSON.parse(corpoQ || "{}"); }
      catch (e) { responder(res, 400, { ok: false, error: "JSON inválido" }); return; }
      if (!String(dadosQ.sql || "").trim()) { responder(res, 400, { ok: false, error: "SQL vazio — envie uma consulta SELECT" }); return; }
      if (req.url === "/query-odbc") {
        if (!String(dadosQ.dsn || "").trim()) { responder(res, 400, { ok: false, error: "DSN ausente" }); return; }
        consultarODBC(dadosQ, res);
      } else {
        if (!String(dadosQ.host || "").trim()) { responder(res, 400, { ok: false, error: "Host do banco ausente" }); return; }
        consultarDB(dadosQ, res);
      }
    });
    return;
  }

  /* Pedido 1.130: uma etiqueta por vez com validação do odômetro. */
  if (req.method === "POST" && req.url === "/print-one") {
    lerCorpo(req, 1e6, function (corpoP1) {
      var dadosP1;
      try { dadosP1 = JSON.parse(corpoP1 || "{}"); }
      catch (e) { responder(res, 400, { ok: false, error: "JSON inválido" }); return; }
      var ipP1 = String(dadosP1.ip || "").trim();
      var zplP1 = String(dadosP1.zpl || "").trim();
      var protoP1 = String(dadosP1.protocol || "tcp").toLowerCase();
      var esperadoP1 = Math.max(1, parseInt(dadosP1.esperado, 10) || 1);
      var ipValidoP1 = /^(\d{1,3}\.){3}\d{1,3}$/.test(ipP1) || /^[\w.-]+$/.test(ipP1);
      if (!ipP1 || !ipValidoP1) { responder(res, 400, { ok: false, error: "IP da impressora inválido ou ausente" }); return; }
      if (!zplP1) { responder(res, 400, { ok: false, error: "ZPL vazio" }); return; }
      imprimirUmValidado(ipP1, zplP1, esperadoP1, protoP1, function (j) {
        responder(res, 200, j);
      });
    });
    return;
  }

  /* Pedido 1.169g: HTTPS Direct com certificado próprio da impressora —
     fallback automático do HTTPS direto do navegador. */
  if (req.method === "POST" && req.url === "/print-https") {
    lerCorpo(req, 1e6, function (corpoH) {
      var dadosH;
      try { dadosH = JSON.parse(corpoH || "{}"); }
      catch (e) { responder(res, 400, { ok: false, error: "JSON inválido" }); return; }
      var ipH = String(dadosH.ip || "").trim();
      var zplH = String(dadosH.zpl || "").trim();
      var ipValidoH = /^(\d{1,3}\.){3}\d{1,3}$/.test(ipH) || /^[\w.-]+$/.test(ipH);
      if (!ipH || !ipValidoH) { responder(res, 400, { ok: false, error: "IP da impressora inválido ou ausente" }); return; }
      if (!zplH) { responder(res, 400, { ok: false, error: "ZPL vazio" }); return; }
      enviarHTTPS(ipH, zplH, function (err, info) {
        if (err) responder(res, 200, { ok: false, error: err.message });
        else responder(res, 200, { ok: true, protocolo: "https", porta: info.porta, status: info.status, corpo: info.corpo });
      });
    });
    return;
  }

  if (req.method !== "POST" || req.url !== "/print") {
    responder(res, 404, { ok: false, error: "Use POST /print ou /print-one com {ip, zpl, protocol} ou POST /query-odbc|/query-db com {sql}" });
    return;
  }

  lerCorpo(req, 1e6, function (corpo) {
    var dados;
    try { dados = JSON.parse(corpo || "{}"); }
    catch (e) { responder(res, 400, { ok: false, error: "JSON inválido" }); return; }

    var ip = String(dados.ip || "").trim();
    var zpl = String(dados.zpl || "").trim();
    var proto = String(dados.protocol || "ftp").toLowerCase();

    var ipValido = /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[\w.-]+$/.test(ip);
    if (!ip || !ipValido) { responder(res, 400, { ok: false, error: "IP da impressora inválido ou ausente" }); return; }
    if (!zpl) { responder(res, 400, { ok: false, error: "ZPL vazio" }); return; }

    if (proto === "tcp") {
      enviarTCP(ip, zpl, function (err, info) {
        if (err) responder(res, 200, { ok: false, error: err.message });
        else responder(res, 200, { ok: true, porta: info.porta, protocolo: "tcp" });
      });
    } else {
      enviarFTP(ip, zpl, function (err, info) {
        if (err) responder(res, 200, { ok: false, error: err.message });
        else responder(res, 200, { ok: true, porta: info.porta, protocolo: "ftp" });
      });
    }
  });
});

/* Exportado p/ o teste do parser (chk-mdns): rodar como módulo não sobe o
   servidor — só `node print-server.js` escuta. */
module.exports = {
  montarConsultaMDNS: montarConsultaMDNS,
  parseMDNSResposta: parseMDNSResposta,
  subredesLocais: subredesLocais
};

if (require.main === module) {
  servidor.on("error", function (e) {
    /* auditoria A3: sem isto, EADDRINUSE derrubava o Node com stack ilegível */
    if (e.code === "EADDRINUSE") {
      console.error("ERRO: a porta " + PORTA + " ja esta em uso — provavelmente ja existe outro print-server rodando.");
      console.error("       Feche a outra instancia (ou mude a porta com PORTA=xxxx) e tente de novo.");
      process.exit(1);
    }
    console.error("ERRO no servidor HTTP: " + e.message);
    process.exit(1);
  });
  servidor.listen(PORTA, "127.0.0.1", function () {
    console.log("print-server Zebra escutando em http://localhost:" + PORTA);
    console.log("Suporta impressao via FTP (porta " + FTP_PORTA + "), TCP (porta 9100), HTTPS Direct com certificado proprio (POST /print-https, 1.169g), validacao por odometro (POST /print-one)");
    console.log("e ponte de dados (POST /query-odbc, /query-db). Descoberta de impressoras: GET /descobrir (mDNS + varredura).");
    console.log("A impressao HTTP(S) Direct e feita pelo proprio navegador. Pedido 1.130: uma etiqueta por vez, validada pelo odometro (TCP).");
  });
}
