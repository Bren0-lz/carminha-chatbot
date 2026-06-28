/*
 * CAR Claro — o cerebro (logica do bot)
 * ------------------------------------------------------------------
 * Funcao PURA: processar(entrada, estado) -> { respostas, estado }
 *   - entrada: texto do produtor (chatInput)
 *   - estado : objeto de memoria da conversa (por sessionId). undefined = conversa nova.
 *   - retorna: { respostas: string[], estado: novoEstado }
 *
 * NAO depende do n8n. O wrapper do Code node (ver workflows/car-claro.json
 * e README) e quem le/grava o estado por sessao e devolve o texto pro chat.
 *
 * Modo de resposta: SCRIPTED (roteirizado, deterministico). Sem IA/LLM.
 * (Onde uma futura chamada de IA entraria esta marcado com [IA-FUTURO].)
 *
 * IMPORTANTE: os textos exibidos ao produtor usam portugues com acentuacao
 * correta. O casamento de gatilhos/comandos passa por normalizar() (sem
 * acento, minusculo), entao a acentuacao do texto NAO atrapalha a deteccao.
 *
 * Os dados (catalogo + casos) vivem embutidos aqui como constantes para o
 * Code node ser autossuficiente. A fonte curada em JSON fica em
 * cerebro/catalogo_pendencias.json e cerebro/casos_exemplo.json.
 */

// ===================== DADOS (espelho dos JSON) =====================

const CATALOGO = [
  {
    id: "RL_INSUFICIENTE",
    titulo_tecnico: "Área de Reserva Legal inferior ao mínimo legal",
    gatilhos: ["reserva legal", "rl ", " rl", "reserva legal insuficiente", "20%", "inferior ao minimo", "abaixo do minimo", "deficit de reserva", "rl insuficiente"],
    traducao: "Seu Raimundo, todo imóvel rural precisa manter um pedaço de mata em pé — e chamam isso de Reserva Legal. No seu caso, o sistema apontou que a sua área de mata está menor do que a lei pede pra sua região. Não é multa nem perda de terra: é só um ajuste pra regularizar.",
    como_resolver: [
      "Confira no mapa do CAR onde está marcada a sua Reserva Legal hoje.",
      "Você tem 3 caminhos pra completar o que falta: (1) deixar uma área da sua propriedade virar mata de novo (recuperar), (2) compensar com área de mata equivalente em outro lugar do mesmo bioma, ou (3) juntar com a Reserva de vizinhos (condomínio de reserva).",
      "Procure a Secretaria de Meio Ambiente do seu estado ou um técnico (agrônomo/florestal) pra escolher o caminho mais barato pro seu caso.",
      "Com o caminho escolhido, você assina um compromisso de regularização (PRA) e o prazo passa a contar — sem risco enquanto estiver cumprindo."
    ],
    base_legal: "Lei 12.651/2012 (Código Florestal), arts. 12, 66 e 68.",
    prazo_dias: 60
  },
  {
    id: "APP_RECOMPOR",
    titulo_tecnico: "Déficit de Área de Preservação Permanente (APP) — mata ciliar a recompor",
    gatilhos: ["app", "area de preservacao", "mata ciliar", "beira de rio", "margem do rio", "nascente", "recompor", "faixa de mata", "preservacao permanente", "olho d'agua", "olho dagua"],
    traducao: "Seu Raimundo, a faixa de mata na beira de rios, córregos e nascentes tem um nome: APP (Área de Preservação Permanente). O sistema viu que falta um pouco dessa mata na beira da água dentro da sua área. Isso protege a sua própria água de secar e assorear — e dá pra regularizar plantando de volta.",
    como_resolver: [
      "Veja no mapa do CAR qual trecho de rio, córrego ou nascente está sem a faixa de mata.",
      "Para imóvel pequeno (até 4 módulos fiscais), a faixa a recompor é menor — a própria lei facilita. Confirme o tamanho do seu imóvel.",
      "Plante mudas nativas na faixa indicada ou deixe a vegetação se regenerar sozinha (cercar pra o gado não entrar já ajuda muito).",
      "Registre que aderiu ao PRA (Programa de Regularização Ambiental) na sua Secretaria de Meio Ambiente — isso formaliza o prazo e protege você durante a recomposição."
    ],
    base_legal: "Lei 12.651/2012 (Código Florestal), arts. 4º, 61-A e 61-B.",
    prazo_dias: 90
  },
  {
    id: "DOC_FALTANTE",
    titulo_tecnico: "Documentação ou georreferenciamento pendente / sobreposição a esclarecer",
    gatilhos: ["documento", "documentacao", "matricula", "ccir", "cpf", "sobreposicao", "falta documento", "pendencia documental", "georreferenciamento", "comprovacao", "titulo da terra"],
    traducao: "Seu Raimundo, dessa vez não é sobre mata: faltou um documento ou a sua área no mapa está encostando na área de um vizinho (o que chamam de sobreposição). É o tipo de pendência mais rápida de resolver — geralmente é só juntar um papel ou ajustar o desenho do mapa.",
    como_resolver: [
      "Separe os documentos do imóvel: matrícula/registro, CCIR (do INCRA) e o seu CPF.",
      "Se for sobreposição com vizinho, leve o mapa e converse — na maioria das vezes é só corrigir um ponto que ficou torto no desenho da área.",
      "Entre no sistema do CAR (ou peça ajuda na Secretaria de Meio Ambiente / sindicato rural) e anexe o documento ou corrija o limite da área.",
      "Guarde o protocolo de envio — é ele que comprova que você regularizou dentro do prazo."
    ],
    base_legal: "Lei 12.651/2012, art. 29 e instruções do SICAR.",
    prazo_dias: 30
  }
];

const CASOS = {
  "CAR-7K3F9": {
    produtor: "Raimundo",
    imovel: "Sítio Boa Esperança - Bom Jesus do Norte/ES",
    pendencia_id: "RL_INSUFICIENTE",
    detalhe: "Reserva Legal declarada de 12%, mínimo exigido de 20% (bioma Mata Atlântica). Faltam 8%.",
    prazo_data: "2026-08-25",
    confirmacao: "123"
  },
  "CAR-4B8T2": {
    produtor: "Dona Benedita",
    imovel: "Chácara Água Limpa - Buritis/MG",
    pendencia_id: "APP_RECOMPOR",
    detalhe: "Faixa de mata ciliar ausente em ~120 m de margem de córrego. Imóvel com 2 módulos fiscais.",
    prazo_data: "2026-09-30",
    confirmacao: "456"
  },
  "CAR-9Z1Q7": {
    produtor: "João Pereira",
    imovel: "Fazenda Três Irmãos - Sorriso/MT",
    pendencia_id: "DOC_FALTANTE",
    detalhe: "Sobreposição de 0,4 ha com o imóvel vizinho a esclarecer + CCIR desatualizado.",
    prazo_data: "2026-07-28",
    confirmacao: "789"
  }
};

const NOME_BOT = "CAR Claro";

// ===================== HELPERS =====================

function normalizar(texto) {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tira acentos (so para casar gatilhos/comandos)
    .trim();
}

function acharPendencia(id) {
  return CATALOGO.find(function (p) { return p.id === id; }) || null;
}

// Porta A: detecta um codigo de caso na entrada (ex.: "CAR-7K3F9", "car 7k3f9")
function detectarCodigo(entrada) {
  const bruto = String(entrada || "").toUpperCase();
  const compacto = bruto.replace(/[^A-Z0-9]/g, "");
  for (const codigo in CASOS) {
    if (compacto === codigo.replace(/[^A-Z0-9]/g, "")) return codigo;
  }
  return null;
}

// Porta B: identifica a pendencia pelo texto via gatilhos
function identificarPorTexto(entrada) {
  const t = " " + normalizar(entrada) + " ";
  let melhor = null;
  let melhorScore = 0;
  for (const p of CATALOGO) {
    let score = 0;
    for (const g of p.gatilhos) {
      const gn = normalizar(g);
      if (gn && t.indexOf(gn) !== -1) score += 1;
    }
    if (score > melhorScore) { melhorScore = score; melhor = p; }
  }
  return melhorScore > 0 ? melhor : null;
}

function dataBR(iso) {
  if (!iso) return "";
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? (m[3] + "/" + m[2] + "/" + m[1]) : String(iso);
}

function blocoComoResolver(pendencia) {
  const linhas = pendencia.como_resolver.map(function (passo, i) {
    return (i + 1) + ") " + passo;
  });
  return "Como resolver, passo a passo:\n" + linhas.join("\n");
}

function blocoOpcoes() {
  return "O que você quer fazer agora?\n" +
    "1) Ver o passo a passo de novo\n" +
    "2) Falar com um técnico\n" +
    "3) Lembrar do prazo\n" +
    "(ou digite *menu* pra recomeçar)";
}

function menuInicial() {
  return "Olá! Eu sou o " + NOME_BOT + ", seu ajudante do CAR. 🌱\n" +
    "Vou te ajudar a entender e resolver a pendência do seu Cadastro Ambiental Rural, em linguagem simples.\n\n" +
    "Você pode:\n" +
    "• Digitar o *código* que veio no seu aviso (ex.: CAR-7K3F9), ou\n" +
    "• *Colar o texto* da pendência que apareceu pra você.";
}

// Monta a entrega da pendencia (traducao + como resolver + prazo).
// dadosCaso (opcional, Porta A) traz imovel/detalhe/prazo_data.
function entregarPendencia(pendencia, dadosCaso) {
  const respostas = [];
  if (dadosCaso) {
    respostas.push(
      "Encontrei seu cadastro, " + dadosCaso.produtor + ". ✅\n" +
      "Imóvel: " + dadosCaso.imovel + "\n" +
      "Pendência: " + pendencia.titulo_tecnico
    );
  } else {
    respostas.push("Entendi a sua pendência: *" + pendencia.titulo_tecnico + "*.");
  }

  let traducao = pendencia.traducao;
  if (dadosCaso && dadosCaso.detalhe) {
    traducao += "\n\nNo seu caso: " + dadosCaso.detalhe;
  }
  respostas.push(traducao);

  respostas.push(blocoComoResolver(pendencia));

  let prazoTxt;
  if (dadosCaso && dadosCaso.prazo_data) {
    prazoTxt = "Prazo pra regularizar: até " + dataBR(dadosCaso.prazo_data) + ".";
  } else {
    prazoTxt = "Prazo de referência: cerca de " + pendencia.prazo_dias + " dias a partir da adesão ao PRA.";
  }
  prazoTxt += "\nBase legal: " + pendencia.base_legal;
  respostas.push(prazoTxt);

  respostas.push(blocoOpcoes());
  return respostas;
}

// ===================== O CEREBRO =====================

function processar(entrada, estado) {
  // estado novo / vazio
  if (!estado || !estado.etapa) {
    estado = { etapa: "INICIO" };
  }
  const txt = normalizar(entrada);

  // comandos globais (valem em qualquer etapa)
  if (txt === "menu" || txt === "recomecar" || txt === "reiniciar" || txt === "voltar") {
    return { respostas: [menuInicial()], estado: { etapa: "INICIO" } };
  }

  // ---------- ETAPA: AGUARDA_CONFIRMACAO (Porta A, identidade leve) ----------
  if (estado.etapa === "AGUARDA_CONFIRMACAO") {
    const caso = CASOS[estado.codigo];
    if (!caso) {
      return { respostas: [menuInicial()], estado: { etapa: "INICIO" } };
    }
    if (txt === normalizar(caso.confirmacao)) {
      const pendencia = acharPendencia(caso.pendencia_id);
      const respostas = entregarPendencia(pendencia, caso);
      return {
        respostas: respostas,
        estado: { etapa: "IDENTIFICADO", pendencia_id: pendencia.id, codigo: estado.codigo }
      };
    }
    return {
      respostas: ["Hmm, esses números não bateram. 🤔 Digite os *3 números* que vieram junto com o seu código (no aviso/e-mail). Ou digite *menu* pra recomeçar."],
      estado: estado
    };
  }

  // ---------- ETAPA: IDENTIFICADO (pos-entrega, opcoes) ----------
  if (estado.etapa === "IDENTIFICADO") {
    const pendencia = acharPendencia(estado.pendencia_id);
    if (txt === "1" || txt.indexOf("passo") !== -1) {
      return { respostas: [blocoComoResolver(pendencia), blocoOpcoes()], estado: estado };
    }
    if (txt === "2" || txt.indexOf("tecnico") !== -1 || txt.indexOf("ajuda") !== -1) {
      return {
        respostas: [
          "Sem problema! Quem resolve isso na prática é a *Secretaria de Meio Ambiente* do seu estado ou o *sindicato rural* da sua cidade — os dois costumam ter atendimento gratuito.\n" +
          "Leve o código da sua pendência e os documentos do imóvel. Quer que eu te lembre do prazo? Digite *3*.",
          blocoOpcoes()
        ],
        estado: estado
      };
    }
    if (txt === "3" || txt.indexOf("prazo") !== -1 || txt.indexOf("lembr") !== -1) {
      const caso = CASOS[estado.codigo];
      const quando = caso && caso.prazo_data ? ("até " + dataBR(caso.prazo_data)) : ("em ~" + pendencia.prazo_dias + " dias");
      return {
        respostas: [
          "Combinado! 📌 Anotei o seu prazo: *" + quando + "*.\n" +
          "Vou te lembrar conforme a data se aproximar. Enquanto estiver resolvendo dentro do prazo, você está tranquilo.",
          blocoOpcoes()
        ],
        estado: estado
      };
    }
    // talvez tenha colado outra pendencia / outro codigo -> reidentifica
    const reidentificado = roteamentoInicial(entrada);
    if (reidentificado) return reidentificado;

    return {
      respostas: ["Não entendi. " + blocoOpcoes()],
      estado: estado
    };
  }

  // ---------- ETAPA: INICIO ----------
  if (!txt || txt === "oi" || txt === "ola" || txt === "ola!" || txt === "bom dia" || txt === "boa tarde" || txt === "boa noite" || txt === "ajuda" || txt === "start") {
    return { respostas: [menuInicial()], estado: { etapa: "INICIO" } };
  }

  const roteado = roteamentoInicial(entrada);
  if (roteado) return roteado;

  // nao entendeu
  return {
    respostas: [
      "Não consegui identificar a sua pendência ainda. 😕\n" +
      "Tente *colar o texto* exatamente como apareceu, ou digite o *código* do aviso (ex.: CAR-7K3F9).\n" +
      "Se preferir, digite *menu*."
    ],
    estado: { etapa: "INICIO" }
  };
}

// Decide entre Porta A (codigo) e Porta B (texto). Retorna null se nada casou.
function roteamentoInicial(entrada) {
  // Porta A: codigo unico
  const codigo = detectarCodigo(entrada);
  if (codigo) {
    return {
      respostas: [
        "Achei o cadastro ligado ao código *" + codigo + "*. 🔒\n" +
        "Pra proteger seus dados, me confirme os *3 números* que vieram junto com o código no seu aviso."
      ],
      estado: { etapa: "AGUARDA_CONFIRMACAO", codigo: codigo }
    };
  }

  // Porta B: texto da pendencia
  const pendencia = identificarPorTexto(entrada);
  if (pendencia) {
    return {
      respostas: entregarPendencia(pendencia, null),
      estado: { etapa: "IDENTIFICADO", pendencia_id: pendencia.id }
    };
  }

  return null;
}

// [IA-FUTURO] Se nenhum gatilho casar, aqui entraria uma chamada de LLM para
// classificar o texto livre na pendencia mais provavel do CATALOGO e/ou
// reescrever a traducao de forma ainda mais proxima do produtor. Mantido
// desligado a noite (modo scripted, sem custo e sem risco na demo).

// ===================== EXPORT (so para testes em Node) =====================
if (typeof module !== "undefined" && module.exports) {
  module.exports = { processar: processar, CATALOGO: CATALOGO, CASOS: CASOS, normalizar: normalizar };
}
