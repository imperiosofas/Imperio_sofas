export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type LegalDocument = {
  slug: "termos" | "privacidade" | "trocas-e-devolucoes";
  title: string;
  updatedAt: string;
  sections: LegalSection[];
};

export const COMPANY = {
  legalName: "Império Valle Móveis Ltda.",
  tradeName: "Império Sofás",
  cnpj: "42.046.387/0001-67",
  address: "Avenida Cinderela, nº 2011, Taubaté/SP",
  phone: "(12) 99218-0333",
  email: "imperiosofas20@gmail.com",
  site: "www.imperiosofas.com.br",
} as const;

const contactBullets = [
  `E-mail: ${COMPANY.email}`,
  `Telefone/WhatsApp: ${COMPANY.phone}`,
];

export const TERMS_UPDATED_AT = "30 de outubro de 2026";
// Stored on each order; bump together with TERMS_UPDATED_AT when the terms change.
export const TERMS_VERSION = "2026-10-30";

export const terms: LegalDocument = {
  slug: "termos",
  title: "Termos de Uso e Condições de Compra",
  updatedAt: TERMS_UPDATED_AT,
  sections: [
    {
      title: "1. Identificação da empresa",
      paragraphs: [
        `O site ${COMPANY.site} é administrado pela ${COMPANY.legalName}, nome fantasia ${COMPANY.tradeName}, inscrita no CNPJ nº ${COMPANY.cnpj}, localizada na ${COMPANY.address}.`,
        "Contato:",
      ],
      bullets: contactBullets,
    },
    {
      title: "2. Produtos e informações",
      paragraphs: [
        "A Império Sofás comercializa sofás, estofados e móveis em geral.",
        "As características dos produtos, como medidas, tecidos, cores, preços e disponibilidade, são apresentadas no catálogo e confirmadas antes da compra.",
        "As imagens são ilustrativas, podendo apresentar pequenas variações de tonalidade devido à iluminação e às configurações das telas, sem prejuízo das características anunciadas.",
      ],
    },
    {
      title: "3. Pedidos e pagamentos",
      paragraphs: [
        "As compras podem ser realizadas presencialmente, pelo WhatsApp ou diretamente pelo site.",
        "Antes da confirmação do pedido, o cliente poderá conferir os produtos selecionados, valores, frete, prazo de entrega e condições de pagamento.",
        "Os pagamentos serão realizados pelos meios disponibilizados no momento da compra, incluindo PIX, QR Code ou outras modalidades oferecidas.",
        "O pedido será confirmado conforme as condições apresentadas no checkout.",
      ],
    },
    {
      title: "4. Prazos de entrega",
      paragraphs: ["Os prazos variam conforme o fornecedor:"],
      bullets: [
        "Valle: até 7 dias úteis para entrega no endereço do cliente.",
        "Mundial: de 30 a 45 dias úteis para entrega no endereço do cliente, incluindo fabricação, transporte e entrega final.",
      ],
    },
    {
      title: "",
      paragraphs: [
        "Para os produtos Mundial, após a chegada à Império Sofás, a entrega será realizada em até 7 dias úteis, dentro do prazo total informado.",
        "Os prazos são contados a partir da confirmação do pedido, excluindo sábados, domingos e feriados.",
        "O frete será calculado e informado antes da finalização da compra. Eventuais atrasos serão comunicados ao cliente, respeitando os direitos previstos na legislação.",
      ],
    },
    {
      title: "5. Trocas, devoluções e cancelamentos",
      paragraphs: [
        "Nas compras presenciais, não são oferecidas trocas voluntárias de produtos sem defeito por mudança de preferência.",
        "Nas compras realizadas fora do estabelecimento comercial, incluindo site e WhatsApp, o consumidor poderá exercer o direito de arrependimento em até 7 dias corridos, conforme o artigo 49 do Código de Defesa do Consumidor.",
        "Nesses casos, a devolução dos valores pagos e os custos de recolhimento do produto serão de responsabilidade da Império Sofás, conforme a legislação.",
        "Produtos com defeito ou em desacordo com o pedido serão atendidos conforme o Código de Defesa do Consumidor e a Política de Trocas e Devoluções disponível no site.",
      ],
    },
    {
      title: "6. Garantia",
      paragraphs: [
        "Os produtos dos fornecedores Valle e Mundial possuem garantia legal de 90 dias para defeitos aparentes ou de fácil constatação, contados a partir da entrega.",
        "Em caso de defeitos ocultos, o prazo legal de reclamação começa quando o problema se torna evidente.",
        "A garantia cobre os defeitos pelos quais os fornecedores sejam legalmente responsáveis, não abrangendo danos comprovadamente decorrentes de mau uso ou acidentes.",
      ],
    },
    {
      title: "7. Privacidade e segurança",
      paragraphs: [
        "Os dados fornecidos pelos clientes serão utilizados para processamento de pedidos, pagamentos, entregas e atendimento, conforme a Lei Geral de Proteção de Dados Pessoais (LGPD).",
        "Mais informações estão disponíveis na Política de Privacidade do site.",
      ],
    },
    {
      title: "8. Uso do site",
      paragraphs: [
        "O conteúdo do site, incluindo imagens, textos e identidade visual, é protegido pela legislação aplicável.",
        "A Império Sofás poderá atualizar produtos, preços e informações, respeitando as condições das compras já confirmadas e os direitos dos consumidores.",
      ],
    },
    {
      title: "9. Atendimento",
      paragraphs: ["Para dúvidas, solicitações ou acompanhamento de pedidos:"],
      bullets: contactBullets,
    },
    {
      title: "10. Disposições finais",
      paragraphs: [
        "Estes termos poderão ser atualizados conforme alterações operacionais ou legais, sem prejudicar direitos adquiridos.",
        "Todas as compras estão sujeitas ao Código de Defesa do Consumidor, prevalecendo a legislação em caso de divergência com estes termos.",
      ],
    },
  ],
};

export const returns: LegalDocument = {
  slug: "trocas-e-devolucoes",
  title: "Política de Trocas e Devoluções",
  updatedAt: TERMS_UPDATED_AT,
  sections: [
    {
      title: "Compras presenciais",
      paragraphs: [
        "Nas compras presenciais, não são oferecidas trocas voluntárias de produtos sem defeito por mudança de preferência.",
      ],
    },
    {
      title: "Compras pelo site ou WhatsApp: direito de arrependimento",
      paragraphs: [
        "Nas compras realizadas fora do estabelecimento comercial, incluindo site e WhatsApp, o consumidor poderá exercer o direito de arrependimento em até 7 dias corridos, conforme o artigo 49 do Código de Defesa do Consumidor.",
        "Nesses casos, a devolução dos valores pagos e os custos de recolhimento do produto serão de responsabilidade da Império Sofás, conforme a legislação.",
      ],
    },
    {
      title: "Produto com defeito ou em desacordo com o pedido",
      paragraphs: [
        "Produtos com defeito ou em desacordo com o pedido serão atendidos conforme o Código de Defesa do Consumidor.",
        "Os produtos dos fornecedores Valle e Mundial possuem garantia legal de 90 dias para defeitos aparentes ou de fácil constatação, contados a partir da entrega. Em caso de defeitos ocultos, o prazo legal de reclamação começa quando o problema se torna evidente.",
        "A garantia cobre os defeitos pelos quais os fornecedores sejam legalmente responsáveis, não abrangendo danos comprovadamente decorrentes de mau uso ou acidentes.",
      ],
    },
    {
      title: "Como solicitar",
      paragraphs: ["Fale com a loja informando o número do pedido:"],
      bullets: contactBullets,
    },
  ],
};

export const privacy: LegalDocument = {
  slug: "privacidade",
  title: "Política de Privacidade",
  updatedAt: TERMS_UPDATED_AT,
  sections: [
    {
      title: "Quem é o responsável pelos dados",
      paragraphs: [
        `${COMPANY.legalName} (${COMPANY.tradeName}), CNPJ ${COMPANY.cnpj}, ${COMPANY.address}, é a responsável pelo tratamento dos dados pessoais coletados neste site, conforme a Lei Geral de Proteção de Dados Pessoais (LGPD, Lei nº 13.709/2018).`,
      ],
    },
    {
      title: "Quais dados coletamos",
      bullets: [
        "Dados de cadastro: nome, e-mail e senha (a senha é guardada de forma protegida, nunca em texto aberto).",
        "Dados de contato e entrega: telefone, CEP, endereço, número, complemento e andar, quando você pede uma cotação ou finaliza uma compra.",
        "Dados do pedido: produtos, valores, frete, forma e situação do pagamento.",
        "Interações na loja: favoritos, carrinho e avaliações que você publica.",
        "Dados técnicos de sessão necessários para manter você conectado e proteger a conta.",
      ],
    },
    {
      title: "Para que usamos os dados",
      bullets: [
        "Processar pedidos, pagamentos e entregas ou retiradas.",
        "Calcular frete e confirmar cotações.",
        "Atender dúvidas e acompanhar pedidos.",
        "Enviar e-mails de conta e de segurança, como confirmação de cadastro e redefinição de senha.",
        "Cumprir obrigações legais, fiscais e de prevenção a fraudes.",
      ],
    },
    {
      title: "Com quem compartilhamos",
      paragraphs: [
        "Compartilhamos apenas o necessário com prestadores que operam o site e a venda: provedores de hospedagem e banco de dados, de envio de e-mails e de pagamento. Os dados de cartão ou de conta usados no pagamento são tratados diretamente pelo provedor de pagamento e não ficam guardados por nós.",
        "Também podemos compartilhar com os fornecedores dos produtos o necessário para a entrega ou a retirada do seu pedido. Não vendemos dados pessoais.",
      ],
    },
    {
      title: "Por quanto tempo guardamos",
      paragraphs: [
        "Guardamos os dados pelo tempo necessário para atender ao pedido, ao pós-venda e às obrigações legais e fiscais. Os dados de conta ficam enquanto a conta existir.",
      ],
    },
    {
      title: "Seus direitos",
      paragraphs: ["Pela LGPD, você pode pedir a qualquer momento:"],
      bullets: [
        "Confirmação de que tratamos seus dados e acesso a eles.",
        "Correção de dados incompletos ou desatualizados.",
        "Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei.",
        "Informação sobre com quem compartilhamos seus dados.",
        "Revogação de consentimento, quando o tratamento depender dele.",
      ],
    },
    {
      title: "Cookies",
      paragraphs: [
        "Usamos apenas cookies essenciais, necessários para manter a sua sessão de login e a segurança da conta.",
      ],
    },
    {
      title: "Como falar com a gente",
      paragraphs: [
        "Para exercer seus direitos ou tirar dúvidas sobre os seus dados:",
      ],
      bullets: contactBullets,
    },
  ],
};

export const legalDocuments = [terms, privacy, returns] as const;
