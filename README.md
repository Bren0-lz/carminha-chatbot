# CAR Claro · Carminha 🌱

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![n8n](https://img.shields.io/badge/n8n-workflow-EA4B71)
![Node](https://img.shields.io/badge/Node.js-test%20puro-339933)
![Status](https://img.shields.io/badge/golden%20path-validado%20ao%20vivo-success)

A **Carminha** é uma assistente de chat (WhatsApp) que **traduz a pendência do CAR**
(Cadastro Ambiental Rural) para a linguagem do produtor rural e **guia a correção passo a passo**.

- **Assistente:** Carminha — acolhedora, sem juridiquês, tudo em português.
- **Público (persona):** *Seu Raimundo* — pequeno produtor, pouca familiaridade digital.

> **O que está neste repositório:** o cérebro determinístico (identificação de pendência),
> os testes, o **workflow base do n8n** (Chat Trigger → Code) e a **demo web**. A instância
> ao vivo evoluiu para **Webhook → Code → IF → AI Agent (Carminha) + RAG legal** — veja a
> nota em *Estrutura* sobre reexportar o workflow atual.

Duas portas de entrada:
- **Porta A (código único):** o produtor digita o código do aviso (ex.: `CAR-7K3F9`) e o
  bot já sabe a pendência, o imóvel e o prazo (após confirmar 3 dígitos de identidade).
- **Porta B (texto):** o produtor cola o texto da pendência e o bot identifica pelos gatilhos.

Modo de resposta: **scripted** (roteirizado, determinístico). Sem IA/LLM — sem custo e
sem risco de falha na demo. O ponto onde uma IA futura entraria está marcado no código
com `[IA-FUTURO]`.

---

## Estrutura

```
car-claro/
  cerebro/
    cerebro.js                # a lógica (fonte da verdade). Função pura processar(entrada, estado)
    catalogo_pendencias.json  # as pendências curadas (espelho dos dados em cerebro.js)
    casos_exemplo.json        # códigos únicos -> caso do produtor (mock da Porta A)
    testes/
      testar_cerebro.mjs      # roda o cérebro com payloads e confere a saída (node puro)
  workflows/
    car-claro.json            # workflow do n8n (o AGENTE) — importável
    build_workflow.mjs        # gera o car-claro.json a partir do cerebro.js
  demo/
    email.html                # aviso do CAR (fiel ao SICAR) com botão -> WhatsApp/Carminha
    index.html                # simulador de WhatsApp da demo (motor offline embutido)
  Roteiro_Video_CAR_Claro.pdf # roteiro do vídeo de 2 min (pronto pra ler/imprimir)
  ROTEIRO_VIDEO.md            # mesmo roteiro, versão markdown (editável)
  README.md
  PROGRESSO.md                # log do desenvolvimento
```

> **Fonte da verdade do cérebro = `cerebro/cerebro.js`.** Edite o arquivo, rode os testes, e só
> depois regenere o workflow. O `car-claro.json` é gerado, não editado à mão.

> ⚠️ **Sobre o workflow do agente:** o `workflows/car-claro.json` versionado é a base
> (Chat Trigger → Code). A instância ao vivo evoluiu para **Webhook → Code → IF → AI Agent
> (Carminha) + RAG legal**. Quando o n8n estiver no ar, reexporte a versão atual com:
> `GET /api/v1/workflows/TOlW6dfcoMQ93ZEL` para manter o repositório sincronizado.

## A demo web (pasta `demo/`)

Abra `demo/email.html` no navegador → clique em **"Resolver com a Carminha"** → abre
`demo/index.html` (simulador de WhatsApp) com a mensagem já preenchida. O `index.html`
tem um motor offline embutido, então a demo funciona **mesmo com o n8n desligado**.

---

## Como rodar os testes (sem n8n)

```bash
node cerebro/testes/testar_cerebro.mjs
```

Deve imprimir `TODOS OS TESTES PASSARAM ✓` (23 casos).

## Como regenerar o workflow após mexer no cérebro

```bash
node workflows/build_workflow.mjs
```

Isso reescreve `workflows/car-claro.json` colando o conteúdo atual de `cerebro.js`
dentro do Code node + o wrapper do n8n.

---

## Já está rodando na sua instância n8n ✅

O workflow foi criado, ativado e **validado ao vivo** na instância local:

- **Workflow:** `CAR Claro` — id `TOlW6dfcoMQ93ZEL` (ativo)
- **Abrir o chat (demo):** http://localhost:5678/webhook/car-claro-chat/chat
- **Endpoint de mensagens** (mesmo URL, via POST):
  `POST http://localhost:5678/webhook/car-claro-chat/chat`
  body: `{"action":"sendMessage","sessionId":"<id>","chatInput":"<mensagem>"}`

Validação ponta a ponta: 13/13 checagens ao vivo passaram, com tempo de resposta de
**34–145 ms**. Cobertura: Portas A e B, os 3 casos, confirmação errada, isolamento de
sessão, fallback e reset.

> Se editar o `cerebro.js`: rode os testes, `node workflows/build_workflow.mjs`, e
> re-suba com `PUT /api/v1/workflows/TOlW6dfcoMQ93ZEL` (ou reimporte o JSON).

## Como importar no n8n (se precisar recriar do zero)

1. Abra o n8n → menu **⋯ (canto superior direito) → Import from File**.
2. Selecione `workflows/car-claro.json`.
3. O workflow **CAR Claro** abre com 2 nós:
   - **When chat message received** (Chat Trigger nativo) — hospeda a UI de chat.
   - **Cerebro CAR Claro** (Code node) — toda a lógica.
4. **Salve** o workflow. Se quiser deixar disponível por URL pública, **ative** (toggle
   *Active*) — para a demo local basta abrir o chat de teste.
5. Clique em **Open Chat** (no nó Chat Trigger) para conversar.

> O Chat Trigger está configurado com `responseMode: lastNode` — a resposta que aparece
> no chat é o campo `output` devolvido pelo Code node.

### Desenho do workflow (caso precise montar do zero)

```
[ When chat message received ]  --main-->  [ Cerebro CAR Claro (Code) ]
   @n8n/n8n-nodes-langchain.chatTrigger        n8n-nodes-base.code
   - mode: hostedChat                          - mode: runOnceForAllItems
   - responseMode: lastNode                    - language: javaScript
   - title: "CAR Claro"                        - jsCode: conteúdo de cerebro.js + wrapper
```

**Wrapper** (já incluído, no fim do Code node) — lê a mensagem, gerencia o estado por
sessão e devolve o texto:

```js
const _item = $input.first().json;
const _chatInput = _item.chatInput || _item.message || _item.text || "";
const _sessionId = _item.sessionId || _item.session || "default";
const _store = $getWorkflowStaticData("global");   // memória por conversa, sem banco
const _r = processar(_chatInput, _store[_sessionId]);
_store[_sessionId] = _r.estado;
return [{ json: { output: _r.respostas.join("\n\n"), sessionId: _sessionId } }];
```

---

## Roteiro da demo (golden path — Reserva Legal)

**Porta A (código, como se viesse do e-mail/Central):**
1. No chat, digite: `CAR-7K3F9`
2. O bot pede confirmação de identidade → digite: `123`
3. O bot mostra: imóvel (*Sítio Boa Esperança*), a tradução da Reserva Legal, o passo a
   passo e o prazo (**25/08/2026**).
4. Digite `3` → o bot confirma que vai lembrar do prazo.

**Porta B (texto da pendência):**
1. No chat, cole: `Minha reserva legal está em 12%, inferior ao mínimo`
2. O bot identifica a pendência e entrega tradução + como resolver + prazo de referência.

Outros casos prontos para demonstrar largura:
- `CAR-4B8T2` + `456` → mata ciliar / APP (Dona Benedita).
- `CAR-9Z1Q7` + `789` → documentação/sobreposição (João Pereira).

---

## Catálogo de pendências (3)

| id | Pendência | Prazo ref. |
|----|-----------|------------|
| `RL_INSUFICIENTE` | Reserva Legal abaixo do mínimo do bioma (golden path) | 60 dias |
| `APP_RECOMPOR` | Mata ciliar / APP a recompor | 90 dias |
| `DOC_FALTANTE` | Documento faltante / sobreposição a esclarecer | 30 dias |

> ⚠️ Os textos legais e prazos são **simplificações para a demo**. Antes de uso real,
> revisar com base na Lei 12.651/2012 e nas regras do estado/bioma específicos.
