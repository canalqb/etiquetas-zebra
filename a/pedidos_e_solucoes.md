# Pedidos e Soluções — Registro Consolidado

## 📊 Progresso Geral: 100% (37 de 37 pedidos concluídos)

| Categoria | Concluídos | Total | Progresso |
|---|---|---|---|
| 1. Zebra ZPL | 23 | 23 | ███████████████████ 100% |
| 2. Regras/Estrutura | 11 | 11 | ███████████████████ 100% |
| 3. Upgrades de Regras | 3 | 3 | ███████████████████ 100% |
| **TOTAL** | **37** | **37** | **██████████████████ 100%** |

### Execução do plano `sugestao.txt` (itens 3 → 2 → 1)

| Etapa | Escopo | Status |
|---|---|---|
| Fase 0 | Fidelidade de rotação editor↔preview↔impressão (bugs reportados durante a execução) | ███████████████████ 100% |
| **Item 3** | Ribbons Modelos, cópias `^PQ`, barra de status, "Gerar Todas as Linhas", `aria-pressed`, indicador do servidor, edição in-loco por duplo clique | ███████████████████ **100%** |
| Item 2 | Ícones maiores, Ajuda atualizada (ícones/elementos da página), forma livre, cache 72h + botão "Novo", card-header → ribbon | █████░░░░░░░░░░░░░░░ 30% (entregue: regra ON=colorido/OFF=preto e branco + ícones inexistentes corrigidos + Espelho funcional com WYSIWYG) |
| Item 1 | Revisão final do importador (documentação na Ajuda + revisão geral) | ██████████░░░░░░░░░░ 55% (entregue: validação de duplicatas, "Gerar Todas as Linhas", Google Sheets via link) |

**Pendências abertas (Item 2 + revisão do Item 1):** documentação completa dos ícones e elementos da página na Ajuda (pedido do usuário), ícones maiores na paleta, forma livre (pontos/linhas/curvas), cache de sessão 72h + botão "Novo", conversão do card-header em ribbon.

> Arquivo central com **todos os pedidos do usuário** e a **solução aplicada** em cada um.
> Fontes: `regras/log_solucoes.md`, `leitura obrigatória/EXPLICA_*.md`, `regras/implementation_plan_*.md`, `regras/task_*.md`, `sugestao.txt`.
> **Este arquivo deve ser atualizado sempre que um novo pedido for resolvido.**

---

## 1. Pedidos do projeto Zebra (Designer ZPL)

### Pedido 1.1 — Corrigir elemento girado que não alcança a borda direita
- **Pedido**: Ao girar um elemento (90°/180°/270°), ele não podia ser arrastado até a borda direita/inferior da etiqueta.
- **Solução**: Os clamps de limites usavam dimensões não-rotacionadas, mas a partir de 90°/270° o footprint visual inverte largura↔altura. Corrigido em 3 pontos do `index.html`:
  1. `restringirLimitesElemento()` — troca `elW`↔`elH` em 90°/270° ao calcular `maxX`/`maxY` (~linha 2121).
  2. Clamp do arraste (`onMouseMove`) — usa `visW`/`visH` invertidos para `maxBoundX`/`maxBoundY` (~linha 2610).
  3. Clamp do redimensionamento (Ctrl+arraste) — em 90°/270°, `newW` limita por `maxY - y` e `newH` por `maxX - x` (QR Code dispensa o swap).
- **Impacto**: sem alteração na geração de ZPL nem nos formatos salvos.
- **Detalhes**: `leitura obrigatória/EXPLICA_correcao_elemento_girado_limites.md`

### Pedido 1.2 — Melhoria visual do index.html
- **Pedido**: Aplicar todas as regras universais (master_rules + Prompt Mestre v9.0) para melhorar a visualização do `index.html` (gatilho `{Melhore o layout}` — somente CSS/HTML).
- **Solução** (bloco "MELHORIA VISUAL v1" no final do `<style>` do `index.html`):
  - CSS sem duplicatas: `.ruler-corner` consolidado em 1 bloco (Regra 18).
  - Acessibilidade WCAG 2.1 AA: `:focus-visible` global, `prefers-reduced-motion`, skip-link "Ir para o editor", `aria-label` nos 9 botões icônicos da paleta.
  - UX: transição suave de 0.25s na troca de tema, hover elevado em badges e cards.
  - Mobile-First: `@media (pointer: coarse)` amplia `icon-btn` para 44px; zero scroll horizontal.
  - Performance: `content-visibility: auto` nos modais (INP < 200ms).
- **Validação**: nenhuma lógica JS alterada; IDs/classes funcionais preservados.
- **Detalhes**: `leitura obrigatória/EXPLICA_melhoria_visual_index.md`, `regras/implementation_plan_melhoria_visual_index.md`, `regras/task_melhoria_visual_index.md` (checklist 100% concluído)

### Pedido 1.3 — Mover Salvar/Exportar e Geração em Lote para modais na ribbon
- **Pedido**: Criar 2 botões na ribbon que abrem, em modal, "Salvar/Exportar (.BIN)" e "Geração em Lote", removendo esses itens do painel esquerdo para aumentar a área de criação da etiqueta.
- **Solução** (`index.html`):
  - Botões `#btn-modal-templates` (disquete laranja) e `#btn-modal-batch` (sitemap azul) após o botão Calibrar (~linha 875).
  - Modais `#modal-templates` (~linha 1352) e `#modal-batch` (~linha 1421) com **todos os IDs preservados** — nenhum listener JS alterado.
  - Painel esquerdo `#accordionControls` removido; coluna do editor ampliada para `col-12`.
  - Código morto limpo: hamburger mobile, offcanvas, script "Mobile Panel Mirror", CSS `#leftAccordion`.
- **Validação**: IDs sem duplicatas; zero referências remanescentes ao painel antigo; HTML íntegro.
- **Detalhes**: `leitura obrigatória/EXPLICA_modais_ribbon_exportar_lote.md`

### Pedido 1.4 — Importador genérico de fontes de dados (Excel, Access, CSV/TXT, ODBC) — **CONCLUÍDO**
- **Pedido** (`sugestao.txt`): Criar um modo de importar dados de fontes externas (Excel `.xlsx`, Access `.accdb`, texto delimitado `.txt`/CSV, ODBC). Ao importar, o sistema deve criar um modal com um campo de elemento para **cada coluna da origem**, permitindo ao usuário mapear qual campo do sistema representa cada coluna.
- **Solução** (`index.html` + `api/importar_dados.php`):
  - Botão `#btn-import-dados` (fa-file-import) no ribbon **Elementos** abre o modal `#modal-import-dados`.
  - **CSV/TXT**: leitura client-side com auto-detecção de delimitador (`;`/`,`/tab), UTF-8, primeira linha = cabeçalho. **Excel**: via SheetJS 0.18.5 (CDN), primeira aba. **Access/ODBC**: endpoint PHP `api/importar_dados.php` com resposta JSON graciosa (nunca fatal) quando o driver não está habilitado.
  - Etapa 2 do modal: uma linha por coluna da origem com `<select>` ("Ignorar", Texto, Subtítulo, Nome do Produto, QR Code, Código de Barras) + preview das 3 primeiras linhas.
  - **Aplicar na Etiqueta** cria elementos via `adicionarElemento()` (mesmo caminho da paleta) com os valores da 1ª linha; **Salvar Mapeamento** persiste em `localStorage` (`etiquetasZebra.importMap`) e auto-seleciona ao reimportar colunas de mesmo nome.
- **Validação**: IDs únicos (13 novos), divs balanceados, sem `alert()`/`confirm()` nativos, JS validado por parser, `php -l` limpo, endpoint retornando 200 no XAMPP.
- **Limitações**: Access/ODBC lista tabelas quando há driver, sem fluxo de leitura por tabela ainda. ~~Apenas a 1ª linha gera elementos~~ **RESOLVIDO no Pedido 1.18** ("Gerar Todas as Linhas").
- **Detalhes**: `leitura obrigatória/EXPLICA_importador_dados.md`

### Pedido 1.5 — Melhoria Visual v2 do index.html (regras universais v9.0)
- **Pedido**: Absorver todas as regras universais (master_rules.md + Prompt Mestre v9.0 do Google Docs) e aplicar todos os recursos ao `index.html` para melhorar a visualização.
- **Solução**:
  - Nova regra salva no projeto: `regras/prompt_de_llms/regra_llms_prompt_mestre_v9.md` (+ readme.html v7.4, conforme Regra 10).
  - CSS Signature `/* @CanalQb - Exclusive Design License 2026 */` na 1ª linha do `<style>`.
  - Modal de confirmação universal `#modal-confirm` + helper `confirmar()` substituindo os 2 `confirm()` nativos (Regra 9 — sem alertas nativos).
  - Unicode decorativo (`→`) da Ajuda substituído por Font Awesome (Seção 25).
  - Listener de `scroll` com `{passive: true}` (INP — Seção 15).
- **Validação**: 0 `confirm()` nativo; estrutura HTML íntegra; nenhum ID funcional alterado.
- **Detalhes**: `leitura obrigatória/EXPLICA_melhoria_visual_v2_index.md`

### Pedido 1.6 — Ribbons separados com toggle e tom próprio
- **Pedido**: Separar os ribbons da paleta; o primeiro ícone de cada ribbon exibe/oculta seus ícones; cada ribbon com uma cor sutil de identificação.
- **Solução** (`index.html`): paleta dividida em 6 ribbons (Elementos/Impressora/Modelos/Aparência/Impressão/Ajustes), cada um com `.ribbon-toggle` (classe `ribbon-collapsed` + `aria-expanded`) e tons próprios via CSS vars (`--rb-accent`, `--rb-bg`, `--rb-border`) com variantes para tema escuro.
- **Validação**: divs balanceados; nenhum ID funcional alterado.
- **Detalhes**: `leitura obrigatória/EXPLICA_ribbons_separados_toggle_cores.md`

### Pedido 1.7 — Ribbons com padrão de cor único (tonalidade sutil)
- **Pedido**: O padrão de cores de cada ribbon deve ser o mesmo; apenas uma pequena tonalidade diferente, para o usuário perceber o fim de cada ribbon.
- **Solução** (`index.html`, bloco CSS RIBBONS): cores por grupo (roxo/laranja/turquesa/verde/amarelo) substituídas por uma **escala única de azul** — acento `#3b82f6` (Elementos) clareando até `#98b5fb` (Ajustes), com opacidade do fundo crescendo de 5,5% para 13%. Tema escuro recalculado na mesma escala.
- **Validação**: toggles e IDs inalterados; apenas CSS.
- **Detalhes**: `leitura obrigatória/EXPLICA_ribbons_separados_toggle_cores.md`

### Pedido 1.8 — Correção: preview com a etiqueta parou de funcionar
- **Pedido**: O preview da etiqueta parou de funcionar após as edições recentes.
- **Causa raiz + Solução**: na refatoração do `confirm()` (Pedido 1.5), o fechamento da função `limparEtiqueta()` ficou como `});` (sobra do antigo listener) — **erro de sintaxe que derrubava o IIFE principal inteiro**, matando o preview e todos os handlers. Corrigido para `}` (~linha 4174).
- **Validação**: script principal (171 KB) verificado **balanceado** (strings, comentários, regex literals e colchetes) via checker PHP; página retornando 200; estrutura HTML íntegra (1 `<main>`, 1 `</body>`, 1 `</html>`).
- **Detalhes**: `regras/log_solucoes.md` (entrada de 02:50)

### Pedido 1.9 — Correção UTF-8 na exibição dos arquivos MD ("SoluÃ§Ãµes â€”")
- **Pedido**: Os arquivos MD exibiam mojibake ("SoluÃ§Ãµes â€”") ao abrir no navegador.
- **Causa raiz + Solução**: os arquivos em disco já eram UTF-8 válidos; o Apache/XAMPP servia os `.md` **sem charset** no header e o navegador assumia Windows-1252. Criado `.htaccess` na raiz (`AddDefaultCharset UTF-8` + `AddType` para `.md`/`.txt`).
- **Validação**: `Content-Type: text/markdown; charset=utf-8` confirmado via curl; "Soluções" renderizando correto.
- **Detalhes**: `regras/log_solucoes.md` (entrada de 02:20)

### Pedido 1.10 — Grip de arraste à esquerda de cada ribbon
- **Pedido**: Melhorar a esquerda de cada ribbon para dar espaço para inserir o mouse e arrastar.
- **Solução** (`index.html`): alça `.ribbon-grip` (fa-grip-vertical, 18px, cursor grab) na extrema esquerda de cada um dos 6 ribbons. Arraste ativado apenas pelo grip (sem conflito com o drag da paleta); reordena os grupos via HTML5 Drag & Drop com contorno tracejado no ribbon em movimento. **Ordem persistida** em `localStorage` (`etiquetasZebra.ribbonOrder`) e reaplicada ao carregar.
- **Validação**: script 173 KB balanceado; 6 grips únicos; hover com realce no tom do próprio ribbon.
- **Detalhes**: `leitura obrigatória/EXPLICA_ribbons_separados_toggle_cores.md`

### Pedido 1.11 — Reorganização dos ícones dentro dos ribbons
- **Pedido**: Reorganizar corretamente os ícones dentro de cada ribbon.
- **Solução** (`index.html`): agrupamento por função — **Config IP, Tonalidade e Qualidade** movidas para o ribbon **Impressora** (ao lado de Modo Ribbon e Calibrar); o ribbon **Impressão** ficou apenas com as ações (Pré-visualizar, ^GF, Imprimir); o ribbon **Ajustes** foi removido por ficar vazio — agora são **5 ribbons**: Elementos, Impressora, Modelos, Aparência e Impressão. CSS do `ribbon-ajustes` limpo; ordens salvas em localStorage com a classe antiga são ignoradas com segurança.
- **Validação**: divs do bloco 21/21 balanceados; script 173 KB balanceado; IDs únicos (btn-config-ip, tonalidade, quality-*); 5 grupos.
- **Detalhes**: `leitura obrigatória/EXPLICA_ribbons_separados_toggle_cores.md`

### Pedido 1.12 — Correção: modal de opções do elemento permanecia aberto após remover
- **Pedido**: Ao clicar com o botão direito no elemento, abre o modal de opções; ao clicar em Remover, o elemento é excluído, mas o modal ficava aberto.
- **Causa raiz + Solução** (`index.html`, listener `insp-btn-del`): o Remover chamava `deletarSelecionados()` sem fechar `#modal-editor`. Agora, após a exclusão, o handler verifica se o modal está aberto e chama `bootstrap.Modal.getInstance(...).hide()` — o `hidden.bs.modal` existente devolve o formulário do inspetor ao painel esquerdo normalmente.
- **Validação**: script 174 KB balanceado; fluxo remover → modal fecha → formulário restaurado.
- **Detalhes**: `regras/log_solucoes.md` (entrada de 03:45)

### Pedido 1.13 — Autoajuste de elementos ao importar dados externos
- **Pedido**: Ao importar de dados externos, fazer autoajuste para não sobrepor elementos na primeira inserção; o usuário decide como aplicar depois; se necessário, autoajustar tamanho quando o total não couber na etiqueta atual.
- **Solução** (`index.html`, handler `btn-import-aplicar`):
  1. Cursor Y inicia **abaixo do elemento mais baixo já existente** — nada é inserido sobre outro elemento.
  2. Empilhamento vertical com espaçamento (GAP = 3% da altura da etiqueta).
  3. Se o total mapeado não cabe na altura restante: **escala proporcional** reduz fontes (nome/texto, mínimo 10), QR (lado mínimo 60) e barcode (altura mínima 40), piso de 45% com aviso se nem assim couber.
  4. Cada elemento passa por `restringirLimitesElemento(el, W, H)` (margens + rotação) e `ajustarFonteParaCaber` (largura).
  5. Elementos entram **selecionados e ajustáveis** — decisão final de layout fica com o usuário.
- **Validação**: script 177 KB balanceado; toast informa "sem sobreposição" ou "com tamanho reduzido para caber".
- **Detalhes**: `leitura obrigatória/EXPLICA_importador_dados.md` (seção "Autoajuste ao aplicar")

### Pedido 1.14 — Editor de formas geométricas (ribbonalgebra.txt)
- **Pedido**: Ler o `ribbonalgebra.txt` (plano de editor gráfico de formas: objeto por forma, seleção, redimensionamento, preenchimento com regra de contraste, texto dentro da forma com quebra/alinhamento/padding, auto-fit de fonte, persistência), executar a forma que mais se adapta ao projeto e alimentar o MD de pedidos e soluções.
- **Adaptação** (o que já existia no Zebra Designer e foi reutilizado): objetos em `elements[]`, seleção múltipla, mover/redimensionar com handles e clamps (`restringirLimitesElemento`), inspetor, persistência JSON e undo/redo.
- **Solução** (`index.html`):
  1. **3 novas formas nativas** na paleta Elementos: `elipse` (`^GE`), `diagonal` (`^GD`) e `raio` = retângulo com cantos arredondados (`^GB` com 5º parâmetro 0-8).
  2. **Preenchimento** (`insp-cheio`) com regra de contraste em função única `getCorTextoElemento()` — texto branco quando a forma está preenchida, preto caso contrário (emissão `^FR` reverso no ZPL).
  3. **Texto dentro da forma** (borda/elipse/raio): campo Texto + Fonte no inspetor, centralizado com `^FB` (word-wrap 2 linhas) e auto-fit via `ajustarFonteParaCaber`.
  4. **Preview WYSIWYG**: elipse com `border-radius:50%`, diagonal via `linear-gradient` (direção coerente com `^GD R/L`, inclusive sob rotação 90°/270°), raio com `border-radius` proporcional; texto centralizado em div filho.
  5. **Extensões de fidelidade**: desenho das 3 formas + texto em `desenharElementoCanvas` (PNG/SVG/PDF/^GF e preview de impressão) e reconhecimento de `^GE`/`^GD`/`^GB,raio` no `parseZPLToElements` (round-trip de ZPL colado).
  6. `insp-raio` (0-8) e `insp-diag-dir` (toggle diagonal ↗/↘) no inspetor, com aria-labels.
- **Validação**: script 191.750 bytes balanceado (checker PHP); IDs `elipse/diagonal/raio/insp-cheio/insp-raio` únicos no HTML; caminhos de texto/QR/código de barras/linha revisados sem regressão.
- **Limitações**: ~~sem edição por duplo clique no canvas (infraestrutura inexistente — pulado conforme plano)~~ **RESOLVIDO no Pedido 1.19** (duplo clique). Auto-fit de fonte roda na geração do ZPL, não durante o arraste da alça; diagonal não aceita texto; monocromático (preto).
- **Detalhes**: `leitura obrigatória/EXPLICA_editor_formas_geometricas.md`

### Pedido 1.15 — Fidelidade de rotação editor↔preview↔impressão (convenção TL-anchor `^FO`)
- **Pedido** (bugs reportados durante a execução do `sugestao.txt`): (a) "os elementos nunca ficam na mesma posição [entre editor e pré-visualização], nem mesmo quando as duas são horizontais"; (b) "a etiqueta está no vertical [...] a única palavra 'texto' na hora de imprimir dá erro, pois o elemento não acompanha o processo de impressão"; (c) "o texto escrito 'texto' com direção para baixo, do lado esquerdo, no preview está apontando para cima".
- **Causa raiz**: o editor DOM usa rotação com âncora no canto superior-esquerdo da caixa já rotacionada (TL-anchor), mas `gerarZPLBloco` e `desenharElementoCanvas` calculavam com pivô no centro — elementos girados divergiam entre editor, preview, PNG/^GF e impressão, e podiam gerar `^FO` com coordenadas negativas (erro na impressora, sintoma b). A direção `R` do `^A0` é horária (lê de cima para baixo) — o canvas antigo desenhava como se fosse anti-horária (sintoma c). Convenção confirmada empiricamente via API Labelary: `^FO` é o canto superior-esquerdo da caixa JÁ rotacionada; bearing interno da fonte A0 ≈ 0,24×tamanho.
- **Solução** (`index.html`):
  1. `gerarZPLBloco`: derivação do `^FO` reescrita com mapeamento de pegada TL-anchor — `fx`/`fy` trocam em vrot 90/270; `rot0: (x,y) | rot90: (y, H−x−fx) | rot180: (W−x−fx, H−y−fy) | rot270: (W−y−fy, x)`.
  2. `desenharElementoCanvas`: transforms TL-anchor idênticos ao DOM (90: `translate(x+vh,y) rotate(π/2)`; 180: `translate(x+vw,y+vh) rotate(π)`; 270: `translate(x,y+vw) rotate(−π/2)`); ângulos livres mantêm pivô central (idem DOM).
  3. Modelo tipográfico unificado: `larguraTexto()` agora mede com canvas `Arial 600` (mesmo peso do DOM/canvas; fallback `FATOR_CAR`); canvas desenha texto com peso 700/600 como o DOM.
  4. Multilinha coerente com `^FB`: `obterDimensoesElemento` e `restringirLimitesElemento` aceitam multilinha; novo helper `quebrarTextoMultilinha` (quebra por espaços, mesma política do `^FB`).
- **Validação**: `node --check` no script principal (193.700 bytes) sem erro; renderização Labelary de bloco `^A0R` confirma tinta dentro da caixa esperada; simulação .NET em `GraphicsUnit.Pixel` reproduz o desenho do canvas (bbox x[24..51] y[88..173] ≈ caixa x[20..60] y[80..170]).

### Pedido 1.16 — Ribbon Modelos com 3 ícones explícitos (Carregar/Salvar/Gerar em Lote)
- **Pedido** (`sugestao.txt` §1.4): expor Carregar Modelos, Salvar Modelos e Gerar em Lote como 3 ícones direto na régua, em vez de 1 botão que abre um modal só.
- **Solução** (`index.html`): `#btn-carregar-modelos` (fa-folder-open, `data-tmpl-tab="carregar"`) e `#btn-salvar-modelos` (fa-floppy-disk, `data-tmpl-tab="salvar"")` abrem o `#modal-templates` já focando a aba correta (`tmpl-select` ou `tmpl-name-input` no `shown.bs.modal`); `#btn-modal-batch` mantido (fa-sitemap). `#btn-modal-templates` antigo removido (não havia referência JS).
- **Validação**: IDs únicos; handler `btn-save-cache` intacto; `node --check` OK.
- **Confirmação do plano**: "Salvar Modelos" sempre salva a **estrutura-base** (`elements[]` nunca é sobreci­to pelo lote — clones via `Object.assign`).

### Pedido 1.17 — Quantidade de cópias ao imprimir (`^PQ`)
- **Pedido** (`sugestao.txt` §2): ao clicar em Imprimir, perguntar quantas cópias imprimir, injetando `^PQ` (a impressora replica num único envio).
- **Solução** (`index.html`): modal `#modal-print-qty` (+/−, campo 1–999, resumo, Enter confirma, Esc/cancela) + `injetarQuantidadeZPL(zpl, qtd)` — injeta `^PQ` antes de cada `^XZ`; **se o bloco já tem `^PQ`** (lote `^SN` nativo) **multiplica** em vez de substituir, preservando a serialização. `imprimirFTP(qtd)` ganha parâmetro opcional (compatível com chamada sem argumento); `btn-imprimir` e `Ctrl+P` passam por `solicitarImpressaoComCopias()`; `btn-batch-special-print` (lote) também pergunta cópias, injetando no ZPL do lote. Última quantidade usada persiste em `localStorage` (`etiquetasZebra.ultimaQtdCopias`).
- **Validação**: `node --check` OK; sem `alert()`/`confirm()` nativos; casos etiqueta única, lote N-blocos e lote `^SN`+`^PQ` cobertos pela função.

### Pedido 1.18 — Barra de status de lote + "Gerar Todas as Linhas" + validação de mapeamento
- **Pedido** (`sugestao.txt` §3 + Opção B do §3.4 + linha 2124-2133): mostrar o total de etiquetas a gerar (lote especial/dados importados) na div vazia abaixo da barra de zoom; fechar o ciclo dos dados externos gerando uma etiqueta por linha importada; avisar se duas colunas forem mapeadas para o mesmo campo.
- **Solução** (`index.html`):
  1. **Barra de status** `#status-bar-lote` (badge "N etiquetas serão geradas" + detalhe com multiplicador de cópias e origem), recalculada por `atualizarBarraStatusLote()` — chamada ao editar árvore do lote, ao ler CSV/XLSX/Access, ao gerar todas as linhas, ao limpar/novo e ao confirmar cópias. Flag `loteEspecialAtivo` impede que a **semente padrão** da árvore (níveis 1–10) acenda a barra sozinha — só conta lote realmente usado (edição, geração, modelo `.vip` ou sessão restaurada).
  2. **"Gerar Todas as Linhas"** (`#btn-import-gerar-todas` no modal de importação): para cada linha, clona `elements[]` e substitui o texto dos elementos — 1º pelo vínculo direto `el.importColuna` (coluna registrada pelo "Aplicar na Etiqueta"), 2º por correspondência de tipo (`importCorrespondeCampo`); gera `gerarZPLBloco` por linha e empilha em `#zpl`; avisa colunas sem elemento correspondente. Impressão do lote gerado usa o mesmo fluxo de cópias do Pedido 1.17.
  3. **Validação de mapeamento duplicado** (`importValidarMapeamento`): bloqueia "Aplicar" e "Gerar Todas" quando duas colunas apontam para o mesmo campo do sistema; "Aplicar" também registra `el.importColuna` em cada elemento criado.
- **Validação**: `node --check` OK; barra só aparece com total > 1; fluxo etiqueta única intocado.
- **Resolve**: limitação do Pedido 1.4 ("apenas a 1ª linha gera elementos").

### Pedido 1.19 — Edição de texto in-loco por duplo clique
- **Pedido** (`sugestao.txt`, plano das linhas 2580-2797): duplo clique num elemento de texto deve permitir editar o texto direto no local, como em apps de design (Canva/Figma).
- **Causa raiz**: infraestrutura de duplo clique nunca foi construída (limitação conhecida desde o Pedido 1.14).
- **Solução** (`index.html`): listener `dblclick` em `texto/sub/nome/serie` e formas com texto (`ehFormaComTexto`), abrindo campo sobreposto (`input`/`textarea`) via `iniciarEdicaoInlineTexto()` — estilo herda fonte/tamanho/peso do `div`, cor de contraste via `getCorTextoElemento()` em formas. `stopPropagation` em `mousedown/click/dblclick/contextmenu` do campo evita conflito com arraste e com o menu de contexto. Enter confirma (Ctrl+Enter em multilinha), Esc cancela, blur confirma; formas sem texto podem receber texto pela primeira vez.
- **Validação**: `node --check` OK; listener de arraste e menu de contexto existentes intocados; IDs não alterados.

### Pedido 1.20 — Acessibilidade e feedback: `aria-pressed` + indicador do servidor local
- **Pedido** (`sugestao.txt` §4.2 e §4.3): toggles sem estado acessível; usuário só descobre que o `print-server.js` está desligado ao tentar imprimir.
- **Solução** (`index.html`):
  1. `aria-pressed="true/false"` sincronizado nos 4 botões de alternância (`btn-tema`, `btn-toggle-espelho`, `btn-toggle-reverso`, `btn-toggle-imgprint`) dentro de `ligarToggleFlag`, `atualizarBtnImgPrint` e `aplicarTema`.
  2. Chip indicador `#print-server-ind` na ribbon Impressão: `fetch` em `http://127.0.0.1:3001/` (health `GET /` já existente) com timeout de 2s e re-verificação a cada 30s — verde "Servidor OK" / vermelho "Servidor offline" (tooltip ensina `node print-server.js`); falha silenciosa, sem toast alarmante.
- **Validação**: `node --check` OK; sem bloqueio de UI (timeout curto); leitor de tela passa a ouvir o estado dos toggles.

### Pedido 1.21 — Importar dados do Google Sheets através do link
- **Pedido**: No Importar Dados, além de CSV, Excel e Access, permitir importar direto de um Google Sheets colando o link da planilha.
- **Solução** (`index.html` + `api/importar_dados.php`):
  1. Nova origem **Google Sheets (link)** no modal de importação (`#import-tipo-gsheets`, ícone `fab fa-google`); a área de arquivo troca por uma área de link (`#import-url`) conforme a origem escolhida, com instrução de compartilhamento ("Qualquer pessoa com o link — leitor").
  2. **Caminho primário server-side** (imune a CORS): o JS extrai o ID da planilha (e o `gid` da aba, se presente) do link e envia ao `api/importar_dados.php` (`tipo=gsheets&url=...`); o PHP valida o host, monta a URL pública `gviz/tq?tqx=out:csv`, baixa via cURL (segue redirects, fallback `allow_url_fopen`), faz o parse do CSV com auto-detecção de delimitador (`;`/`,`/tab, mesma política do lado cliente), normaliza cabeçalhos (vazios viram "Coluna N", duplicatas recebem sufixo) e descarta linhas vazias.
  3. **Fallback client-side**: se o backend falhar, `importGsheetsClientSide()` tenta o mesmo endpoint gviz direto do navegador.
  4. Integrado a todo o fluxo existente: mapeamento de colunas, "Aplicar na Etiqueta", "Gerar Todas as Linhas" (Pedido 1.18) e barra de status.
- **Validação**: `php -l` limpo; endpoint testado via POST — link inválido devolve `ok:false` ("Link invalido...") e planilha inexistente/compartilhamento errado devolve `ok:false` com instrução de correção (respostas sempre JSON, nunca fatais); `node --check` OK; IDs únicos.

### Pedido 1.22 — Regra universal: toggle OFF em preto e branco, ON colorido
- **Pedido**: Todos os ícones que ativam/desativam (ligam/desligam, on/off) devem ficar **preto e branco na posição OFF** e **coloridos na posição ON** — "resolve todos os ícones para a melhor entrega desta solicitação".
- **Solução** (`index.html`):
  1. Nova regra CSS com `filter: grayscale(1)`: `.icon-btn.icon-btn-off`, `#ribbon-nao + label.icon-btn`, `input.btn-check[name="quality"]:not(:checked) + label.icon-btn` e `.ribbon-group.ribbon-collapsed .ribbon-toggle`.
  2. **Toggles JS** (`btn-tema`, `btn-toggle-espelho`, `btn-toggle-reverso`, `btn-toggle-imgprint`): classe `icon-btn-off` quando inativos (P&B) e `icon-btn-success` (verde colorido) quando ativos, em `ligarToggleFlag`, `atualizarBtnImgPrint` e `aplicarTema` (antigo `opacity 0.75` substituído).
  3. **Modo Ribbon** (par Sem/Com): "Sem Ribbon" é a **posição OFF** → sempre preto e branco; "Com Ribbon" é a posição ON → sempre colorido (azul). A seleção atual continua indicada pelo anel de destaque de `.btn-check:checked`.
  4. **Qualidade** (Cinza/P&B): a opção não marcada fica P&B e a marcada fica **ciano colorido** (`input.btn-check[name="quality"]:checked + label { color:#0891b2 }`), substituindo o cinza muted.
  5. **Expandir/Recolher ribbon** (5 botões `ribbon-toggle`, que ligam/desligam os grupos): grupo expandido = colorido no tom do próprio ribbon (`.ribbon-toggle { color: var(--rb-accent) }`); recolhido = preto e branco, além do contorno tracejado existente.
  6. Itens **não-toggle** ficam de fora por design: paleta de elementos e ações (imprimir, exportar) são sempre coloridos (não possuem estado on/off); checkboxes (Régua/Grade/Snap) não são ícones; o LED do servidor local é indicador de status (verde/vermelho), não um toggle do usuário.
- **Correção de estrutura aproveitada**: a auditoria de fechamento revelou um `</div>` sobrante inerte logo antes do `</main>` — removido; HTML estático agora balanceado 274/274.
- **Validação**: `node --check` OK; HTML balanceado fora dos scripts; regra CSS auditada (atinge apenas os 4 radios `btn-check` + 5 ribbon-toggles + 4 toggles JS); `aria-pressed` mantido sincronizado (Pedido 1.20).
- **Confirmação de espelho na impressão (Pedido 1.23, complemento)**: `^PM`/`^LR` estão presentes em **todos** os caminhos de impressão — `renderZPL()` (vetorial), `gerarZPLImagem()` (^GF), **cada bloco** de `gerarZPLBloco()` (lote especial e "Gerar Todas as Linhas") — ou seja, com o Espelho ativo a pré-visualização (CSS `scaleX(-1)`) e a impressão saem igual a um espelho, sem exceção.

---

### Pedido 1.23 — Espelho "sem ícone e sem função" (ícones Bootstrap inexistentes)
- **Pedido**: O botão de espelhamento de etiqueta (^PM) estava sem ícone e sem função aparente.
- **Causa raiz**: o botão usava `bi bi-flip-horizontal` — **classe que não existe no Bootstrap Icons 1.11.3** (0 ocorrências no CSS oficial), então renderizava vazio. Sem ícone visível, o estado do toggle ficava invisível: o usuário não via que o ^PM estava LIGADO, e as impressões saíam espelhadas ("a pré-visualização está saindo espelhada"). A função sempre existiu (`^PM` no prólogo ZPL + `localStorage`), apenas sem feedback visual. Auditoria completa encontrou **5 classes inexistentes** no projeto: `bi-flip-horizontal`, `bi-shapes`, `bi-ruler-combined`, `bi-network-wired` e `bi-ruler` (a correta é `bi-rulers`).
- **Solução** (`index.html`):
  1. Espelho agora usa `bi bi-symmetry-horizontal` (existe no set oficial) e o repositório de estado do Pedido 1.22 deixa ON/OFF evidentes.
  2. **WYSIWYG na Pré-visualização de Impressão**: quando `^PM` está ativo o canvas do preview é espelhado via CSS (`scaleX(-1)`), quando `^LR` (reverso) está ativo é invertido (`invert(1)`) — o preview mostra exatamente o que a impressora imprime, e o rodapé informa "ESPELHADO ^PM"/"REVERSO ^LR". O canvas gerado para impressão/exportação não é alterado (o ^PM do prólogo continua fazendo o espelhamento na impressora — sem espelhamento duplo no caminho ^GF).
  3. Ícones quebrados corrigidos na Ajuda: `bi-shapes` → `fas fa-shapes`, `bi-ruler-combined` → `fas fa-ruler-combined`, `bi-network-wired` → `fas fa-network-wired`, `bi-ruler` → `bi bi-rulers`.
- **Validação**: todos os 53 ícones `bi-*` usados no projeto conferidos contra o CSS oficial 1.11.3 (0 ausentes); `node --check` OK.
- **Ação do usuário**: se a pré-visualização continuar espelhada, o Espelho está LIGADO no navegador — clicar no botão (agora visível, colorido quando ativo) desliga.

---

## 2. Pedidos de Regras, Estrutura e Automação (histórico do log_solucoes.md)

### Pedido 2.1 — Integração de Diretrizes UI WCAG e Estrutura PHP Index
- **Pedido**: Adicionar regulamento normativo WCAG 2.2 e design (ABNT/Material/Bootstrap 5), obrigando que a injeção do HTML Head/Body seja centralizada apenas no `index.php`.
- **Solução** (2026-02-28): Criado `regras/php_ui_rules.md`; atualizados `master_rules.md`, `GUIA_CRIACAO_PAGINAS.md` e `VALIDACAO_ESTRUTURA.md`. Regra estrutural: **o único arquivo que pode conter `<html>`, `<head>` e `<body>` é o `index.php`**.

### Pedido 2.2 — Remodelagem de Acessibilidade do Webhook Manager
- **Pedido**: Adequar a tela de Integração Webhook (GAS) ao checklist do `php_ui_rules.md` e WCAG 2.2.
- **Solução** (2026-02-28): `pages/admin/webhook_manager.php` refatorado — `<section>`/`<header>`/`<article>` semânticos, `id`/`for` cruzando inputs com labels, `aria-label` e `aria-hidden`.

### Pedido 2.3 — Refatoração de Perfil, Gamificação e Prefixos de Banco
- **Pedido**: Implementar sistema de perfil robusto (redes sociais, níveis por atividade/XP, indicações) e padronizar prefixos de tabelas SQL.
- **Solução** (2026-03-02): `pages/perfil.php` refeito (Premium UI), `pages/admin/ajax/save_profile.php` (salvamento multitarefa), `pages/admin/ajax/register_activity.php` (endpoint de XP), +40 arquivos PHP refatorados via script PHP de renomeação massiva.

### Pedido 2.4 — Padrões Universais Web, Acessibilidade e SEO
- **Pedido**: Instituir normas obrigatórias baseadas em ARIA, WCAG, W3C e Schema.org para forçar conformidade no frontend gerado.
- **Solução** (2026-03-02): Criados `regras/web_standards_rules.md` e `prompt/web_standards_rules.md`; `master_rules.md` atualizado para obrigar acessibilidade e SEO estruturado em todas as tarefas.

### Pedido 2.5 — Reorganização Logística e Norma ABNT 2026
- **Pedido**: Reestruturar pastas de `regras/` por categorias para leitura recursiva por LLMs e implementar a Norma ABNT 2026.
- **Solução** (2026-03-02): Criados `regras/prompts_php/abnt_document_rules_2026.md` e template correspondente; movimentação massiva de manuais para subpastas (`prompts_php`, `templates_php`, `prompt_de_llms`, `templates/Prompt`); `master_rules.md` agora obriga varredura recursiva.

### Pedido 2.6 — Limpeza Final e Reestruturação Lógica
- **Pedido**: Limpar pastas residuais e consolidar diretrizes de desenvolvimento, exemplos e configurações de sistema.
- **Solução** (2026-03-02): Movimentação total de `templates/`, `{{Readmes}}.md/`, `Prompt/` e arquivos soltos da raiz para subpastas qualificadas. `regras/` ficou com 3 subpastas lógicas + logs/master_rules na raiz.

### Pedido 2.7 — Regra de Soluções no Master Rules
- **Pedido**: Obrigar LLMs a salvarem arquivos de teste, debug e fix na pasta `solucoes/` seguindo a estrutura modular.
- **Solução** (2026-03-02): Regra inegociável reintroduzida no `master_rules.md` (dependência: `regras/prompts_php/SISTEMA_MODULAR.md`).

### Pedido 2.8 — Workflow de IA e Inventário Detalhado
- **Pedido**: Obrigar o ciclo de vida completo (Leitura → Workflows → Revisão → Entrega) e formalizar o inventário de todos os arquivos de regras/templates.
- **Solução** (2026-03-02): "Regra 1" do `master_rules.md` reestruturada com inventário completo de todos os arquivos para leitura por LLMs.

### Pedido 2.9 — Padronização de Nomenclatura e Memória de Erros de Terminal
- **Pedido**: Padronizar nomes de arquivos para precisão e registrar falhas de comandos no terminal Windows/XAMPP.
- **Solução** (2026-03-02): Renomeação massiva (`regra_llms_...`, `regra_php_...`, `estrutura_php_...`); criado `regras/prompt_de_llms/regra_llms_comandos_proibidos.md` (Regra 3 — "memória de erros" evitando repetição de comandos que falham no ambiente).

### Pedido 2.10 — Eggs Hunter V2 (IndexedDB)
- **Pedido**: Criar sistema de verificação de saldo em lote (1000 WIFs) com alta performance e persistência local.
- **Solução** (2026-03-06): Criados `js/eggs-hunter.js` e `docs/EGGS_HUNTER.md`. Acumula WIFs e verifica em lotes de 20 via API blockchain.info ao atingir 1000; UI de progresso e modal de resultados.

### Pedido 2.11 — Temas Universais (Claro/Escuro)
- **Pedido**: Implementar suporte nativo a temas claro e escuro (Regra 9 do master_rules.md).
- **Solução** (2026-03-06): Criado `js/theme-manager.js` (persistência em `localStorage` + detecção de preferência do sistema); variáveis CSS no `css/styles.css`; botão de alternância na navbar do `index.html`.

---

## 3. Pedidos de Upgrade de Regras (Master Rules v6.3)

### Pedido 3.1 — Upgrade Master Rules v6.3 (Seções 21–23) — **CONCLUÍDO**
- **Pedido**: Consolidar automação industrial de vídeos e desenvolvimento Windows no núcleo de regras do projeto.
- **Solução**: Seções 21 (Automação Industrial & Pipeline de Dados), 22 (Protocolo de Terminal Windows PS/CMD) e 23 (Engenharia de AEO/SGE 2026) ativas no `master_rules.md` (linhas 339/353/360). `readme.html` atualizado conforme Regra 10 (v7.4+). Relatório final de auditoria 100% emitido.
- **Validação**: `regras/relatorio_final_upgrade_rules.md` + checklist 100% em `regras/task_upgrade_rules.md`.

### Pedido 3.2 — Regra de Entidades XML/Blogger
- **Pedido**: Definir normas para uso de entidades HTML em templates XML do Blogger (conversão @CanalQb).
- **Solução**: `regras/regra_llms_windows_blogger_xml_entities.md` — tabela de entidades obrigatórias (`&`, `<`, `>`, `"`, `'`), símbolos de texto/formatação e matemáticos.

### Pedido 3.3 — Auditoria de Arquivos vs README.html — **CONCLUÍDO**
- **Pedido**: Comparar todos os arquivos MD do projeto contra o inventário do `readme.html`.
- **Solução**: Varredura recursiva de `regras/` (98 arquivos: 74 MD + 22 PHP + 2 JSON). 31 arquivos ausentes foram adicionados aos blocos `#inv-php` (16), `#inv-ia` (2) e `#inv-tpl` (14) do `#inventoryModal`. `readme.html` atualizado para **v7.5** (contador 45, release notes 21/09/2026). Inventário final: 115 itens, **zero faltando, zero referências quebradas**.
- **Validação**: `regras/analise_arquivos_vs_readme.md` (✅ CONCLUÍDA) e `regras/arquivos_ausentes_readme.md` (✅ RESOLVIDO) — ambos atualizados com contagens finais.

---

## Como manter este arquivo

1. **Novo pedido resolvido** → adicione nova entrada na seção correspondente com: Pedido, Solução, arquivos tocados, validação e status.
2. **Pedido pendente** → marque com **PENDENTE** ou ⚠️ e descreva o plano proposto.
3. Mantenha o vínculo com o `regras/log_solucoes.md` (registro cronológico detalhado) — este arquivo é a visão consolidada por pedido.
