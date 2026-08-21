# 🚫 Comandos Proibidos e Falhas de Terminal

Este arquivo registra comandos que falharam em LLMs específicos devido a restrições de ambiente (Windows/XAMPP/Terminal específico). QUALQUER LLM deve consultar este arquivo antes de executar comandos e DEVE registrar novas falhas aqui.

## 📋 Registro de Falhas

| LLM | OS | Comando Proibido / Que Falhou | Motivo / Erro |
|-----|----|-------------------------------|---------------|
| Trae | Windows | `powershell -Command "Move-Item ..."` | Falha de permissão/sintaxe no terminal interno do Trae. |
| Antigravity | Windows | `sandbox-exec` | Comando exclusivo de macOS/Linux, inexistente no Windows. |

## 🛠️ Regra de Registro
Se um comando falhar no terminal:
1. Identifique o nome do seu LLM.
2. Identifique o sistema operacional.
3. Adicione o comando exato à tabela acima.
4. Descreva brevemente o erro.
5. Busque uma alternativa compatível (ex: CMD em vez de PowerShell, ou vice-versa).
