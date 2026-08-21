# 🎨 Estrutura PHP: Página de Administração do Design System

Este modelo define a interface administrativa para edição dinâmica dos tokens de design (CSS Var) do **LLM UI Template Pro**.

---

## 🏗️ 1. Estrutura do Arquivo `pages/admin_design_system.php`

```php
<?php
/**
 * pages/admin_design_system.php
 * Interface para edição dos tokens de Design System
 */
?>
<main class="container py-5">
    <section class="card shadow-md">
        <header class="card-header">
            <h1 class="card-title">Configurações de Design (Admin)</h1>
            <p class="card-description">Ajuste os tokens visuais globais do sistema. As alterações afetam todas as páginas.</p>
        </header>

        <form id="adminDesignForm" class="card-content">
            <div class="grid grid-2">
                <!-- Cores -->
                <fieldset class="border p-md rounded mb-md">
                    <legend class="px-sm font-bold">Cores Semânticas</legend>
                    <div class="form-group">
                        <label for="primaryColor">Cor Primária</label>
                        <input type="color" id="primaryColor" name="primaryColor" value="#2563eb">
                    </div>
                    <div class="form-group">
                        <label for="secondaryColor">Cor Secundária</label>
                        <input type="color" id="secondaryColor" name="secondaryColor" value="#64748b">
                    </div>
                </fieldset>

                <!-- Tipografia -->
                <fieldset class="border p-md rounded mb-md">
                    <legend class="px-sm font-bold">Tipografia e Escala</legend>
                    <div class="form-group">
                        <label for="baseFontSize">Tamanho Base da Fonte</label>
                        <select id="baseFontSize" name="baseFontSize">
                            <option value="14px">14px (Pequeno)</option>
                            <option value="16px" selected>16px (Padrão)</option>
                            <option value="18px">18px (Grande)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="fontFamily">Família de Fontes</label>
                        <select id="fontFamily" name="fontFamily">
                            <option value="Inter, sans-serif">Inter (Moderno)</option>
                            <option value="Georgia, serif">Georgia (Elegante)</option>
                            <option value="monospace">Monospace (Técnico)</option>
                        </select>
                    </div>
                </fieldset>
            </div>

            <footer class="flex justify-end gap-sm mt-md">
                <button type="reset" class="btn btn-outline">Descartar</button>
                <button type="submit" class="btn btn-default">Salvar Alterações</button>
            </footer>
        </form>
    </section>
</main>

<script>
(function() {
    $('#adminDesignForm').on('submit', function(e) {
        e.preventDefault();
        // Lógica de salvamento via AJAX para persistência no banco de dados ou CSS dinâmico
        alert('Configurações salvas com sucesso (Simulação)');
    });
})();
</script>
```

---

## 🎯 2. Integração com o Tema
A página deve refletir instantaneamente as mudanças nas variáveis `:root` para fins de pré-visualização.

```javascript
// Exemplo de atualização de preview em tempo real
$('#primaryColor').on('input', function() {
    document.documentElement.style.setProperty('--color-primary', $(this).val());
});
```

---

## ⚖️ 3. Regras de Estilização
- **Fundo do Elemento**: Deve usar `var(--color-card)` ou `var(--color-background)`.
- **Contraste**: O script de salvamento deve validar se a cor escolhida mantém contraste legível contra o fundo.
