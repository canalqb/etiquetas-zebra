### [2026-08-09 11:32:00] UI Params: seções SGD/ZPL + ajuda por comando (exemplos dos PDFs) + campos compactos
- **Arquivo**: `ZebraBluetooth/app/src/main/java/com/zebra/manager/MainActivity.kt`
- **Tarefa**:
    1. **Seções de comandos**: Parâmetros do Perfil agora agrupa os comandos em **Comandos SGD** e **Comandos ZPL** (classificação automática por `tipoDoComando()` — linha `!` = SGD; `^`/`~`/`^XA` = ZPL). Cada seção tem cabeçalho com badge de contagem e botão **"Adicionar comando"** (abre o modal ZplSgdModal e insere novos campos dinamicamente com o mesmo padrão visual).
    2. **Botão de ajuda (?) em cada comando**: cada `ParametroItem` ganhou botão "?" que abre `DialogAjudaComando` com: linha de comando, o que faz, exemplo de preenchimento e valores aceitos. Exemplos baseados nos PDFs oficiais (`zpl-zbi2-pg-en.pdf`, `zt411-zt421-ug-ptbr.pdf`, doc "Bloqueando a troca de Direct Thermal → Thermal Transfer via SGD"). Mapas `sgdAjuda`/`zplAjuda` (~30 entradas) + fallback por tipo.
    3. **Altura reduzida das caixas**: campos de valor do `ParametroItem` e do formulário do `ZplSgdModal` agora com `height(44.dp)`, texto 13.sp, label trocada por placeholder (com o valor padrão como dica).
    4. Preservado o padrão visual (cards, cores, badges).
- **Build/Deploy**: `gradlew :app:assembleDebug` OK; APK (22 MB) instalado via `adb -s 192.168.0.3:5555 install -r`.
- **Dependências**: `obterAjuda()`, `tipoDoComando()`, `AjudaComando`, `DialogAjudaComando`, `SecaoComandosHeader`, `SecaoComandosVazia`, `BotaoAjuda`. Sem mudança de schema Room.

### [2026-08-09 08:05:00] Remoção das abas — Perfis como tela única + Parâmetros do Perfil
- **Arquivo modificado**: `ZebraBluetooth/app/src/main/java/com/zebra/manager/MainActivity.kt`
- **Tarefa**: Removidas as 2 abas (Parâmetros/Perfis) e o `TabRow`. O app agora abre direto na tela **Perfis**. Cada perfil ganhou 4 botões: **Editar** (carrega o perfil nos parâmetros e abre **"Parâmetros do Perfil"** — tela de Parâmetros renomeada, com botão voltar), **Compartilhar** (.bin via share), **Baixar** (exporta .bin via SAF) e **Excluir**. O item "Comandos ZPL ou SGD" foi **removido do menu** ☰ e virou o botão "**Adicionar Comando (ZPL/SGD)**" dentro de Parâmetros do Perfil (abre o `ZplSgdModal`). Rodapé de Perfis agora só tem "Importar .bin" e "Inserir" (o "Exportar .bin" global virou o botão Baixar por perfil).
- **Build/Deploy**: `gradlew :app:assembleDebug` OK; APK `app-debug.apk` instalado via `adb -s 192.168.0.3:5555 install -r` (o USB `3096TF1010048087` não estava conectado no momento).
- **Dependências**: MainActivity (estado `perfilEmEdicao` substitui `selectedTab`; `ZplSgdModal` passou a ser aberto pelo `onAdicionarComando`). Sem mudança de schema Room.

### [2026-08-09 01:06:00] NFC sem modal "Configuração Inicial" — ativação forçada do foreground dispatch
- **Arquivos modificados**:
    - `ZebraBluetooth/app/src/main/java/com/zebra/manager/MainActivity.kt` (removidos `NfcModal`/`NfcResultCard`/estado `showNfcModal`; novo `iniciarFluxoNfc(intent?)` que cria o `NfcManager`, chama `ativarModoEspera()` e processa intent já recebido; banner não-modal `NfcFluxoStatusBar` no Scaffold com progresso/resultado/tentar novamente; observer de ciclo de vida ON_RESUME/ON_PAUSE para habilitar/desabilitar foreground dispatch)
    - `ZebraBluetooth/app/src/main/java/com/zebra/manager/ConfigViewModel.kt` (novo helper público `showToast(msg)`)
- **Tarefa**: A função NFC não abre mais o modal "NFC — Configuração Inicial" (seleção de preset). Ao tocar "Via NFC" no drawer ou ao abrir o app por tag NFC, o app ativa imediatamente o foreground dispatch (`NfcManager.ativarModoEspera()`) para receber o pulso da impressora ZT411. Preset usado automaticamente: o primeiro de `nfcPresets` (seed padrão). Feedback por banner não-modal + Toast (`onResultado`).
- **Build/Deploy**: `gradlew :app:assembleDebug` OK; APK `app-debug.apk` (21,7 MB) instalado via `adb -s 3096TF1010048087 install -r`.
- **Dependências**: NfcManager (máquina de estados), ConfigViewModel, MainActivity. Sem alteração de schema Room.

### [2026-08-09 00:40:00] Implementação das 5 lacunas ZebraBluetooth + Seed de 6 Perfis + NFC Tap
- **Arquivos modificados**: 
    - `ZebraBluetooth/app/src/main/AndroidManifest.xml` (Intent-filter NDEF_DISCOVERED)
    - `ZebraBluetooth/app/src/main/java/com/zebra/manager/MainActivity.kt` (onCreate/onNewIntent NFC, TesteImpressaoModal com QRCode, checkbox senha/BT discovery)
    - `ZebraBluetooth/app/src/main/java/com/zebra/manager/NfcManager.kt` (usa sequenciaPosNfc do preset no provisionamento)
    - `ZebraBluetooth/app/src/main/java/com/zebra/manager/ConfigViewModel.kt` (ensurePerfisPadrao com 6 perfis: 3 Thermal Trans + 3 Direct Thermal)
    - Sem alteração de schema Room: a senha do perfil é resolvida em runtime (4 últimos dígitos da série ou digitada) e passada ao `enviarPerfilParaImpressora` — PerfilEntity/PerfilDao (pasta `data/`) permanecem sem campo `senha` (Room v4; migração 3->4 só cria `parametros_ativos`)
- **Tarefa**: Fechar as 5 lacunas levantadas: 1) NFC usa a sequência de provisionamento do preset (antes usava só IP/senha); 2) Teste de Impressão agora imprime QRCode com série/IP/modelo + título "MBL" + footer "canalqb.com.br"; 3) Seed cria 6 perfis padrão (Boop/Reflexivo x Thermal Trans/Direct Thermal); 4) Checkbox "Bluetooth Discovery off" + senha (4 últimos dígitos da série como padrão); 5) Abertura do app por tap NFC via NDEF_DISCOVERED.
- **Build/Deploy**: `gradlew assembleDebug` OK; APK `app-debug.apk` (21,7 MB) instalado via `adb -s 3096TF1010048087 install -r`.
- **Dependências**: ConfigViewModel, NfcManager, MainActivity, AndroidManifest (schema Room permanece v4, sem coluna `senha`).

### [2026-02-28 20:41:05] Integração de Diretrizes UI WCAG e Estrutura PHP Index
- **Arquivo criado**: regras/php_ui_rules.md
- **Tarefa**: Adição de novo regulamento normativo WCAG 2.2 e design (ABNT/Material/Bootstrap 5), obrigando que a injeção do HTML Head/Body seja centralizada apenas no `index.php`. O master_rules.md e os manuais GUIA_CRIACAO_PAGINAS.md e VALIDACAO_ESTRUTURA.md foram atualizados.
- **Código gerado**:
```markdown
## 🏗️ 0. REGRA ESTRUTURAL DO SISTEMA (PHP)
- **O ÚNICO arquivo do sistema que pode conter as tags `<html>`, `<head>` e `<body>` é o `index.php`.**
... (Consultar php_ui_rules.md)
```
- **Dependências**: regras/master_rules.md, regras/GUIA_CRIACAO_PAGINAS.md, regras/VALIDACAO_ESTRUTURA.md

### [2026-02-28 20:48:41] Remodelagem de Acessibilidade UI do Componente Webhook Manager
- **Arquivo Editado**: pages/admin/webhook_manager.php
- **Tarefa**: Adequação de `<section>`/`<header>`/`<article>`, links do tipo id/for cruzando os inputs com as labels. Injeção de `aria-label` e `aria-hidden` para que a tela obedeça inteiramente o checklist do `php_ui_rules.md` e WCAG 2.2.
- **Código gerado**:
```php
<section class="container py-4">
    <header class="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h1 class="h2 fw-bold mb-0">Integração Webhook (GAS)</h1>...
...
<label for="integration_name" class="form-label small fw-bold">NOME DA INTEGRAÇÃO</label>
<input type="text" id="integration_name" name="name" class="form-control" placeholder="Ex: Planilha Principal" required>
```
- **Dependências**: regras/php_ui_rules.md

### [2026-03-02 10:20:00] Refatoração de Perfil, Gamificação e Prefixos de Banco
- **Arquivos criados/modificados**: 
    - `pages/perfil.php` (Refeito com Premium UI)
    - `pages/admin/ajax/save_profile.php` (Lógica de salvamento multitarefa)
    - `pages/admin/ajax/register_activity.php` (Novo endpoint de XP)
    - +40 arquivos PHP refatorados para novos nomes de tabelas.
- **Tarefa**: Implementar sistema de perfil robusto com redes sociais, níveis por atividade, sistema de indicações e padronização total de prefixos de tabelas SQL conforme regras.
- **Código gerado**: Refatoração atômica de SQL e Renomeação Massiva via Script PHP.
- **Dependências**: `config.php`, `js/scripts.js`, `css/styles.css`

### [2026-03-02 10:35:00] Implementação de Padrões Universais Web, Acessibilidade e SEO
- **Arquivos criados**: `regras/web_standards_rules.md`, `prompt/web_standards_rules.md`
- **Arquivo editado**: `regras/master_rules.md`
- **Tarefa**: Instituição de normas obrigatórias baseadas em ARIA, WCAG, W3C e Schema.org para forçar conformidade técnica em gerações de código frontend.
- **Resumo**: Atualização das Master Rules para obrigar leitura e aplicação de acessibilidade e SEO estruturado em todas as tarefas.
- **Dependências**: `regras/master_rules.md`

### [2026-03-02 12:24:00] Otimização Final de Largura do Combobox DDI
- **Arquivo editado**: `css/styles.css`
- **Tarefa**: Reduzir largura excessiva do combobox DDI que estava muito grande
- **Problema identificado**: `combobox_token_wrapper` ocupando espaço excessivo devido ao `flex: 1` no input e `flex-grow: 1` no container
- **Soluções aplicadas**:
  1. **Wrapper**: Adicionado `width: auto`, `max-width: 100%`, `flex-shrink: 0` para ajuste automático
  2. **Input**: Alterado `flex: 1` para `flex: none` para não forçar crescimento do wrapper
  3. **Layout**: Mantido `flex-wrap: nowrap` para evitar quebra de linha
- **Detalhes técnicos**:
  - `.combobox_token_wrapper`: `width: auto`, `flex-shrink: 0` (ajusta ao conteúdo)
  - `.combobox_input`: `flex: none` (não força crescimento)
  - Preservadas limitações do DDI: `min-width: 120px`, `max-width: 180px`
- **Resultado**: Combobox DDI agora compacto, ajustado ao conteúdo, sem espaço excessivo
- **Validação**: Conforme master_rules.md - CSS centralizado, design responsivo
- **Dependências**: `css/styles.css`

### [2026-03-02 12:21:00] Padronização Final de Comboboxes - Perfil
- **Arquivo editado**: `css/styles.css`
- **Tarefa**: Corrigir espaçamento excessivo e padronizar aparência dos comboboxes
- **Problemas identificados**:
  1. `combobox_token_wrapper` com padding excessivo (8px) e altura maior (45px)
  2. `combobox_input` com fundo transparente e cor de texto diferente do campo e-mail
- **Soluções aplicadas**:
  1. **Espaçamento**: Removido padding do wrapper, ajustado altura para 42px (padrão form-control), borda e cantos arredondados padrão
  2. **Aparência**: `combobox_input` agora com fundo `var(--bg-surface)` e cor `var(--text-muted)` igual ao campo e-mail
  3. **Consistência**: Padding padrão de `0.7rem 1rem` aplicado aos inputs
- **Detalhes técnicos**:
  - `.combobox_token_wrapper`: `padding: 0`, `min-height: 42px`, `border-radius: var(--radius-sm)`
  - `.combobox_input`: `background: var(--bg-surface)`, `color: var(--text-muted)`, `padding: 0.7rem 1rem`
- **Resultado**: Comboboxes agora compactos, sem espaçamento excessivo e com aparência idêntica aos campos form-control padrão
- **Validação**: Conforme master_rules.md - CSS centralizado, design system consistente
- **Dependências**: `css/styles.css`

### [2026-03-02 12:19:00] Otimização de Combobox DDI - Perfil
- **Arquivos editados**: `css/styles.css`, `pages/perfil.php`
- **Tarefa**: Corrigir tamanho, caracteres especiais e lógica de seleção do combobox DDI
- **Problemas identificados**:
  1. Campo `combo_ddi_input` muito grande
  2. Caracteres especiais (¶) appearing nos nomes de países
  3. Seleção mostrava texto completo em vez de apenas DDI
- **Soluções aplicadas**:
  1. **Tamanho**: Adicionada regra CSS específica `#combo_ddi_input` com `min-width: 120px` e `max-width: 180px`
  2. **Caracteres especiais**: Adicionado `mb_convert_encoding()` para garantir encoding UTF-8 correto dos nomes de países
  3. **Lógica de seleção**: Modificado evento click e função `updateLabel` para mostrar apenas o DDI (+57) quando usuário seleciona país
- **Detalhes técnicos**:
  - CSS: Limitação de tamanho do input DDI para 120-180px
  - PHP: `mb_convert_encoding($p['nome'], 'UTF-8', 'UTF-8')` para limpar caracteres
  - JS: Condicional `if (container.attr('id') === 'combo_ddi')` para tratamento específico
- **Resultado**: Combobox DDI agora compacto, sem caracteres especiais e mostrando apenas o código do país
- **Validação**: Conforme master_rules.md - CSS centralizado, sem inline styling, acessibilidade mantida
- **Dependências**: `pages/perfil.php`, `css/styles.css`

### [2026-03-02 12:16:00] Padronização de Bordas em Comboboxes - Perfil
- **Arquivo editado**: `css/styles.css` (estilo .combobox_input)
- **Tarefa**: Adicionar bordas visíveis nos campos combobox que estavam sem bordas
- **Problema identificado**: Os campos "Escolher País...", "Escolher Blockchain..." e "Escolher Exchange..." não tinham bordas visíveis pois o CSS forçava `border: none` no `.combobox_input`
- **Solução aplicada**: 
  - Removido `border: none !important` da regra `.combobox_input` (linha 2508)
  - Mantida regra geral que aplica `border: 1px solid var(--border-heavy) !important` (linha 1469)
  - Agora os comboboxes seguem o mesmo padrão visual dos outros campos form-control
- **Resultado**: Todos os campos de entrada agora têm bordas visíveis e padronizadas
- **Validação**: Conforme master_rules.md - CSS centralizado em styles.css, sem inline styling
- **Dependências**: `pages/perfil.php`, `css/styles.css`

### [2026-03-02 12:14:00] Correção de Desfocamento em Dropdown Modal - Perfil
- **Arquivo editado**: `css/styles.css` (Combobox Modal Effect)
- **Tarefa**: Remover efeito de blur que desfocava toda a tela ao abrir dropdown no modal de perfil
- **Problema identificado**: Quando o dropdown do combobox era aberto, o `.combobox_modal_overlay` aplicava `backdrop-filter: blur(2px)` que desfocava o fundo inteiro
- **Solução aplicada**: 
  - Removido `background-color: rgba(0, 0, 0, 0.2)` → alterado para `rgba(0, 0, 0, 0.0)`
  - Removido `backdrop-filter: blur(2px)` e `-webkit-backdrop-filter: blur(2px)` → alterado para `none`
- **Validação de conformidade master_rules.md**:
  - ✅ **Estrutura HTML**: Sem tags `<html>`, `<head>`, `<body>` em sub-página
  - ✅ **Semântica W3C**: Uso correto de `<section>`, `<main>`, `<header>`, `<article>`
  - ✅ **ARIA**: Modal com `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, botões com `aria-label`
  - ✅ **CSS Inline**: Mínimo e justificado (apenas para valores dinâmicos PHP)
  - ✅ **Acessibilidade**: `role="progressbar"`, `aria-label` em inputs, `aria-hidden` em ícones
- **Resultado**: Dropdown agora abre sem desfocar o fundo, mantendo usabilidade e acessibilidade
- **Dependências**: `pages/perfil.php`, `css/styles.css`

### [2026-03-02 12:11:00] Atualização Completa dos Workflows Windsurf
- **Arquivos criados**: 
    - `.windsurf/workflows/criacao.md` (Workflow para criação)
    - `.windsurf/workflows/modificacao.md` (Workflow para modificação)
    - `.windsurf/workflows/finalizacao.md` (Workflow para finalização)
    - `.windsurf/workflows/leitura-obrigatoria.md` (Workflow obrigatório inicial)
    - `.windsurf/workflows/README.md` (Guia completo dos workflows)
- **Arquivo editado**: `.windsurf/workflows/review.md` (Atualizado para manter consistência)
- **Tarefa**: Implementar sistema completo de workflows padronizados seguindo as diretrizes do master_rules.md, com leitura obrigatória de regras, fluxos específicos para cada tipo de tarefa e automação de processos via PowerShell.
- **Resumo**: Criação de 5 workflows estruturados que garantem conformidade total com as regras do CanalQb, incluindo validação de sintaxe PHP para Windows, organização de arquivos, documentação automática e checklists de qualidade obrigatórios.
- **Dependências**: `regras/master_rules.md`, `regras/log_solucoes.md`

### [2026-03-02 12:16:00] Proteção de Regras e Diretrizes LLM
- **Arquivo editado**: `regras/master_rules.md`
- **Tarefa**: Implementar a "Regra 1" de Proteção de Regras, proibindo explicitamente que LLMs alterem, renomeiem ou excluam qualquer arquivo dentro da pasta `regras/` de forma autônoma (sem pedido explícito).
- **Resumo**: Estabelecimento de um bloqueio de escrita automática em arquivos de normas para garantir a integridade do sistema de regras centralizado.
- **Dependências**: `regras/master_rules.md`

### [2026-03-02 10:35:00] Reorganização Logística e Norma ABNT 2026
- **Arquivos criados**: `regras/prompts_php/abnt_document_rules_2026.md`, `regras/templates/Prompt/abnt_document_rules_2026.md`
- **Arquivo editado**: `regras/master_rules.md`
- **Tarefa**: Reestruturação de pastas em `regras/` por categorias (`prompts_php`, `templates_php`, `prompt_de_llms`, `templates/Prompt`) para automação de leitura recursiva e implementação da Norma ABNT 2026.
- **Resumo**: Movimentação massiva de manuais e templates para subpastas organizadas. O `master_rules.md` agora obriga varredura recursiva em todas as subpastas.
- **Dependências**: `regras/master_rules.md`, `regras/prompts_php/*`

### [2026-03-02 11:45:00] Limpeza Final e Reestruturação Lógica
- **Arquivos reorganizados**: Movimentação total de `templates/`, `{{Readmes}}.md/`, `Prompt/` e arquivos da raiz para subpastas qualificadas (`prompts_php`, `templates_php`, `prompt_de_llms`).
- **Arquivo editado**: `regras/master_rules.md` (Simplificação e obrigatoriedade de leitura recursiva).
- **Tarefa**: Limpeza de pastas residuais e consolidação de diretrizes de desenvolvimento, exemplos e configurações de sistema operacional.
- **Resumo**: O diretório `regras/` agora contém apenas 3 subpastas lógicas e os logs/master_rules na raiz.
- **Dependências**: `regras/*`

### [2026-03-02 11:48:00] Formalização da Regra de Soluções no Master Rules
- **Arquivo editado**: `regras/master_rules.md`
- **Tarefa**: Reintrodução da regra inegociável que obriga LLMs a salvarem arquivos de teste, debug e fix na pasta `solucoes/` seguindo a estrutura modular do projeto.
- **Resumo**: Garantia de que arquivos temporários ou de diagnóstico não poluam a raiz e sejam devidamente documentados.
- **Dependências**: `regras/prompts_php/SISTEMA_MODULAR.md`

### [2026-03-02 11:55:00] Inclusão de Workflow de IA e Inventário Detalhado
- **Arquivo editado**: `regras/master_rules.md`
- **Tarefa**: Reestruturação da "Regra 1" para obrigar o ciclo de vida completo (Leitura -> Workflows -> Revisão -> Entrega). Inclusão de um inventário completo de todos os arquivos de regras e templates para facilitar a leitura por LLMs.
- **Resumo**: Garantia de que cada regra (.md) e template do projeto seja formalmente reconhecido e aplicado durante o desenvolvimento.
- **Dependências**: `regras/**/*`

### [2026-03-02 12:00:00] Padronização Global de Nomenclatura e Comando de Terminal
- **Arquivo editado**: `regras/master_rules.md`, `regras/**/*` (renomeação massiva).
- **Novo arquivo**: `regras/prompt_de_llms/regra_llms_comandos_proibidos.md`.
- **Tarefa**: Padronização total de nomes de arquivos para precisão (ex: `regra_llms_...`, `regra_php_...`, `estrutura_php_...`). Implementação da Regra 3 para registro obrigatório de falhas de comandos no terminal (incompatibilidade de ambiente).
- **Resumo**: O sistema agora possui uma nomenclatura auto-explicativa e um mecanismo de "memória de erros" para evitar que LLMs repitam comandos que falham no sistema Windows/XAMPP.
- **Dependências**: `regras/*`

- 10/08/2026 — Correção de acentuação: comunicação com a impressora (BT e IP) agora usa CP850 (single-byte) em vez de UTF-8, corrigindo caracteres inválidos (ex.: 'Série' no teste de impressão)
- 10/08/2026 — Splash: fundo preto + duração 1ms + ícone transparente (nenhuma imagem antes do vídeo 9:16 corrigido)
- 10/08/2026 — Drawer: 'Teste de Impressão' só aparece com impressora conectada
- 10/08/2026 — UI: campos de 44→38dp, paddings reduzidos, barra de rolagem suave custom (SmoothScrollbar) nas listas de Parâmetros, Perfis e listbox de comandos
- 10/08/2026 — MOJIBAKE corrigido na origem: MainActivity.kt estava salvo com texto duplicado em UTF-8 (UTF-8 decodificado como Windows-1252 e re-encodado). Aplicada correção retroativa CP1252->UTF-8; backup: MainActivity.kt.bak_mojibake
