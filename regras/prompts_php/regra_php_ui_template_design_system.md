# 🎨 Regra PHP: Design System Universal (LLM UI Template Pro)

Esta regra estabelece o sistema de design obrigatório para todos os novos elementos e páginas do projeto. O objetivo é garantir consistência visual, acessibilidade WCAG 2.1 AA e suporte nativo a temas (Claro/Escuro) através de tokens semânticos.

---

## 🎯 1. Objetivo (REGRA DE OURO)
**O LLM deve obrigatoriamente usar este template como base para cada nova página criada, aplicando-o a cada elemento e respeitando sempre a função de tema claro e tema escuro.** Este sistema permite que um administrador edite propriedades como tamanho de fonte, cores e fundos globalmente através das variáveis CSS definidas.

---

## 🏗️ 2. Estrutura HTML (DOM)
**Apenas o arquivo `index.php` possui as tags `<html>`, `<head>` e `<body>`.** Todas as outras páginas são componentes injetados e **NUNCA** devem conter as tags citadas, apenas o conteúdo (`.container`, `.row`, etc.).

## 🎨 3. CSS Centralizado (styles.css)
**É terminantemente proibido o uso de CSS inline ou blocos `<style>` dentro da página (dentro do HTML), a menos que o usuário solicite explicitamente.** Todo e qualquer estilo visual deve ser adicionado ao arquivo `css/styles.css` do projeto para garantir a manutenção e performance.

---

## 🛠️ 4. Tokens de Design (Variáveis CSS)

Todas as cores e medidas devem ser referenciadas via variáveis CSS (`var(--nome-da-variavel)`) para permitir a personalização centralizada.

### Cores Semânticas
- `--color-primary`: Cor de ação principal.
- `--color-secondary`: Ação alternativa.
- `--color-accent`: Destaques e avisos.
- `--color-destructive`: Erros e perigo.
- `--color-background`: Fundo da página.
- `--color-foreground`: Texto principal.
- `--color-card`: Fundo de containers.
- `--color-border`: Bordas e divisores.

### Tipografia e Espaçamento
- `--font-family`: Fonte principal do sistema.
- `--font-size-base`: 16px (base para cálculos `rem`).
- `--space-md`: 1.5rem (24px - unidade padrão de respiro).
- `--radius-lg`: 0.75rem (12px - arredondamento padrão).

---

## 📄 5. Template Base (HTML/CSS) - APENAS REFERÊNCIA
**Atenção:** O código abaixo demonstra a estrutura de tokens e funcionamento. Ao criar arquivos em `/pages/`, respeite a **Regra 2 (Estrutura HTML)**: ignore as tags estruturais (`html`, `head`, `body`) e implemente apenas o conteúdo visual.

---

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="LLM UI Template Pro - Sistema de Design Completo para Geração de Componentes UI">
    <title>LLM UI Template Pro - Design System Completo</title>
    
    <style>
        /* ═══════════════════════════════════════════════════════════════════════════════
           DESIGN SYSTEM - VARIÁVEIS CSS (TOKENS)
           ═══════════════════════════════════════════════════════════════════════════════ */

        :root {
            /* CORES SEMÂNTICAS */
            --color-primary: #2563eb;
            --color-primary-foreground: #ffffff;
            --color-secondary: #64748b;
            --color-secondary-foreground: #ffffff;
            --color-accent: #f59e0b;
            --color-accent-foreground: #ffffff;
            --color-destructive: #dc2626;
            --color-destructive-foreground: #ffffff;
            --color-muted: #e2e8f0;
            --color-muted-foreground: #64748b;
            --color-card: #ffffff;
            --color-card-foreground: #1e293b;
            --color-background: #ffffff;
            --color-foreground: #1e293b;
            --color-border: #e2e8f0;
            --color-input: #f1f5f9;
            --color-ring: #2563eb;

            /* ESPAÇAMENTO (4px base unit) */
            --space-xs: 0.5rem;      /* 8px */
            --space-sm: 1rem;        /* 16px */
            --space-md: 1.5rem;      /* 24px */
            --space-lg: 2rem;        /* 32px */
            --space-xl: 3rem;        /* 48px */

            /* TIPOGRAFIA */
            --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            --font-size-xs: 0.75rem;    /* 12px */
            --font-size-sm: 0.875rem;   /* 14px */
            --font-size-base: 1rem;     /* 16px */
            --font-size-lg: 1.125rem;   /* 18px */
            --font-size-xl: 1.25rem;    /* 20px */
            --font-size-2xl: 1.5rem;    /* 24px */
            --font-size-3xl: 1.875rem;  /* 30px */

            /* RAIOS DE BORDA */
            --radius-sm: 0.375rem;      /* 6px */
            --radius-md: 0.5rem;        /* 8px */
            --radius-lg: 0.75rem;       /* 12px */

            /* SOMBRAS */
            --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
            --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

            /* TRANSIÇÕES */
            --transition-fast: 150ms ease-in-out;
            --transition-base: 200ms ease-in-out;
            --transition-slow: 300ms ease-in-out;
        }

        /* TEMA ESCURO */
        [data-theme="dark"] {
            --color-background: #0f172a;
            --color-foreground: #f1f5f9;
            --color-card: #1e293b;
            --color-card-foreground: #f1f5f9;
            --color-border: #334155;
            --color-input: #1e293b;
            --color-muted: #334155;
            --color-muted-foreground: #cbd5e1;
        }

        /* RESET E ESTILOS GLOBAIS */
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: var(--font-family);
            font-size: var(--font-size-base);
            color: var(--color-foreground);
            background-color: var(--color-background);
            transition: background-color var(--transition-base), color var(--transition-base);
        }
    </style>
</head>
<body data-theme="light">
    <!-- Componentes aqui usando var(--token) -->
</body>
</html>
```

---

## 🚫 4. Restrições e Proibições
1. **PROIBIDO** usar cores *hardcoded* (ex: `#fff`, `red`, `blue`) fora das definições `:root`.
2. **PROIBIDO** definir `font-size` em `px` fixos nos elementos; use a escala de `rem/tokens`.
3. **OBRIGATÓRIO** manter a conformidade com a função de troca de tema (`data-theme="light|dark"`).
4. **OBRIGATÓRIO** usar nomes de classes semânticas que descrevam a função, não a aparência.

---

## ⚖️ 5. Checklist de Entrega
- [ ] O componente usa variáveis CSS para cores?
- [ ] O componente usa a escala de espaçamento sm/md/lg?
- [ ] O contraste de texto atende WCAG 2.1 AA?
- [ ] O design funciona corretamente no tema escuro?
