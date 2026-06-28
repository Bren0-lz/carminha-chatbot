/*
 * Testes do cerebro — roda fora do n8n, com node puro.
 * Uso:  node cerebro/testes/testar_cerebro.mjs
 * Sai com codigo 0 se tudo passar; 1 se algo falhar.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { processar } = require("../cerebro.js");

let passou = 0;
let falhou = 0;

function ok(nome, cond, detalhe) {
  if (cond) {
    passou++;
    console.log("  ✓ " + nome);
  } else {
    falhou++;
    console.log("  ✗ " + nome + (detalhe ? "  -> " + detalhe : ""));
  }
}

function junta(resp) {
  return resp.respostas.join("\n");
}

console.log("\n== Porta B (texto) ==");
{
  // golden path por texto
  const r = processar("minha reserva legal esta em 12%, inferior ao minimo", undefined);
  ok("texto de RL identifica RL_INSUFICIENTE", r.estado.pendencia_id === "RL_INSUFICIENTE");
  ok("entrega traz a traducao da RL", junta(r).indexOf("Reserva Legal") !== -1);
  ok("entrega traz como resolver", junta(r).toLowerCase().indexOf("como resolver") !== -1);
  ok("entrega traz prazo de referencia", junta(r).indexOf("60 dias") !== -1);
  ok("estado vira IDENTIFICADO", r.estado.etapa === "IDENTIFICADO");
}
{
  const r = processar("preciso recompor a mata ciliar na beira do rio", undefined);
  ok("texto de mata ciliar identifica APP_RECOMPOR", r.estado.pendencia_id === "APP_RECOMPOR");
  ok("APP traz prazo 90 dias", junta(r).indexOf("90 dias") !== -1);
}
{
  const r = processar("falta documento, ccir e tem sobreposicao com vizinho", undefined);
  ok("texto documental identifica DOC_FALTANTE", r.estado.pendencia_id === "DOC_FALTANTE");
}

console.log("\n== Porta A (codigo unico + confirmacao) ==");
{
  // passo 1: codigo -> pede confirmacao
  let r = processar("CAR-7K3F9", undefined);
  ok("codigo CAR-7K3F9 pede confirmacao", r.estado.etapa === "AGUARDA_CONFIRMACAO");
  ok("nao revela imovel antes de confirmar", junta(r).indexOf("Boa Esperança") === -1);

  // passo 2: confirmacao errada -> nao entrega
  let r2 = processar("000", r.estado);
  ok("confirmacao errada nao entrega", r2.estado.etapa === "AGUARDA_CONFIRMACAO");

  // passo 2b: confirmacao certa -> entrega dados do imovel
  let r3 = processar("123", r.estado);
  ok("confirmacao 123 entrega o caso", r3.estado.etapa === "IDENTIFICADO");
  ok("revela imovel apos confirmar", junta(r3).indexOf("Boa Esperança") !== -1);
  ok("mostra a traducao da RL", junta(r3).indexOf("Reserva Legal") !== -1);
  ok("mostra prazo com data 25/08/2026", junta(r3).indexOf("25/08/2026") !== -1);
}
{
  // codigo com formatacao livre
  const r = processar("car 4b8t2", undefined);
  ok("codigo 'car 4b8t2' (com espaco) e reconhecido", r.estado.etapa === "AGUARDA_CONFIRMACAO" && r.estado.codigo === "CAR-4B8T2");
}

console.log("\n== Conversa multi-turno (opcoes pos-identificacao) ==");
{
  let r = processar("reserva legal 12%", undefined); // IDENTIFICADO
  let p = processar("1", r.estado);
  ok("opcao 1 repassa o passo a passo", junta(p).toLowerCase().indexOf("como resolver") !== -1 && p.estado.etapa === "IDENTIFICADO");
  let t = processar("2", r.estado);
  ok("opcao 2 indica tecnico/secretaria", junta(t).indexOf("Secretaria de Meio Ambiente") !== -1);
  let pr = processar("3", r.estado);
  ok("opcao 3 confirma lembrete de prazo", junta(pr).toLowerCase().indexOf("prazo") !== -1);
}

console.log("\n== Comandos globais e fallback ==");
{
  ok("'oi' mostra menu inicial", processar("oi", undefined).respostas[0].indexOf("CAR Claro") !== -1);
  ok("vazio mostra menu inicial", processar("", undefined).respostas[0].indexOf("CAR Claro") !== -1);
  const r = processar("123", { etapa: "IDENTIFICADO", pendencia_id: "RL_INSUFICIENTE" });
  ok("'menu' reseta a conversa", processar("menu", r.estado).estado.etapa === "INICIO");
  ok("texto sem sentido cai no fallback", processar("xpto blablabla", undefined).respostas[0].toLowerCase().indexOf("não consegui") !== -1);
}

console.log("\n----------------------------------------");
console.log("Passou: " + passou + "   Falhou: " + falhou);
if (falhou > 0) {
  console.log("RESULTADO: FALHOU ✗");
  process.exit(1);
} else {
  console.log("RESULTADO: TODOS OS TESTES PASSARAM ✓");
  process.exit(0);
}
