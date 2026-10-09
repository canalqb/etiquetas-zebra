# Task checklist — migração da lógica do `code.gs` (import 1 coluna + modal do scanner)

Data: 09/10/2026 · Projeto: **SerieScan** · Status: ✅ concluído (rodada 1) · ✅ concluído (rodada 2) · ✅ concluído (rodada 3)

## Rodada 3 — ribbon de ícones, XX no modal, layout compacto/iframe (pedido em 09/10/2026)

- ✅ R3.1 Decisão do usuário: visual estilo Bootstrap 5 com **SVG próprio inline** (sem CDN, mantém offline e leve no iframe)
- ✅ R3.2 Modal "delicado": header com título + **botão XX** (`#btn-fechar-modal`), bordas arredondadas, sombra suave
- ✅ R3.3 **Ribbon** de ações: 6 botões só de ícone (nova leitura, pasta/txt, desfazer, limpar, exportar CSV, trocar lista) + tema no header — sem texto, com **legenda (`data-dica`) no hover/foco** e `aria-label`
- ✅ R3.4 "Limpar leituras" em modo armado: só troca legenda/ícone (`ativo`), sem texto no botão
- ✅ R3.5 Página compacta: header/main/footer na **mesma coluna de 640px** (`.faixa`), espaçamentos reduzidos, preview com altura limitada — cabe sem rolar em telas comuns e em iframe
- ✅ R3.6 Responsivo/autoajuste: `clamp()` no fonte do campo/resultado, `min(94vw, 452px)` no dialog, `max-height: 92vh` com scroll interno, media query 640px
- ✅ R3.7 E2E **41 PASS / 0 FAIL, zero erros JS**; CSS 79 seletores, 0 duplicados; sem `alert`; documentação atualizada

## Rodada 2 — txt automático das localizadas + exportação CSV (pedido em 09/10/2026)

- ✅ R2.1 Plano + decisões do usuário (pasta escolhida 1x via File System Access API; modal mantém abertura automática)
- ✅ R2.2 `storage.js`: mini KV em IndexedDB (`ccsv_meta`) só para guardar o handle da pasta
- ✅ R2.3 `app.js`: a cada série **encontrada**, regrava `series_localizadas.txt` na pasta escolhida (permissão readwrite)
- ✅ R2.4 `index.html`: botão "Escolher pasta (txt automatico)" + `#info-pasta`; exportação agora é "Exportar localizadas (CSV)" (só as encontradas, 1 coluna, `seriescan_localizadas_AAAAMMDD_HHMMSS.csv`)
- ✅ R2.5 Sincronia do txt: desfazer / limpar leituras / trocar lista / limpar tudo também regravam o arquivo
- ✅ R2.6 Teste E2E **39 PASS / 0 FAIL, zero erros JS**; CSS 73 seletores, 0 duplicados; sem `alert`; documentação atualizada

## Rodada 1 (concluída)

- ✅ 1–13. Migração do `code.gs`: CSV 1 coluna, localStorage+cookie, modal, regra dos 1s, sons, extras, 37 PASS/0 FAIL


## A. Plano
- ✅ 1. Leitura do `code.gs` e mapeamento da lógica (carregarSeries, normalizar, sons, resultado azul/vermelho, select no campo)
- ✅ 2. Atualização do `implementation_plan.md` (seção 5 + identidade "SerieScan")
- ✅ 3. Confirmação do checklist pelo usuário (extras mantidos; CSV sem cabeçalho)

## B. Implementação
- ✅ 4. `storage.js`: lista no `localStorage` com fallback automático para cookie dividido (40 partes x 3,5 KB)
- ✅ 5. Parser de CSV de **1 coluna** (uma série por linha, ignora vazias, normaliza; sem pular cabeçalho)
- ✅ 6. `index.html`: tela de importação + `<dialog>` do scanner (mesmo template: temas, ARIA, toasts)
- ✅ 7. Modal: campo de leitura, resultado azul/vermelho, "N séries carregadas", botões "Nova leitura" e "Trocar lista"
- ✅ 8. Regra dos **1 segundo**: após cada leitura, espera 1000 ms e faz `focus()` + `select()`
- ✅ 9. Sons do Sheets: bipOk (encontrado) e bipErro (não encontrado) via Web Audio
- ✅ 10. Abertura automática do modal quando já existe lista salva
- ✅ 10b. Extras mantidos (histórico, contadores, desfazer, limpar, exportar) em `<details>` no modal

## C. Validação e entrega
- ✅ 11. Teste funcional (Edge headless + CDP): **37 PASS / 0 FAIL, zero erros JS**
- ✅ 12. Rechecagem final: CSS 73 seletores, 0 duplicados; sem `alert`/`prompt`; `confirm` só 2× na importação
- ✅ 13. `implementation_plan.md` e esta documentação atualizados
