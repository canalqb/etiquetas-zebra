# Registro de Erros — etiquetas-zebra

Registro de problemas ativos e sugestões. Atualizado em **2026-08-20**.

## Pendentes de correção

| Data do registro | Bug | Status / Observação |
|------|-----|----------|
| 2026-08-20 | Impressão em etiqueta configurada como **vertical**: correção aplicada (fórmulas de origem 90/270/180 corrigidas em `gerarZPLBloco()`). | Validação **ZPL + render (Virtual ZPL Printer) concluída**: teste de rotação (0/90/180/270) com elementos rotacionados impresso e conferido por pixels — FO/rC corretos em todos os lados. Teste ponta a ponta adicional: etiqueta 100x50 desenhada na vertical (50x100) → ZPL `^PW800 ^LL400` com 6 campos `^FO` dentro dos limites, PNG renderizado com tinta em x[67..446] y[56..374] (margem mínima 24 dots). **Pendente: validação física na impressora Zebra** (sem hardware disponível no momento). Revisar `^FO` vs `^FT` (canto vs linha de base) antes de fechar o item. |
| 2026-08-20 | **Impressora imprime apenas em horizontal** (paisagem): designs verticais (rot 90/270) precisam ser convertidos para o formato horizontal antes de chegar na impressora. | A saída ZPL **já é sempre horizontal** (`^PW800 ^LL400`), com o conteúdo de designs verticais transformado para caber — validado nas 4 rotações via render na Virtual ZPL (bbox conteúdo 0..798 × 0..398, todos os elementos dentro). **Pendente: conferir a conversão na impressora física.** |
| 2026-08-20 | **Perda de foco ao digitar na árvore do Lote Especial** (+ `NotFoundError` no innerHTML): cada tecla disparava `renderStudio()` → `renderBatchSpecialTreeUI()`, que reconstruía todo o HTML da árvore e destruía o campo em edição; o `change`/`blur` durante a substituição causava corrida (`innerHTML` em nó movido). | **Corrigido e validado**: guarda anti-reentrância (`_renderingTreeUI`) em `renderBatchSpecialTreeUI()` + captura do campo ativo (data-id/data-field/caret) antes do rebuild e restauração de foco+cursor após religar os listeners. Validado via CDP: árvore reconstruída com valor preservado e `.focus()` chamado no novo nó correto. Obs.: mensagem de console `Unsafe attempt to load URL ... index.html` **não vem do app** (sem iframe/window.open/reload no código) — origem ambiental (extensão/app externo). |

## Sugestões de melhorias (referência a sites/sistemas similares)

1. **Desempenho do editor (prioridade)** — ✅ parcial: `renderStudio()` agora usa `scheduleRenderPreview()` (coalescência via `requestAnimationFrame`, máx. 1 reconstrução de preview por frame durante digitação/arraste/seleção). Restam: cachear QR/barcode por hash e evitar rebuild completo da tabela de elementos em mousemove.
2. **Exportação universal** — além de `.BIN`/`.VIP`/ZPL, exportar o preview como PNG/SVG/PDF (imagem da etiqueta renderizada), como fazem os geradores ZPL online.
3. **Print preview fiel** — simular rotação e densidade no preview para mostrar exatamente o que sairá na impressora física (alinhar com o bug de impressão vertical).
4. **Múltiplos modelos em abas** — trabalhar com várias etiquetas abertas ao mesmo tempo.
5. **Galeria de templates prontos** — padrões de caixa, envio, estoque, série; acelera a criação e serve de vitrine.
6. **Backup/compartilhamento em nuvem** — `localStorage` é frágil (perde tudo ao limpar dados do navegador). Sugestão: serializar o modelo em URL/Base64 para compartilhar por link e/ou IndexedDB com exportação JSON de todos os modelos.
7. **Mobile** — habilitar salvar/exportar também no offcanvas (hoje são placeholders "use a versão desktop").
8. **Contador de etiquetas por rolo + estimativa** — dado o tamanho (W×H) e comprimento do rolo, calcular quantas etiquetas cabem e custo aproximado.
9. **ZPL avançado a partir dos PDFs** (ver seção abaixo): já aplicados `^SN`, `^FB` e `^PQ`; restam `^FH`/`^FE`, `^CI` (encodings), `^MD`/`^SD` (densidade por tonalidade), `^PM`/`^LR` (espelho/reverso), fontes TrueType `^A@`.
10. **Acessibilidade/qualidade** — ✅ concluído (2026-08-20): todos os 9 modais com `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; todos os `btn-close` com `aria-label="Fechar"` (incl. `#modal-limpar`, que não tinha botão de fechar, e `#insp-btn-deselect`); semântica aplicada (`<main>`, `<header>`, `<aside>` no offcanvas mobile, 5× `<section class="accordion-item">`, `<nav aria-label="Abas do Studio">` nos tabs); sem `console.log/warn/error` no app. Validado em Chrome headless: 0 erros de página do app, tags balanceadas, ZPL gerado corretamente. Ruído externo conhecido: `adsbygoogle.push() error` (script de anúncios do Google, fora do controle do app). Restam: lazy-load de fontes/ícones e tema claro/escuro.

## Recursos disponíveis para desenvolvimento ZPL (PDFs no projeto)

Dois PDFs oficiais Zebra servem de referência para evoluir a geração de etiquetas:

- **`zpl-zbi2-pg-en.pdf`** — *ZPL/ZBI2 Programming Guide* (EN, 1769 pág.): referência completa de comandos ZPL II.
- **`zt411-zt421-ug-ptbr.pdf`** — *Guia do Usuário ZT411/ZT421* (PT-BR, 240 pág.): configurações de impressora e operação.

Comandos encontrados e aplicáveis ao projeto:

| Comando | Para que serve | Exemplo encontrado no guia | Situação |
|---------|----------------|------------------------------|----------|
| `^SN` | **Serialização nativa na impressora** (incremento por impressão) — dispensa gerar N blocos no host | `^SNSERIAL NUMBER 00000000111,1,Y` | ✅ Implementado na Geração em Lote (1 nível, ordem normal, campo texto) + `^PQ` |
| `^FB` | **Field Block**: largura máxima, nº de linhas, espaçamento e alinhamento (texto multiline) | `^FB800,6` | ✅ Implementado no editor (checkbox Multilinha + largura + máx. linhas + alinhamento) |
| `^PQ` | Quantidade de cópias impressas | `^PQ10` | ✅ Implementado junto ao `^SN` no lote |
| `^FO`/`^FT` | Ancoragem por **canto** vs **linha de base** do texto — relevante para o bug de rotação vertical | `^FO20,100` | Corrigido para rotações; revisar `^FT` na validação física |
| `^BQ`/`^BC`/`^BY` | QR Code, Code 128 e defaults de barcode (rotação, altura, linha de interpretação, check digit) | `^BY3`; parâmetros opcionais (34912-34918) | Aplicado no QR (mag real); barcode existente |
| `^A0N`/`^A@` | Fontes escaláveis (bitmap) e **TrueType** (`TT0003M_.TTF`) | `^A0N,89` / `^A@N,75,75,TT0003M_.TTF` | Disponível |
| `^MD`/`^SD` | Densidade/tonalidade de impressão (escurecer/clarear) | — | Em uso (`^MD`); `^SD` por tonalidade disponível |
| `^CI` | **Encodings internacionais** (acentos/UTF-8 na etiqueta) | `^CI0` no header padrão | Em uso (`^CI28`) |
| `^FH`/`^FE` | Campo hexadecimal / escapes para caracteres especiais | — | Disponível |
| `^PM`/`^LR` | Espelhamento (`^PM`) e **reverso branco-sobre-preto** (`^LR`) | 41661-41664 | Disponível |
| `^LL`/`^LH`/`^PW` | Dimensões da etiqueta: comprimento, origem (home) e largura de impressão | `^LL935` / `^LH30,30` | Em uso |

Header padrão de configuração sugerido no guia (referência para `gerarZPLBloco()`):
`^LT0^MNW^MTT^PON^PMN^LH0,0^JMA^PR2,2^LRN^CI0` (linha 39805 do guia).

**Ideias de desenvolvimento a partir dos PDFs (restantes):** acentos via `^CI`; controle de densidade `^SD` por tonalidade; fonte TrueType para logos/textos; `^PM`/`^LR` para efeitos; validação do header/rotação com `^FO` vs `^FT` na impressora física.

## Análise: "2. Geração em Lote" × modelo de referência (Rua → Lote → Caixa)

> Registro da comparação ponto a ponto solicitada. **Conclusão: a engine implementada é EQUIVALENTE ao modelo de referência.**

### Como o modelo de referência funciona (Rua → Lote → Caixa)
Cada nível da hierarquia é uma **etapa de contagem independente**:
- `Rua` (mais externo) — conta devagar; só incrementa quando `Lote`/`Caixa` completam um ciclo.
- `Lote` — conta no meio.
- `Caixa` (mais interno) — conta rápido; incrementa a cada etiqueta.
- Combinações = produto cartesiano aninhado: 1 Rua ⇒ N Lotes ⇒ M Caixas. Ordem de impressão: **mais interno primeiro**, resets quando o nível interno zera.

### Como o editor implementa ("Geração em Lote")
- UI: árvore genérica de N níveis (`batchSpecialTree`); cada nó tem `nome`, `quantidade` (range) e `targetElementId` (campo na etiqueta que recebe o valor). Nó raiz = `"Rua"`, subníveis = `"Subnível N"` (encadeados após o fix).
- Engine: `gerarCombinacoesComBinding()` é **recursiva genérica de N níveis** (qualquer profundidade), percorre a árvore e, para cada combinação, injeta o valor no elemento-alvo via `el.targetElementId`, chamando o próximo nível. Ordem: filho mais profundo incrementa primeiro; reset correto ao subir de nível.

### Resultado dos testes (Node, réplica da engine)
| Cenário | Resultado |
|---|---|
| 2×2×2 (3 níveis, valores A/B) | 8 combinações, ordem exata (mais interno primeiro, resets corretos) |
| 51×11×5 (3 níveis, 2805) | 2805 combos; primeira `100/02/1`, última `150/12/5`, penúltima `150/12/4` — **idêntico ao esperado para Rua→Lote→Caixa** |

### Equivalência e limitações
- ✅ Mesmo produto cartesiano aninhado, mesma ordem (mais interno primeiro), mesmos resets.
- ✅ Genérico para N níveis (o modelo de referência é fixo em 3, mas é caso particular do N genérico).
- ⚠️ **Limitação**: nós **irmãos** no mesmo nível com o mesmo `targetElementId` se **sobrescrevem** (não há produto cartesiano entre irmãos — o "array" do modelo não é suportado). Com a UI encadeada isso não ocorre em árvores novas, mas dados antigos salvos com irmãos mantêm o comportamento de sobrescrita.

### Especificação técnica para agente LLM (se houver necessidade de evoluir)
1. **Suporte a irmãos (array-like)**: se o usuário criar 2 nós no mesmo nível com o mesmo `targetElementId`, gerar produto cartesiano entre os valores dos irmãos (ex.: `Caixa` 1..10 + `Caixa` A..C ⇒ 30 etiquetas). Exige agrupar irmãos por nível no `gerarCombinacoesComBinding` e expandir antes do próximo nível.
2. **Serialização nativa `^SN`** ✅ implementado: para série única (1 nível, ordem normal, campo de texto), emite `^SN<prefixo><valor inicial>,1,Y` + `^PQ<n>` em **1 bloco** (contagem na impressora), com fallback para o loop no host em multi-nível/QR/barcode. Validado: Virtual ZPL reportou 5 labels, sem warnings `^SN`/`^FB`. Multi-nível continua precisando do loop no host ou de múltiplos contadores sincronizados.
3. **Validação da árvore**: impedir salvamento de árvores com irmãos conflitantes (ou avisar), evitando a sobrescrita silenciosa.
4. **Preview em lote**: mostrar 1º/último ZPL e contagem total estimada antes de exportar/imprimir.
5. Não alterar `regras/`. Testar com a ordem mais-interno-primeiro como invariante.