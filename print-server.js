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
 * Uso: node print-server.js   (escuta na porta 3001)
 */
"use strict";

var http = require("http");
var net = require("net");

var PORTA = 3001;            // porta do servidor HTTP local
var FTP_PORTA = parseInt(process.env.FTP_PORT, 10) || 21; // porta FTP da Zebra (padrão 21)
var TIMEOUT_FTP = 12000; // ms por etapa do diálogo FTP

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
  var socket = net.connect(porta, ip, function () {
    socket.write(Buffer.from(zpl, "utf8"), function () {
      socket.end();
      cb(null, { porta: porta });
    });
  });
  socket.setTimeout(8000, function () {
    socket.destroy();
    cb(new Error("TCP 9100: timeout conectando a " + ip + ":" + porta));
  });
  socket.on("error", function (e) {
    cb(new Error("TCP 9100: erro no socket com " + ip + ":" + porta + " (" + e.code + ")."));
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
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(corpo);
}

var servidor = http.createServer(function (req, res) {
  if (req.method === "OPTIONS") { responder(res, 204, {}); return; }

  if (req.method === "GET" && req.url === "/") {
    responder(res, 200, { ok: true, servico: "print-server Zebra (FTP porta 21, TCP porta 9100, consultas /query-odbc e /query-db)" });
    return;
  }

  /* Rotas da ponte de dados: o navegador manda os parâmetros, esta ponte
     executa a consulta (ODBC/banco tradicional) e devolve {colunas, linhas}. */
  if (req.method === "POST" && (req.url === "/query-odbc" || req.url === "/query-db")) {
    var corpoQ = "";
    req.on("data", function (d) {
      corpoQ += d;
      if (corpoQ.length > 4e6) req.destroy();
    });
    req.on("end", function () {
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

  if (req.method !== "POST" || req.url !== "/print") {
    responder(res, 404, { ok: false, error: "Use POST /print com {ip, zpl, protocol} ou POST /query-odbc|/query-db com {sql}" });
    return;
  }

  var corpo = "";
  req.on("data", function (d) {
    corpo += d;
    if (corpo.length > 1e6) req.destroy();
  });
  req.on("end", function () {
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

servidor.listen(PORTA, "127.0.0.1", function () {
  console.log("print-server Zebra escutando em http://localhost:" + PORTA);
  console.log("Suporta impressão via HTTP Direct (POST /pstprnt), FTP (Porta 21) e TCP (Porta 9100).");
});
