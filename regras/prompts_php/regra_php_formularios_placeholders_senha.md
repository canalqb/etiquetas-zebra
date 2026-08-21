# Regra PHP: Elementos de Formulário, Placeholders e Campos de Senha

Este documento estabelece as regras para o uso de placeholders e a implementação obrigatória de campos de senha com alternância de visibilidade no projeto @CanalQb.

## 1. Uso de Placeholders (HTML5)

Os placeholders devem ser usados para fornecer uma dica curta sobre o valor esperado no campo, melhorando a experiência do usuário.

### Elementos que suportam placeholder:
- `<input>`
- `<textarea>`

### Tipos de `<input>` que suportam placeholder:
- `text`
- `search`
- `url`
- `tel`
- `email`
- `password`
- `number`

## 2. Implementação de Campos de Senha (Obrigatório)

Para qualquer campo de entrada de senha, deve-se utilizar obrigatoriamente o template abaixo. Este modelo garante consistência visual e funcional (alternância de visibilidade exibir/ocultar senha).

### Modelo HTML (Template):
```html
<div class="mb-3">
  <label for="password" class="form-label">Senha</label>
  <div class="input-group">
    <input
      type="password"
      class="form-control"
      id="password"
      name="password"
      placeholder="Digite sua senha"
      required
    />
    <span class="input-group-text toggle-password" data-target="#password">
      <i class="fas fa-eye"></i>
    </span>
  </div>
</div>
```

### Arquivos de Suporte e Integração:
- **CSS**: Os estilos básicos do campo e do botão de alternância estão em `css/styles.css` (classe `.toggle-password`).
- **JavaScript**: A lógica de alternância está centralizada em `js/form-utils.js`.
- **Bibliotecas**: Requer Bootstrap 5 e Font Awesome 5/6 (já inclusos no `index.php`).

## 3. Diretrizes Adicionais
- Sempre utilize `type="password"` inicialmente.
- O ícone deve alternar entre `fa-eye` (oculto) e `fa-eye-slash` (visível).
- Garanta que o atributo `id` do input corresponda ao `data-target` no span para que o script funcione corretamente.
