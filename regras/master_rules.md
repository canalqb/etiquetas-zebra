# 🧩 Master Rules - Protocolo Central @CanalQb

ESTE ARQUIVO É O PONTO DE PARTIDA OBRIGATÓRIO PARA QUALQUER IA OU DESENVOLVEDOR.

## 🎯 1. Proteção de Regras e Diretrizes LLM
- **PROIBIÇÃO DE ALTERAÇÃO AUTÔNOMA**: Nunca é permitido alterar, excluir ou renomear nenhum arquivo ou documento dentro da pasta `regras/` sem a solicitação ou autorização explícita do usuário.
- **APLICAÇÃO**: Esta regra deve ser aplicada de forma absoluta em todas as diretrizes, workflows e rules do LLM que estiver atuando no projeto.

---

## 🎯 2. Regra de Ouro (Leitura, Workflows e Entrega)
O LLM deve **obrigatoriamente** seguir o seguinte fluxo antes, durante e após qualquer tarefa:
1. **Leitura Recursiva**: Varrer e ler todos os arquivos `.md` em todas as subpastas de `regras/`.
2. **Aplicação de Diretrizes**: Seguir as diretrizes de sistema, workflows de IA e regras de OS contidas em `regras/prompt_de_llms/`.
3. **Criação e Revisão**: Desenvolver o script seguindo os padrões semânticos e de acessibilidade, revisar contra os checklists de `regras/prompts_php/` (especialmente o **LLM UI Template Pro**) e validar o layout com os modelos em `regras/templates_php/`.
4. **Mandato de Design System**: Para cada nova página criada, o LLM deve obrigatoriamente usar o template de `regra_php_ui_template_design_system.md` como base, aplicando-o a cada elemento e respeitando as funções de tema claro/escuro. Isso permite que o administrador edite fontes, cores e fundos globalmente.
5. **CSS Centralizado**: É terminantemente proibido o uso de CSS inline ou blocos `<style>` dentro dos arquivos PHP de páginas, a menos que solicitado explicitamente pelo usuário. Todo estilo novo deve ser alimentado no arquivo `css/styles.css` do site.
6. **ARIA Obrigatório**: Todo modal DEVE conter `role="dialog"`, `aria-modal="true"` e `aria-labelledby` apontando para o ID do título. Botões de fechar DEVEM ter `aria-label="Fechar"`.
7. **Entrega Documentada**: Só entregar o script após garantir conformidade total e registrar a solução nos logs.
8. **Proibição de Elementos Escuros em Tema Claro**: É estritamente PROIBIDO o uso de classes de fundo estáticas (ex: `bg-dark`, `bg-black`, `text-white`) associados a inputs, stat-pills, badges ou modais em páginas fluidas. Use as classes responsivas do tema (ex: `bg-surface`, `bg-card` ou nativamente a própria `form-control`) para evitar problemas de inversão de cores (elemento preto no modo claro ou texto branco em fundo branco).
9. **Workflows Windsurf (Obrigatórios)**: Após a leitura do `master_rules.md`, consultar `.windsurf/workflows/leitura-obrigatoria.md` e seguir o workflow específico conforme a natureza da tarefa:
   - Criação: `.windsurf/workflows/criacao.md`
   - Modificação: `.windsurf/workflows/modificacao.md`
   - Finalização: `.windsurf/workflows/finalizacao.md`
   Esses workflows são mandatórios e sobrepõem instruções ad hoc.
10. **Compatibilidade de Terminal (Windows/XAMPP)**: Para leitura/consulta em terminal, EVITAR `Get-Content`. Preferir:
    - `Select-String` para buscas e verificações
    - `Start-Process notepad.exe <arquivo>` para leitura/inspeção
    - Usar apenas comandos nativos de PowerShell/CMD. Nunca usar `sandbox-exec` ou comandos exclusivos de macOS/Linux.

---

## 📐 3. Padronização de Nomes e Novos Arquivos
- **Sempre Nomear Novos Arquivos** seguindo o padrão de precisão:
  - `regra_llms_{os}_{funcionalidade}` (Ex: `regra_llms_windows_powershell.md`)
  - `regra_php_{funcionalidade}` (Ex: `regra_php_ajax_interacoes.md`)
  - `estrutura_php_elemento_{nome}` (Ex: `estrutura_php_elemento_menu.md`)
  - `regra_abnt_{pdf|doc|md}` (Ex: `regra_abnt_doc_2026.md`)
- Se uma categoria nova for necessária, o arquivo deve ser criado com prefixo auto-explicativo.

---

## 🚫 4. Registro de Falhas no Terminal
- **Toda atividade do terminal que apresentar erro por incompatibilidade de ambiente** DEVE ser registrada em `regras/prompt_de_llms/regra_llms_comandos_proibidos.md`.
- **Deve-se incluir**: O nome do LLM (Ex: Trae, Antigravity), o Sistema Operacional e o comando que não deve ser usado.
- **Exemplo**: Se o Trae não puder usar `powershell -Command "Move-Item ..."` em seu terminal interno, esse comando agora é considerado **proibido** para aquele LLM no Windows.

---

## 📂 5. Inventário de Regras e Templates (Nomes Padronizados)

### 📄 Regras de Desenvolvimento (`regras/prompts_php/`)
- [ ] `regra_php_diretrizes_sistema_globais.md`
- [ ] `regra_abnt_doc_2026.md`
- [ ] `regra_php_web_standards_aria_wcag.md`
- [ ] `regra_php_ajax_interacoes.md`
- [ ] `regra_php_ui_checklist_acessibilidade.md`
- [ ] `regra_js_console_silencer_producao.md`
- [ ] `regra_php_arquitetura_modular_pastas.md`
- [ ] `regra_php_integracao_gas_telegram.md`
- [ ] `regra_php_ui_ajax_dinamico_tabelas.md`
- [ ] `regra_php_ui_harmonia_visual.md`
- [ ] `regra_php_formularios_placeholders_senha.md`
- [ ] `regra_php_ui_template_design_system.md`

### 🎨 Modelos e Exemplos (`regras/templates_php/`)
- [ ] `estrutura_abnt_doc_modelo_trabalho.md`
- [ ] `estrutura_php_web_standards_checklist.md`
- [ ] `estrutura_php_workflow_criacao_paginas.md`
- [ ] `estrutura_php_validacao_integridade_sistema.md`
- [ ] `estrutura_php_biblioteca_bootstrap_css_js.md`
- [ ] `estrutura_php_biblioteca_bootstrap_exemplo.php`
- [ ] `estrutura_php_historico_arquitetura_projeto.md`
- [ ] `estrutura_php_exemplo_integracao_gas_telegram.md`
- [ ] `estrutura_php_projeto_completo_cms_saas/`
- [ ] `estrutura_php_elemento_combobox_dinamico/`
- [ ] `estrutura_php_elemento_nav_side/`
- [ ] `estrutura_php_pacote_menu_complexo/`
- [ ] `estrutura_php_pagina_admin_design_system.md`

### 🎨 Design System Pro (TSX/React Reference)
- [ ] `regras/prompts_tsx/regra_tsx_ui_template_design_system.md`
- [ ] `regras/templates_tsx/estrutura_tsx_home_reference.md`

### 🤖 Configurações de IA e OS (`regras/prompt_de_llms/`)
- [ ] `regra_llms_windows_powershel_cmd.md`
- [ ] `regra_llms_comandos_proibidos.md`
- [ ] `regra_llms_handoff_continuidade_projeto.md`
- [ ] `regra_llms_correcao_otimizacao_sistema.md`
- [ ] `regra_llms_historico_escopo_projeto.md`
- [ ] `regra_llms_log_decisoes_tecnicas.md`
- [ ] `regra_llms_estado_projeto_contexto.json`

---

## 🎨 6. Regras Inegociáveis (Resumo)
1. **Sem Alertas**: NUNCA usar `alert()`. Use `showToast()`.
2. **Semântica W3C**: Uso de `<main>`, `<section>`, `<article>` é obrigatório.
3. **Acessibilidade**: ARIA e WCAG AA são obrigatórios.
4. **Estrutura HTML (DOM)**: Apenas o arquivo `index.php` possui as tags `<html>`, `<head>` e `<body>`. Todas as outras páginas são componentes injetados (geralmente dentro de um `<main>` ou `.container`) e NUNCA devem conter estas tags.
5. **Banco de Dados**: Prefixos obrigatórios (`usuarios_main`, `airdrop_main`, etc.).
6. **Soluções**: Arquivos de teste/debug devem estar em `solucoes/` e documentados.
7. **Página Admin Design**: O LLM deve estar ciente da página de administrador (`estrutura_php_pagina_admin_design_system.md`) para editar {fonte tamanho, fonte, cores, fundo do elemento, etc.} para cada elemento de forma global via tokens CSS.
8. **Workflows .windsurf**: É OBRIGATÓRIO seguir os workflows de criação, modificação e finalização localizados em `.windsurf/workflows/` para qualquer entrega.
9. **Windows-First**: Apenas comandos nativos PowerShell/CMD. Evitar `Get-Content` em rotinas de leitura; usar `Select-String` e `Start-Process notepad.exe`. Proibido `sandbox-exec` e comandos Unix-like.

**🚨 ESTE ARQUIVO SOBREPÕE QUALQUER OUTRA REGRA!**
**📖 VARRER RECURSIVAMENTE A PASTA /REGRAS/ ANTES DE QUALQUER AÇÃO!**

---

## 🤖 7. Protocolo de Autocorreção Automática (AUTO-FIX)

> Esta seção define o comportamento OBRIGATÓRIO do LLM ao revisar ou criar qualquer arquivo.
> **Não é necessário que o usuário peça**: o LLM DEVE aplicar estas correções automaticamente.

### 7.1 ❌ Detecção e Correção de CSS Inline / Bloco `<style>`

**Gatilho**: Qualquer atributo `style="..."` encontrado em elemento HTML estático, ou bloco `<style>...</style>` encontrado em arquivo `.php` que não seja o `index.php`.

**Ação Obrigatória**:
1. Criar uma classe CSS com nome semântico no `css/styles.css` (Ex: `.badge-status`, `.airdrop-logo`, `.modal-header-airdrop`)
2. Substituir o `style="..."` ou o bloco `<style>` pela nova classe no arquivo PHP
3. Documentar a migração com comentário no topo do bloco no `styles.css`:
   ```css
   /* MIGRADO DE: pages/nome_arquivo.php — master_rules Regra 2.5 */
   ```
4. Se o valor for dinâmico (ex: `font-weight: ${novo ? '600' : '400'}` via JS), converter para classes CSS condicionais (ex: `fw-semibold` / `fw-normal`)

**Exemplos Comuns de Correção**:

| style inline original | Classe CSS criada |
|---|---|
| `style="font-size: 0.65rem; padding: .4rem .6rem"` | `.badge-status` |
| `style="width:50px; height:50px; object-fit:cover"` | `.airdrop-logo` |
| `style="display:none"` | `.modal-header-hidden` |
| `style="background: var(--modal-header-bg)"` | `.modal-header-themed` |
| `style="cursor:pointer; transition: background 0.2s"` | `.notif-item` |
| `style="font-size:0.55rem; vertical-align:middle"` | `.notif-badge-novo` |

---

### 7.2 ❌ Detecção e Correção de ARIA Ausente em Modais

**Gatilho**: Qualquer `<div class="modal fade"` sem os atributos de acessibilidade.

**Ação Obrigatória** — adicionar SEMPRE:
```html
<div class="modal fade" id="nomeModal" tabindex="-1"
     role="dialog"
     aria-modal="true"
     aria-labelledby="nomeModalTitle">
```

**Regra Complementar**:
- O `<h5>` ou `<h6>` dentro do `.modal-header` DEVE ter `id="nomeModalTitle"` correspondente ao `aria-labelledby`
- Botões de fechar DEVEM ter: `aria-label="Fechar"`
- Spinners DEVEM ter: `role="status"` e `<span class="visually-hidden">Carregando...</span>`

---

### 7.3 ❌ Detecção e Correção de `lang` Incorreto

**Gatilho**: `<html lang="pt-br">` (minúsculo)

**Ação**: Corrigir para `<html lang="pt-BR" data-theme="dark">`

---

### 7.4 ❌ Detecção e Correção de Imagens Sem `alt`

**Gatilho**: Qualquer `<img` sem atributo `alt`.

**Ação**: Adicionar `alt` descritivo e semântico. Se for decorativa: `alt=""`.

---

### 7.5 ❌ Detecção de `<html>`, `<head>` ou `<body>` em Sub-Páginas

**Gatilho**: Qualquer arquivo PHP dentro de `pages/` ou `footer/` que contenha estas tags.

**Ação**: Remover as tags e deixar apenas o conteúdo do componente, sem estrutura HTML completa.

---

### 7.6 ❌ Detecção de `alert()` no JavaScript

**Gatilho**: Qualquer uso de `alert(...)` em arquivos `.js` ou `<script>` em PHP.

**Ação**: Substituir por `showToast(mensagem, tipo)` ou `Swal.fire(...)`, conforme o contexto.

---

### 7.7 📊 Checklist de Autocorreção — Rodar a cada Entrega

Antes de entregar qualquer arquivo PHP ou JS, o LLM deve verificar:

- [ ] **Zero** atributos `style=""` no HTML estático
- [ ] **Zero** blocos `<style>...</style>` na página (exceto `index.php` para tokens dinâmicos via `setProperty`)
- [ ] **Zero** `style=` gerado dinâmicamente via `innerHTML` ou `template literals` no JS
- [ ] **Todos** os modais com `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- [ ] **Todos** os `btn-close` com `aria-label="Fechar"`
- [ ] **Todos** os spinners com `role="status"` e `visually-hidden`
- [ ] **Todas** as imagens com `alt` preenchido
- [ ] `lang="pt-BR"` (maiúsculo) no `<html>`
- [ ] `data-theme="dark"` presente no `<html>` do `index.php`
- [ ] Classes do Design System usadas (tokens `--color-primary`, `--bg-surface`, etc.)
- [ ] Nenhuma tag `<html>`, `<head>`, `<body>` em sub-páginas

---

**🚨 ESTE ARQUIVO SOBREPÕE QUALQUER OUTRA REGRA!**
**📖 VARRER RECURSIVAMENTE A PASTA /REGRAS/ ANTES DE QUALQUER AÇÃO!**
