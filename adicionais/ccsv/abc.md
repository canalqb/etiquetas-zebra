# Plano de implementação: importador de CSV e scanner de séries

Oct 9, 2026 · @Rodrigo Moraes

## 1. Arquitetura

O sistema tem duas telas e um módulo de armazenamento compartilhado. A lista e as leituras ficam no navegador, em IndexedDB, e a conferência de cada série é feita localmente, sem rede.

- `importar.html`: carrega o CSV e mostra um resumo para conferência.
- `scanner.html`: faz a leitura, a comparação e a exportação.
- `storage.js`: usado pelas duas páginas; é o único lugar que lê e grava dados, o que permite trocar o armazenamento depois sem mexer nas telas.

**Onde guardar os dados.** Use IndexedDB para a lista de séries e as leituras. O `localStorage` tem limite de cerca de 5 MB, é síncrono e trava a tela com listas grandes; ele fica só para configurações pequenas, como delimitador e coluna escolhida.

**Cuidado com `file://`.** Abrir os arquivos direto do disco pode fazer cada página ter seu próprio armazenamento, e a lista importada não apareceria no scanner. Hospede os arquivos (GitHub Pages, por exemplo), use um servidor local, ou reúna tudo em um único HTML com duas telas (Importar e Escanear), que elimina o problema.

## 2. Modelo de dados

Quatro conjuntos de dados bastam; as três listas de saída são calculadas a partir deles, sem tabela própria.

| Dado | Conteúdo |
| --- | --- |
| `lista` | Série normalizada → série original, para exportar do jeito que veio |
| `leituras` | `id`, série normalizada, original, horário e status |
| `status` | `encontrada` ou `fora_da_lista` |
| `config` | Delimitador, coluna usada, nome do arquivo e data da importação |

A normalização é a mesma do scanner anterior: remove espaços e caracteres invisíveis e converte para maiúsculas.

**Saídas derivadas:**

- Localizadas: séries da lista que foram lidas.
- Fora da lista: séries lidas que não existem na lista.
- Não localizadas: a lista menos as localizadas.

## 3. Página de importação

A importação precisa dar ao usuário um resumo confiável antes de salvar, para que erros de arquivo apareçam antes da conferência começar.

1. Campo de arquivo e arrastar e soltar, lidos com `FileReader`.
2. Detecção do delimitador (`;`, `,` ou tab) e da codificação: tenta UTF-8 e usa Windows-1252 se aparecerem caracteres quebrados.
3. Pré-visualização das primeiras linhas, com escolha da coluna das séries e a opção "primeira linha é cabeçalho".
4. Resumo antes de salvar: total de linhas, linhas vazias ignoradas, duplicadas e total de séries únicas.
5. Botões "Salvar lista" (substitui a anterior após confirmação) e "Limpar tudo".
6. Parser próprio e pequeno, que trate aspas, vírgula dentro de campo e quebras de linha, sem dependências externas.

## 4. Página do scanner

O foco no campo de leitura nunca pode sair, e cada leitura precisa responder de forma instantânea.

**Regra central do foco**

- O campo recebe foco ao abrir a página.
- Um evento `blur` devolve o foco ao campo, com pequeno atraso.
- Todo botão devolve o foco ao campo depois do clique.
- Não usar `alert`, `confirm` ou `prompt` durante a leitura, pois roubam o foco.

**Fluxo de cada leitura (Enter do leitor)**

1. Lê o valor, normaliza e consulta a lista no `Set`.
2. Se existe, toca o bipe positivo e marca azul. Se não existe, toca dois bipes curtos e marca vermelho.
3. Mostra o resultado grande e grava a leitura no IndexedDB de forma assíncrona, sem atrasar a próxima.
4. Mantém a série no campo e chama `select()`: a próxima leitura sobrescreve a anterior.
5. Atualiza os contadores: lidas, localizadas, fora da lista e faltando.

**Detalhes**

- Áudio: reaproveitar os sons do scanner anterior (Web Audio). O contexto é liberado no primeiro Enter ou no botão "Iniciar sessão".
- Se o leitor não enviar Enter, oferecer um modo opcional que valida após uma pausa na digitação (por exemplo, 150 ms sem teclas).
- Botão para desfazer a última leitura, para quando se bipa errado.
- Histórico com as últimas 50 leituras na tela; a lista inteira fica só no banco, para não pesar.
- Série repetida precisa de uma regra definida (ver Decisões em aberto).
