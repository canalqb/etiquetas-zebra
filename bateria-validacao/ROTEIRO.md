# Bateria de Validação Física — CanalQb Impressão em Zebras

> **Pedido 1.225 (pendência A2)** — pacote de etiquetas de teste para a validação
> física na impressora real (pendência **U1**). A partir daqui basta **imprimir e
> conferir**: cada arquivo em `zpl/` imprime UMA etiqueta de teste.
>
> Bateria genérica para a **frota** (decisão de 13/10/2026): nada aqui depende de
> IP, hostname ou certificado de uma unidade específica. A ZT411 de teste
> (`10.112.105.62`, 203 dpi, mídia 100×50 mm, sensor GAP) foi a primeira
> validadora — a mesma bateria serve para qualquer modelo com ZPL II.

## Como as etiquetas são identificadas

Cada etiqueta imprime no canto superior esquerdo o **ID do caso** em texto grande
(ex.: `A01`) e a **descrição** logo abaixo (ex.: `Code 128 WYSIWYG`).
As etiquetas usam `^PW800` × `^LL400` (100×50 mm a 203 dpi).

## Como imprimir (um arquivo por vez)

### Opção 1 — PowerShell direto na porta RAW 9100 (recomendada)

```powershell
$ip   = "IP_DA_IMPRESSORA"   # use o botão "Procurar impressoras na rede" do app para achar
$arq  = "C:\xampp\htdocs\zebra\bateria-validacao\zpl\a01-code-128-wysiwyg.zpl"
$zpl  = [IO.File]::ReadAllBytes($arq)   # C03/C04 dependem dos bytes UTF-8: NÃO converta para texto
$cli  = New-Object Net.Sockets.TcpClient($ip, 9100)
$cli.GetStream().Write($zpl, 0, $zpl.Length)
$cli.Close()
Start-Sleep -Seconds 8   # IMPORTANTE: rajadas com menos de ~8 s descartam etiquetas (teste real 13/10)
```

> Alternativa: `testeemzebrareal/imprimir-zpl.ps1` já encapsula o envio.
> **Modo Protegido** bloqueia SGD `! U1` na unidade de teste → a conferência é
> **visual + leitora de código**, sem validação automática por odômetro.

### Opção 2 — pelo próprio app (validação extra)

Use **Carregar ZPL** para abrir o `.zpl` no editor e imprimir pela conexão
normal. Isso exercita também o *parser* do app (round-trip), mas lembre que o app
re-gera o ZPL na impressão — para validar a bateria **como gerada**, use a Opção 1.

## Grupo A — Códigos de barras 1D (8 casos)

| Caso | Arquivo | O que a leitora deve ler | O que conferir a olho |
|---|---|---|---|
| A01 | `a01-code-128-wysiwyg.zpl` | `12345678` | Altura/proporção do código igual ao preview do app (**WYSIWYG v1.028 por módulos reais**) |
| A02 | `a02-gs1-128-modo-d-ais-fixos.zpl` | `(01)09506000134307(17)261231` | Etiqueta de ID `A02`; AIs de tamanho fixo sem separador |
| A03 | `a03-gs1-128-ai-variavel-maior-que-8.zpl` | `(01)09506000134307(10)ABC123(17)261231` | FNC1 (`>8`) depois do AI variável (10); leitora em modo GS1 mostra os AIs |
| A04 | `a04-ean-13.zpl` | `5901234123457` | Código EAN-13 centralizado, legenda abaixo |
| A05 | `a05-ean-13-add-on-2.zpl` | `5901234123457` + suplemento `12` | **Add-on +2 à direita**, menor, sem encostar no código principal (offsets `^BS`) |
| A06 | `a06-ean-13-add-on-5.zpl` | `5901234123457` + suplemento `51234` | **Add-on +5 à direita**, 5 dígitos |
| A07 | `a07-upc-a-add-on-5.zpl` | `036000291452` + suplemento `51234` | UPC-A clássico + add-on; número de dígitos correto |
| A08 | `a08-ean-8-add-on-2.zpl` | `96385074` + suplemento `12` | EAN-8 + add-on à direita |

## Grupo B — 2D, GS1 e DataBar (14 casos)

| Caso | Arquivo | O que a leitora deve ler | O que conferir |
|---|---|---|---|
| B01 | `b01-qr-correcao-q.zpl` | `B01-VALIDACAO-FISICA` | QR legível, quadrado, com margem silenciosa |
| B02 | `b02-qr-correcao-h.zpl` | `B02-VALIDACAO-FISICA` | Nível **H (30%)**: padrão mais denso que o B01 |
| B03 | `b03-qr-correcao-m.zpl` | `B03-VALIDACAO-FISICA` | Nível **M (15%)** |
| B04 | `b04-qr-correcao-l.zpl` | `B04-VALIDACAO-FISICA` | Nível **L (7%)**: padrão mais aberto |
| B05 | `b05-gs1-qr-separador-1d.zpl` | `(01)09506000134307(10)ABC123(17)261231` | Separador **GS (ASCII 29)** entre AI variável e o próximo (o ZPL usa `^FH` + `_1D`); leitora em modo GS1 |
| B06 | `b06-gs1-datamatrix-separador.zpl` | `(01)09506000134307(10)ABC123(17)261231` | Mesma leitura GS1, símbolo DataMatrix |
| B07 | `b07-databar-omni-tipo-1.zpl` | `(01)01234567890128` | DataBar omnidirecional: barras altas nas duas pontas |
| B08 | `b08-databar-truncado-tipo-2.zpl` | `(01)01234567890128` | **Truncado**: altura menor no meio |
| B09 | `b09-databar-empilhado-tipo-3.zpl` | `(01)01234567890128` | **Empilhado**: 2 fileiras com separador |
| B10 | `b10-databar-empilhado-omni-tipo-4.zpl` | `(01)01234567890128` | **Empilhado omnidirecional**: fileiras + pontas altas |
| B11 | `b11-databar-limited-tipo-5.zpl` | `(01)03123456789012` | **Limited**: formato curto próprio |
| B12 | `b12-databar-expandido-tipo-6.zpl` | `(01)03512345000019(15)20251231` | **Expandido**: AIs encadeados (01 + 15) |
| B13 | `b13-databar-expandido-empilhado-seg-4.zpl` | `(01)03512345000019(15)20251231` | Expandido empilhado: **2 fileiras de 4 segmentos** |
| B14 | `b14-microqr-grafico-gfa.zpl` | `MICRO-123` | **MicroQR como gráfico** (`^GFA` — não existe comando nativo); exige leitora com suporte a MicroQR |

## Grupo C — Modos de impressão e acentos (4 casos)

| Caso | Arquivo | O que conferir |
|---|---|---|
| C01 | `c01-horizontal-modo-imagem-raster.zpl` | Etiqueta inteira em **modo imagem** (`^GFA`, ~80 KB): visual idêntico ao preview do app; o Code 128 (`12345678`) e o QR (`C01-MODO-IMAGEM`) continuam legíveis mesmo rasterizados |
| C02 | `c02-vertical-rot-90-modo-vetor.zpl` | Rotação 90° impressa em **vetor nativo** (`^BCB` — sem `^GFA`): código legível, texto vertical, alinhamento correto (foco das pendências 1.164/1.171) |
| C03 | `c03-acentos-no-vetor-ci28.zpl` | Texto `ACENTOS: ÇÃÕÉÊÁÍÓÚ` em **vetor** com `^CI28` (UTF-8 cru). **Pode falhar**: se os acentos saírem errado, isso **confirma a pendência 1.208** (escape hex `^FH` como solução) |
| C04 | `c04-acentos-no-modo-imagem.zpl` | Mesmo texto em **modo imagem** (rasterizado pelo canvas do navegador): acentos devem sair corretos — prova o caminho alternativo |

## Tabela de resultados (preencher na impressora)

| Caso | Imprimiu? | Leitora leu? | OK / Falha | Observações |
|---|---|---|---|---|
| A01 | | | | |
| A02 | | | | |
| A03 | | | | |
| A04 | | | | |
| A05 | | | | |
| A06 | | | | |
| A07 | | | | |
| A08 | | | | |
| B01 | | | | |
| B02 | | | | |
| B03 | | | | |
| B04 | | | | |
| B05 | | | | |
| B06 | | | | |
| B07 | | | | |
| B08 | | | | |
| B09 | | | | |
| B10 | | | | |
| B11 | | | | |
| B12 | | | | |
| B13 | | | | |
| B14 | | | | |
| C01 | | | | |
| C02 | | | | |
| C03 | | | | |
| C04 | | | | |

## Regenerar a bateria

Os ZPLs são gerados pelo app real (funções `gerarZPLBloco`/`gerarZPLImagem`
expostas no `__zebraTest`), via `probe-tA2-tmp.html` + `extrator-a2.py`.
Instruções completas no cabeçalho do `extrator-a2.py`.

## Notas do teste real (13/10/2026 — base para esta bateria)

- HTTPS 443 `POST /pstprnt`, RAW 9100 e LPR 6101 imprimem; IPP 631 não responde.
- **Modo Protegido bloqueia todo SGD `! U1`** (retorna `?`) → sem odômetro.
- `~HS` e comandos de til respondem → M3 (`~JA`) e M4 (`^CV`) do plano seguem viáveis.
- **Rajadas com menos de ~8 s descartam etiquetas** → aguardar entre envios.
- Origem pública (GitHub Pages) não imprime direto (Private Network Access +
  mixed content) → imprimir de `file://`, servidor interno ou pela ponte.
