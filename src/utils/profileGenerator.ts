/**
 * Profile Generator & Buyer Context Diversification
 * Módulo de geração de perfis de compradores, geolocalização e metadados de sessão
 * para mitigar detecção de risco e soft declines em gateways (Mercado Pago Antifraude)
 */

export interface GeneratedBillingAddress {
  zip_code: string;
  street_name: string;
  street_number: string;
  neighborhood: string;
  city: string;
  federal_unit: string;
  ddd: string;
  timezone: string;
}

export interface BuyerProfile {
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  cpf: string;
  phone: {
    area_code: string;
    number: string;
  };
  address: GeneratedBillingAddress;
  clientContext: {
    userAgent: string;
    language: string;
    timezone: string;
    timezoneOffset: number;
    screenResolution: string;
    colorDepth: number;
    platform: string;
    timestamp: string;
    ip: string;
  };
  purchaseInfo: {
    itemTitle: string;
    itemDescription: string;
    amount: number;
  };
}

// ----------------------------------------------------
// BANCO DE DADOS DIVERSIFICADO DE NOMES E SOBRENOMES
// ----------------------------------------------------
const firstNames = [
  'Lucas', 'Gabriel', 'Mateus', 'Rodrigo', 'Bruno', 'Leonardo', 'Thiago', 'Guilherme',
  'Felipe', 'Rafael', 'Diego', 'Vinicius', 'Eduardo', 'Gustavo', 'Caio', 'Daniel',
  'Marcelo', 'Alexandre', 'Ricardo', 'Fernando', 'Juliana', 'Camila', 'Mariana',
  'Beatriz', 'Larissa', 'Leticia', 'Carolina', 'Amanda', 'Bruna', 'Fernanda',
  'Gabriela', 'Patricia', 'Renata', 'Vanessa', 'Jessica', 'Tatiane', 'Aline',
  'Debora', 'Natalia', 'Priscila', 'Danielle', 'Sabrina', 'Bianca', 'Monique',
  'Claudia', 'Roberta', 'Luciana', 'Thais', 'Joao Paulo', 'Vitor'
];

const lastNames = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira',
  'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes',
  'Soares', 'Fernandes', 'Vieira', 'Barbosa', 'Rocha', 'Dias', 'Nascimento', 'Andrade',
  'Moreira', 'Nunes', 'Marques', 'Machado', 'Mendes', 'Freitas', 'Cardoso', 'Ramos',
  'Goncalves', 'Santana', 'Teixeira', 'Moura', 'Araujo', 'Pinto', 'Castro', 'Cavalcanti',
  'Dantas', 'Guimaraes', 'Fonseca', 'Brito', 'Farias', 'Macedo', 'Borges', 'Coelho'
];

const emailDomains = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'yahoo.com.br',
  'uol.com.br',
  'icloud.com',
  'bol.com.br',
  'terra.com.br'
];

// ----------------------------------------------------
// BANCO DE ENDEREÇOS E DDDS REGIONAIS BRASILEIROS
// ----------------------------------------------------
const brazilianAddresses: GeneratedBillingAddress[] = [
  { zip_code: '01310100', street_name: 'Avenida Paulista', street_number: '1578', neighborhood: 'Bela Vista', city: 'São Paulo', federal_unit: 'SP', ddd: '11', timezone: 'America/Sao_Paulo' },
  { zip_code: '04543011', street_name: 'Avenida Brigadeiro Faria Lima', street_number: '3477', neighborhood: 'Itaim Bibi', city: 'São Paulo', federal_unit: 'SP', ddd: '11', timezone: 'America/Sao_Paulo' },
  { zip_code: '13010001', street_name: 'Rua Barão de Jaguara', street_number: '950', neighborhood: 'Centro', city: 'Campinas', federal_unit: 'SP', ddd: '19', timezone: 'America/Sao_Paulo' },
  { zip_code: '20040002', street_name: 'Avenida Rio Branco', street_number: '156', neighborhood: 'Centro', city: 'Rio de Janeiro', federal_unit: 'RJ', ddd: '21', timezone: 'America/Sao_Paulo' },
  { zip_code: '22041001', street_name: 'Avenida Nossa Senhora de Copacabana', street_number: '599', neighborhood: 'Copacabana', city: 'Rio de Janeiro', federal_unit: 'RJ', ddd: '21', timezone: 'America/Sao_Paulo' },
  { zip_code: '30130100', street_name: 'Avenida Afonso Pena', street_number: '1500', neighborhood: 'Centro', city: 'Belo Horizonte', federal_unit: 'MG', ddd: '31', timezone: 'America/Sao_Paulo' },
  { zip_code: '38400100', street_name: 'Avenida Afonso Pena', street_number: '620', neighborhood: 'Martins', city: 'Uberlândia', federal_unit: 'MG', ddd: '34', timezone: 'America/Sao_Paulo' },
  { zip_code: '80020010', street_name: 'Rua XV de Novembro', street_number: '784', neighborhood: 'Centro', city: 'Curitiba', federal_unit: 'PR', ddd: '41', timezone: 'America/Sao_Paulo' },
  { zip_code: '88010400', street_name: 'Avenida Rio Branco', street_number: '380', neighborhood: 'Centro', city: 'Florianópolis', federal_unit: 'SC', ddd: '48', timezone: 'America/Sao_Paulo' },
  { zip_code: '90010150', street_name: 'Rua dos Andradas', street_number: '1001', neighborhood: 'Centro Histórico', city: 'Porto Alegre', federal_unit: 'RS', ddd: '51', timezone: 'America/Sao_Paulo' },
  { zip_code: '70040010', street_name: 'Setor Bancário Sul Quadra 2', street_number: '20', neighborhood: 'Asa Sul', city: 'Brasília', federal_unit: 'DF', ddd: '61', timezone: 'America/Sao_Paulo' },
  { zip_code: '74013010', street_name: 'Avenida Goiás', street_number: '600', neighborhood: 'Setor Central', city: 'Goiânia', federal_unit: 'GO', ddd: '62', timezone: 'America/Sao_Paulo' },
  { zip_code: '40020000', street_name: 'Avenida Sete de Setembro', street_number: '200', neighborhood: 'Vitória', city: 'Salvador', federal_unit: 'BA', ddd: '71', timezone: 'America/Bahia' },
  { zip_code: '60060000', street_name: 'Avenida Santos Dumont', street_number: '1168', neighborhood: 'Aldeota', city: 'Fortaleza', federal_unit: 'CE', ddd: '85', timezone: 'America/Fortaleza' },
  { zip_code: '50030000', street_name: 'Avenida Marquês de Olinda', street_number: '200', neighborhood: 'Bairro do Recife', city: 'Recife', federal_unit: 'PE', ddd: '81', timezone: 'America/Recife' },
  { zip_code: '69005010', street_name: 'Avenida Eduardo Ribeiro', street_number: '520', neighborhood: 'Centro', city: 'Manaus', federal_unit: 'AM', ddd: '92', timezone: 'America/Manaus' },
  { zip_code: '66010000', street_name: 'Avenida Presidente Vargas', street_number: '158', neighborhood: 'Campina', city: 'Belém', federal_unit: 'PA', ddd: '91', timezone: 'America/Belem' },
];

// ----------------------------------------------------
// DIVERSIDADE DE DISPOSITIVOS E BROWSERS (USER-AGENTS)
// ----------------------------------------------------
const userAgents = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.80 Mobile Safari/537.36',
];

const screenResolutions = [
  '1920x1080',
  '1366x768',
  '1536x864',
  '1440x900',
  '1280x720',
  '2560x1440',
  '1680x1050',
];

const digitalProducts = [
  { title: 'Acesso Premium Digital', desc: 'Licenca de Software e Servicos Digitais' },
  { title: 'Assinatura Mensal Starter', desc: 'Plano de Acesso Individual Recorrente' },
  { title: 'Curso Online - Modulo Pro', desc: 'Material Didatico e Videoaulas' },
  { title: 'E-book Guia Pratico Digital', desc: 'Download de Conteudo Educativo Digital' },
  { title: 'Licenca de Uso Pessoal', desc: 'Ativacao de Chave Digital' },
  { title: 'Pacote de Recursos Online', desc: 'Acesso a Biblioteca Digital de Recursos' }
];

// ----------------------------------------------------
// UTILS: GERADORES AUXILIARES
// ----------------------------------------------------

export function generateValidCPF(): string {
  const randomDigit = () => Math.floor(Math.random() * 10);
  const cpf = Array.from({ length: 9 }, randomDigit);
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += cpf[i] * (10 - i);
  let remainder = sum % 11;
  const digit1 = remainder < 2 ? 0 : 11 - remainder;
  cpf.push(digit1);
  sum = 0;
  for (let i = 0; i < 10; i++) sum += cpf[i] * (11 - i);
  remainder = sum % 11;
  const digit2 = remainder < 2 ? 0 : 11 - remainder;
  cpf.push(digit2);
  return cpf.join('');
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRealisticBrazilianIP(): string {
  // Faixas comuns de ISPs brasileiros (Claro, Vivo, TIM, Copel, etc.)
  const prefixes = [
    '177.18.', '177.45.', '177.136.', '179.96.', '179.184.',
    '187.19.', '187.60.', '189.120.', '189.4.', '201.24.', '201.86.'
  ];
  const prefix = getRandomItem(prefixes);
  const octet3 = Math.floor(Math.random() * 250) + 1;
  const octet4 = Math.floor(Math.random() * 250) + 1;
  return `${prefix}${octet3}.${octet4}`;
}

// ----------------------------------------------------
// FUNÇÃO PRINCIPAL: GERADOR DE PERFIL DIVERSIFICADO
// ----------------------------------------------------

export function generateBuyerProfile(customHolder?: string, customCpf?: string): BuyerProfile {
  let firstName = '';
  let lastName = '';

  if (customHolder && customHolder.trim().length > 0) {
    const parts = customHolder.trim().split(/\s+/);
    firstName = parts[0];
    lastName = parts.slice(1).join(' ') || getRandomItem(lastNames);
  } else {
    firstName = getRandomItem(firstNames);
    lastName = getRandomItem(lastNames);
    // 30% de chance de adicionar um segundo sobrenome para maior naturalidade
    if (Math.random() > 0.7) {
      const secondLast = getRandomItem(lastNames);
      if (secondLast !== lastName) lastName = `${lastName} ${secondLast}`;
    }
  }

  const cleanFirstName = firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const cleanLastName = lastName.split(' ')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const domain = getRandomItem(emailDomains);

  // Formatos variados de e-mail (ex: lucas.silva94, silva.lucas12, lucas_silva88)
  const emailFormats = [
    `${cleanFirstName}.${cleanLastName}${Math.floor(Math.random() * 900) + 10}@${domain}`,
    `${cleanFirstName}_${cleanLastName}${Math.floor(Math.random() * 90) + 10}@${domain}`,
    `${cleanFirstName}${cleanLastName}${Math.floor(Math.random() * 9000) + 100}@${domain}`,
    `${cleanLastName}.${cleanFirstName}${Math.floor(Math.random() * 99) + 1}@${domain}`,
  ];
  const email = getRandomItem(emailFormats);

  const address = getRandomItem(brazilianAddresses);
  const ddd = address.ddd;
  const phoneNumber = `9${Math.floor(Math.random() * 90000000) + 10000000}`;

  const cleanCpf = customCpf && customCpf.replace(/\D/g, '').length === 11
    ? customCpf.replace(/\D/g, '')
    : generateValidCPF();

  const product = getRandomItem(digitalProducts);
  // Valor variado entre R$ 0,99 e R$ 2,50
  const amounts = [0.99, 1.00, 1.25, 1.49, 1.50, 1.75, 1.99, 2.00, 2.49];
  const amount = getRandomItem(amounts);

  const userAgent = getRandomItem(userAgents);
  const screenResolution = getRandomItem(screenResolutions);
  const ip = generateRealisticBrazilianIP();

  return {
    name: `${firstName} ${lastName}`,
    firstName,
    lastName,
    email,
    cpf: cleanCpf,
    phone: {
      area_code: ddd,
      number: phoneNumber,
    },
    address,
    clientContext: {
      userAgent,
      language: Math.random() > 0.15 ? 'pt-BR' : 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      timezone: address.timezone,
      timezoneOffset: address.timezone === 'America/Manaus' ? 240 : 180,
      screenResolution,
      colorDepth: 24,
      platform: userAgent.includes('Mac') ? 'MacIntel' : (userAgent.includes('Linux') ? 'Linux x86_64' : 'Win32'),
      timestamp: new Date().toISOString(),
      ip,
    },
    purchaseInfo: {
      itemTitle: product.title,
      itemDescription: product.desc,
      amount,
    },
  };
}
