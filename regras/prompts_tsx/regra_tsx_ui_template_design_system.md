# LLM UI Template Pro - Complete Documentation & Prompt Guide

A comprehensive, production-ready design system and UI component reference built with React 19, Tailwind CSS 4, and shadcn/ui. Specifically designed to serve as a reference for Large Language Models (LLMs) when generating consistent, accessible, and beautiful UI components.

---

## 🎨 DESIGN SYSTEM OVERVIEW

**Key Features:**
- Complete design system with semantic color tokens
- WCAG 2.1 AA accessibility by default
- Mobile-first responsive design
- Light/dark theme support
- Comprehensive documentation for LLM prompting
- Pre-built component examples and patterns
- Smooth animations and transitions

### 🛠️ Stack Overview
- **Framework**: React 19 with TypeScript
- **Styling**: Tailwind CSS 4 with CSS variables for theming
- **Components**: shadcn/ui (Radix UI + Tailwind)
- **Routing**: Wouter (lightweight client-only routing)
- **Icons**: Lucide React (clean, consistent icon set)
- **Design Tokens**: CSS variables in `client/src/index.css` (light/dark theme support)

---

## 📚 LLM PROMPT GUIDE - UI Component Generation

This guide provides instructions for Large Language Models to generate UI components that align with the design system and maintain consistency across the project.

### Quick Reference: Color System
**Always use semantic color pairs:**
- `primary` / `primary-foreground` - Main actions
- `secondary` / `secondary-foreground` - Alternative actions
- `accent` / `accent-foreground` - Highlights
- `destructive` / `destructive-foreground` - Danger/errors
- `muted` / `muted-foreground` - Disabled/secondary
- `card` / `card-foreground` - Containers
- `background` / `foreground` - Page base
- `border` - Dividers
- `input` - Form inputs
- `ring` - Focus states

### Quick Reference: Spacing Scale
**Use 4px-based units consistently:**
- `xs` = 8px (0.5rem)
- `sm` = 16px (1rem)
- `md` = 24px (1.5rem)
- `lg` = 32px (2rem)
- `xl` = 48px (3rem)

### Component Patterns: Button Component
```tsx
// ✅ Correct: All variants and states
<Button>Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button disabled>Disabled</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button>
  <Icon className="mr-2 h-4 w-4" />
  With Icon
</Button>
```

---

## 📅 Accessibility Checklist
When generating components, ensure:
- [ ] **Labels**: All form inputs have associated `<label>` elements
- [ ] **ARIA**: Use `aria-*` attributes for complex interactions
- [ ] **Focus**: All interactive elements have visible focus states
- [ ] **Contrast**: Text meets 4.5:1 contrast ratio (normal) or 3:1 (large)
- [ ] **Keyboard**: All functionality accessible via keyboard
- [ ] **Semantic HTML**: Use proper heading hierarchy (h1, h2, h3)
- [ ] **Alt Text**: All images have descriptive alt text
- [ ] **Error Messages**: Form errors are announced to screen readers

---

## 🎨 Design Philosophy
1. **Semantic Colors** - Use meaningful color tokens that adapt to light/dark themes
2. **Consistent Spacing** - 4px-based scale creates visual rhythm and alignment
3. **Clear Hierarchy** - Typography and color guide user attention effectively
4. **Accessibility First** - WCAG 2.1 AA compliance built into every component
5. **Responsive by Default** - Mobile-first approach with thoughtful breakpoints
6. **Smooth Interactions** - 200-300ms transitions create responsive, polished feel
7. **Component Reuse** - Leverage shadcn/ui and existing patterns instead of rebuilding
8. **CSS Centralizado** - É terminantemente proibido o uso de estilos inline (`style={{...}}`) ou blocos `<style>` em componentes TSX, a menos que o usuário peça explicitamente. Prefira sempre classes Tailwind ou adicione estilos globais em `client/src/index.css`.
