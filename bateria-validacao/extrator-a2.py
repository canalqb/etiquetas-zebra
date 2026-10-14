# -*- coding: utf-8 -*-
"""Extrator da bateria de validacao fisica (Pedido 1.225, pendencia A2).

Le o DOM gerado pelo probe tA2 (probe-tA2-tmp.html executado no Chrome
headless com --dump-dom) e grava cada caso num arquivo .zpl dentro de
bateria-validacao/zpl/, alem do manifest.csv com os resultados esperados.

Como regenerar o dump (a partir da raiz do projeto) — redirecione com
cmd /c (o pipeline do PowerShell 5.1 decodifica a saida do Chrome como
cp850 e corrompe os acentos do C03/C04):
  cmd /c ""C:\Program Files\Google\Chrome\Application\chrome.exe" ^
     --headless=new --disable-gpu --no-first-run ^
     --virtual-time-budget=35000 --dump-dom ^
     "file:///C:/xampp/htdocs/zebra/probe-tA2-tmp.html" > a2-dom-raw.html 2>NUL"
  python bateria-validacao/extrator-a2.py a2-dom-raw.html

O resumo geral do probe aparece no div #a2-geral ("PRONTO casos=N ok=N chk=N").
"""
import csv
import html
import os
import re
import sys

DUMP = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\Qb\AppData\Local\Temp\opencode\a2-dom-raw.html"
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, "bateria-validacao", "zpl")

with open(DUMP, encoding="utf-8-sig") as f:
    dom = f.read()

geral = re.search(r'<div id="a2-geral">([^<]*)</div>', dom)
if geral:
    print("Probe:", geral.group(1))

divs = re.findall(r'<div class="b2zpl"([^>]*)>(.*?)</div>', dom, re.S)
if not divs:
    sys.exit("Nenhum caso .b2zpl encontrado no dump")

os.makedirs(SAIDA, exist_ok=True)
linhas = []
for attrs, zpl in divs:
    def attr(nome, a=attrs):
        m = re.search(r'data-%s="([^"]*)"' % nome, a)
        return html.unescape(m.group(1)) if m else ""
    cid, slug = attr("id"), attr("slug")
    desc, ok, chk = attr("desc"), attr("ok"), attr("chk")
    arquivo = slug + ".zpl"
    with open(os.path.join(SAIDA, arquivo), "w", encoding="utf-8", newline="") as f:
        f.write(html.unescape(zpl))
    linhas.append({
        "id": cid, "slug": slug, "descricao": desc, "ok": ok, "chk": chk,
        "arquivo": arquivo, "bytes": os.path.getsize(os.path.join(SAIDA, arquivo)),
    })

manifest = os.path.join(RAIZ, "bateria-validacao", "manifest.csv")
with open(manifest, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=["id", "slug", "descricao", "ok", "chk", "arquivo", "bytes"])
    w.writeheader()
    w.writerows(linhas)

print("casos=%d ok=%d chk=%d -> %s" % (
    len(linhas), sum(l["ok"] == "1" for l in linhas), sum(l["chk"] == "1" for l in linhas), SAIDA))
for l in linhas:
    print("%-4s %-42s ok=%s chk=%s %6d bytes" % (l["id"], l["arquivo"], l["ok"], l["chk"], l["bytes"]))
