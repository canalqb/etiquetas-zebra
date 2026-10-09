# Plano de implementação: template de página universal (HTML + JS)

Data: 09/10/2026 · Base: `master_rules.md` (v8.2, Drive `regras_llms`)
Stack do projeto: **apenas HTML + JavaScript** — proibido PHP, Node e qualquer backend/build.

---

## 0. Identidade do projeto (definida em 09/10/2026)

| Campo | Valor |
| --- | --- |
| Nome do projeto | **SerieScan** |
| Title da página | `SerieScan - Importador de CSV e scanner de series` |
| Marca no cabeçalho | `SERIESCAN` + descritor "scanner e validacao de series via CSV" |
| Pasta/local | `C:\xampp\htdocs\ccsv\` (`http://localhost/ccsv/`) — pasta mantida, só o nome visível muda |

---

## 1. Regras absorvidas do master_rules.md (e o que ficou de fora)

### Aplicadas ao template
| Regra | Como entra no template |
| --- | --- |
| 1. Ciclo de leitura + plano | Este plano e o `task.md` antes de codar; rechecagem final na entrega |
| 2. Nomenclatura + PT-BR | Arquivo `estrutura_html_pagina_universal.html` (prefixo auto-explicativo); explicações em `leitura obrigatória/EXPLICA_*.md`; comunicação em PT-BR |
| 9.1 Sem `alert()` | Sistema `showToast()` embutido (JS puro) para todos os avisos |
| 9.2 Semântica W3C | `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>` — apenas 1 `<html>/<head>/<body>` |
| 9.3 Acessibilidade | Landmarks ARIA, skip-link, `aria-live` nos toasts, foco visível, contraste WCAG AA |
| 9.9 Temas claro/escuro | Variáveis CSS nos dois temas, toggle dinâmico, persistência em `localStorage`, contraste AA nos dois |
| 9.6 Arquivos de teste | Artefatos de teste/teste vão para `solucoes/` (ou são apagados, com sua aprovação) |
| 17. Explicações | Entrega documentada em `leitura obrigatória/EXPLICA_template_pagina_universal.md` — nada na raiz |
| 18. CSS sem duplicatas | Validação de seletores duplicados antes de entregar (só exceções: tema, media query, pseudo-classe) |
| 19. Agnosticismo | Template com placeholders `{...}`, reutilizável em qualquer tela futura do projeto |
| 14/16. Métricas | Relatório de qualidade ao final (métricas web aplicáveis; ver N/A abaixo) |
| 22. Windows/XAMPP | Comandos só em PowerShell; nada de sintaxe Linux |
| 23. AEO | Bloco opcional de meta/JSON-LD preparado para Answer Engines (comentado por padrão) |

### Não aplicáveis a este projeto (registrados como N/A)
- **PHP em todas as formas** (seções 6, 7, 8, 9.4, 9.5, 9.7 CSRF de servidor, 9.11 `ob_start`, templates `estrutura_php_*`) — **proibido pelo usuário**.
- **Node/build** — proibido pelo usuário.
- **Regras 15/20** (páginas legais AdSense 2026, compliance jurídico) — ferramenta interna em `localhost`, sem anúncios.
- **Regra 21** (automação industrial/OAuth) — sem API/cotas no projeto.
- **Regra 11** (Pizzaria) — outro projeto.
- **Regra 10** (6 passos no `readme.html` de `regras/`) — este projeto não possui `regras/readme.html`; fica registrado, se quiser eu crio um `readme.html` local seguindo os 6 passos.

---

## 2. Artefatos a criar

1. **`estrutura_html_pagina_universal.html`** — página-base autocontida (CSS + JS inline, sem dependências):
   - Estrutura semântica + skip-link + landmarks ARIA.
   - Bloco `<style>` com variáveis CSS: tema claro/escuro + toggle (`data-theme`) persistido em `localStorage`.
   - JS embutido (vanilla): `showToast()` (substitui `alert`), alternância de tema, persistência.
   - Placeholders `{...}` para personalização (título, conteúdo, seções).
   - Meta tags + bloco JSON-LD (AEO) opcional comentado.
   - Funciona em `http://localhost/ccsv/` sem servidor de aplicação.

2. **`task.md`** — checklist de execução com status.

3. **`leitura obrigatória/EXPLICA_template_pagina_universal.md`** — o que foi pedido, o que foi criado, como usar (conteúdo obrigatório da regra 17).

4. **Relatório de métricas** (dentro da EXPLICA, seção final) — validação checklist: semântica, ARIA/contraste, sem `alert`, CSS sem duplicatas, meta/SEO, mobile-first. Métricas backend/AdSense marcadas N/A.

---

## 3. Fora do escopo desta tarefa

- Reescrever o `index.html` atual (importador/scanner) sobre o template — decisão futura.
- Qualquer PHP, Node, banco de dados, CSRF de servidor.
- Páginas legais/compliance AdSense.

---

## 4. Riscos e cuidados

- **CSS duplicado**: o template nasce com seletores únicos; validação final com busca antes de entregar.
- **Foco**: o toggle de tema e os toasts não podem roubar foco do campo de leitura (regra do scanner em `abc.md`).
- **Arquivos de teste da sessão anterior**: `selftest.*`, `_out.html`, `_err.txt`, `_warm*`, `_t1*`, `_t2*`, `_edgetemp*` estão na raiz — proponho **apagar** (lixo de teste) ou mover para `solucoes/`. Aguardo sua palavra no `task.md`.

---

## 5. Migração da lógica do `code.gs` (nova proposta — 09/10/2026)

O usuário pediu para migrar a lógica da planilha Google (`code.gs` + HTML do "Scanner") para o
projeto local. O que muda em relação ao app atual:

### Fluxo novo
1. **Tela inicial — Importar**: seletor de arquivo CSV de **1 coluna** (uma série por linha).
   - Linhas vazias são ignoradas; valores são normalizados (remove espaços/invisíveis, maiúsculas).
2. **Persistência**: lista fica no `localStorage` enquanto a página estiver ativa e é salva lá;
   se o `localStorage` estiver indisponível (modo privado), usa **cookie** como alternativa.
   - Ao abrir a página: se já existe lista salva, o scanner abre direto (sem importar de novo).
3. **Modal do scanner** (`<dialog>`): abre **depois** que a lista é carregada/importada.
   - Campo grande de leitura (scanner ou digitação).
   - Resultado: fundo **azul** "APARELHO ENCONTRADO" / **vermelho** "APARELHO NÃO ENCONTRADO"
     + a série lida, com `aria-live`.
   - Sons: bip duplo agradável ao encontrar, dois bips graves ao errar (Web Audio, igual ao Sheets).
   - Info: "N séries carregadas".
   - Botões: "Nova leitura" (foca o campo) e "Trocar lista" (volta para a importação).
4. **Regra dos 1 segundo** (diferente do `abc.md`, decisão do usuário): após cada leitura,
   espera **1000 ms** e então faz `focus()` + `select()` no campo — o texto anterior fica
   selecionado e é sobrescrito automaticamente pela próxima leitura/digitação.

### O que sai do fluxo principal
- A aba "Escanear" com histórico/contadores/desfazer/exportação (lógica antiga) — **sob decisão do usuário** (pergunta abaixo).
- IndexedDB (`storage.js` passa a usar só `localStorage` + cookie).

### Rodada 2 (09/10/2026, pedido do usuário)
- **TXT automático das localizadas**: usuário escolhe a pasta **uma vez** (File System Access
  API, `showDirectoryPicker`); a cada série encontrada o arquivo `series_localizadas.txt`
  é regravado nela (permissão readwrite; handle guardado em IndexedDB mínimo).
- **Exportar localizadas (CSV)**: botão gera um CSV novo de **1 coluna** só com as séries
  encontradas (arquivo `seriescan_localizadas_AAAA-MM-DD_HHMMSS.csv`).
- Modal mantém a **abertura automática** (ao importar e ao carregar com lista salva).

### Arquivos a mexer
- `index.html`: reescrever para o fluxo import → modal, mantendo o template (temas, ARIA, toasts).
- `app.js`: nova lógica (parser 1 coluna, persistência, modal, regra dos 1s, sons do Sheets).
- `storage.js`: camada única `localStorage` com fallback de cookie.
- `code.gs`: fica como referência (não roda no navegador).
