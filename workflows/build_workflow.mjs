/*
 * Gera workflows/car-claro.json a partir do cerebro.js (fonte da verdade).
 * O Code node recebe = conteudo de cerebro.js + um wrapper que liga ao n8n.
 * Rode sempre que mexer no cerebro:  node workflows/build_workflow.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raiz = join(__dirname, "..");

const cerebro = readFileSync(join(raiz, "cerebro", "cerebro.js"), "utf8");

const wrapper = `

// ===================== WRAPPER n8n (Code node) =====================
// Le chatInput/sessionId do Chat Trigger, gerencia o estado por sessao
// em getWorkflowStaticData('global') e devolve o texto pro chat.
const _item = $input.first().json;
const _chatInput = _item.chatInput || _item.message || _item.text || "";
const _sessionId = _item.sessionId || _item.session || "default";
const _store = $getWorkflowStaticData("global");
const _estadoAnterior = _store[_sessionId];
const _r = processar(_chatInput, _estadoAnterior);
_store[_sessionId] = _r.estado;
const _texto = _r.respostas.join("\\n\\n");
return [{ json: { output: _texto, sessionId: _sessionId } }];
`;

const jsCode = cerebro + wrapper;

const workflow = {
  name: "CAR Claro",
  nodes: [
    {
      parameters: {
        public: true,
        mode: "hostedChat",
        options: {
          title: "CAR Claro",
          subtitle: "Seu ajudante do CAR — em linguagem simples",
          inputPlaceholder: "Digite o código (ex.: CAR-7K3F9) ou cole o texto da pendência...",
          showWelcomeScreen: false,
          loadPreviousSession: "notSupported",
          responseMode: "lastNode",
          initialMessages: "Olá! Eu sou o CAR Claro, seu ajudante do CAR. 🌱\nDigite o código que veio no seu aviso (ex.: CAR-7K3F9) ou cole o texto da pendência."
        }
      },
      id: "chat-trigger-node",
      name: "When chat message received",
      type: "@n8n/n8n-nodes-langchain.chatTrigger",
      typeVersion: 1.1,
      position: [400, 300],
      webhookId: "car-claro-chat"
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        language: "javaScript",
        jsCode: jsCode
      },
      id: "cerebro-code-node",
      name: "Cerebro CAR Claro",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [680, 300]
    }
  ],
  connections: {
    "When chat message received": {
      main: [
        [
          { node: "Cerebro CAR Claro", type: "main", index: 0 }
        ]
      ]
    }
  },
  active: false,
  settings: { executionOrder: "v1" },
  pinData: {},
  meta: { templateId: "car-claro" },
  tags: []
};

writeFileSync(join(raiz, "workflows", "car-claro.json"), JSON.stringify(workflow, null, 2) + "\n", "utf8");
console.log("OK -> workflows/car-claro.json gerado (" + jsCode.length + " chars de codigo no Code node).");
