const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const dotenv = require('dotenv');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const isPackagedExecutable = typeof process.pkg !== 'undefined';
const runtimeDir = isPackagedExecutable ? path.dirname(process.execPath) : process.cwd();
const envPath = path.join(runtimeDir, '.env');

dotenv.config({ path: fs.existsSync(envPath) ? envPath : undefined });

const app = express();
app.use(express.json());

const {
  PORT = 3000,
  CHROME_EXECUTABLE_PATH,
  BOT_DATA_DIR = path.join(os.homedir(), '.whatsapp-lead-bot'),
} = process.env;

const sessions = new Map();
const botStartedAt = Math.floor(Date.now() / 1000);
const MAX_INIT_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

const PURPOSES = {
  '1': 'Projeto em andamento',
  '2': 'Agendar reunião',
  '3': 'Solicitar orçamento',
};

const authDataPath = path.join(BOT_DATA_DIR, 'auth');
fs.mkdirSync(authDataPath, { recursive: true });

function buildMainMenu(name = '') {
  const greetingName = name ? `, ${name}` : '';

  return [
    `Olá${greetingName}! 👋`,
    'Obrigado por entrar em contato com a nossa equipe.',
    'Para agilizar seu atendimento, selecione uma opção:',
    '',
    '1️⃣ Projeto em andamento',
    '2️⃣ Agendar reunião',
    '3️⃣ Solicitar orçamento',
    '',
    'Responda com *1*, *2* ou *3*.',
  ].join('\n');
}

function buildFollowUpByPurpose(option) {
  switch (option) {
    case '1':
      return [
        'Perfeito! Vamos tratar do seu projeto em andamento. 🏗️',
        'Por favor, envie o número do projeto e um resumo da sua dúvida para priorizarmos o atendimento.',
      ].join('\n');
    case '2':
      return [
        'Ótimo! Vamos organizar sua reunião. 📅',
        'Informe, por favor, seu melhor dia/horário e o assunto principal da reunião.',
      ].join('\n');
    case '3':
      return [
        'Excelente! Vamos iniciar seu orçamento. 💰',
        'Descreva brevemente o escopo do projeto e a cidade/estado de execução.',
      ].join('\n');
    default:
      return 'Não entendi sua opção. Responda com *1*, *2* ou *3*.';
  }
}

function buildClosingMessage() {
  return [
    'Recebido! ✅',
    'Nossa triagem foi concluída e já encaminhamos as informações.',
    'Por favor, aguarde o contato do nosso engenheiro responsável.',
    '',
    'Se quiser reiniciar o atendimento, envie *menu*.',
  ].join('\n');
}

function normalizeIncomingText(text = '') {
  return text.trim().toLowerCase();
}

function getSession(waId) {
  return sessions.get(waId) || { state: 'NEW' };
}

function setSession(waId, data) {
  sessions.set(waId, { ...getSession(waId), ...data });
}

function shouldHandleIncomingMessage(message) {
  if (!message || message.fromMe) {
    return false;
  }

  const from = message.from || '';
  const isDirectContact = from.endsWith('@c.us');
  const isGroup = from.endsWith('@g.us');
  const isBroadcast = from.includes('@broadcast');
  const isNewsletter = from.endsWith('@newsletter');
  const hasTextBody = typeof message.body === 'string' && message.body.trim().length > 0;
  const isNewMessage = Number(message.timestamp || 0) >= botStartedAt;

  if (!isDirectContact || isGroup || isBroadcast || isNewsletter) {
    return false;
  }

  if (!hasTextBody || !isNewMessage) {
    return false;
  }

  return true;
}

const qrClient = new Client({
  authStrategy: new LocalAuth({ clientId: 'chat-bot', dataPath: authDataPath }),
  puppeteer: {
    executablePath: CHROME_EXECUTABLE_PATH || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

async function sendWhatsAppMessage(to, message) {
  const chatId = to.includes('@') ? to : `${to}@c.us`;
  await qrClient.sendMessage(chatId, message);
}

async function processConversation(waId, text, profileName = '') {
  if (!waId || !text) return;

  const session = getSession(waId);

  if (text === 'menu' || session.state === 'NEW') {
    await sendWhatsAppMessage(waId, buildMainMenu(profileName));
    setSession(waId, { state: 'AWAITING_PURPOSE' });
    return;
  }

  if (session.state === 'AWAITING_PURPOSE') {
    if (!PURPOSES[text]) {
      await sendWhatsAppMessage(waId, 'Opção inválida. Envie *1*, *2* ou *3* para continuar.');
      return;
    }

    await sendWhatsAppMessage(waId, buildFollowUpByPurpose(text));
    setSession(waId, { state: 'AWAITING_DETAILS', purpose: PURPOSES[text] });
    return;
  }

  if (session.state === 'AWAITING_DETAILS') {
    setSession(waId, { details: text, state: 'DONE' });
    await sendWhatsAppMessage(waId, buildClosingMessage());
    return;
  }

  await sendWhatsAppMessage(waId, 'Se quiser iniciar um novo atendimento, envie *menu*.');
}

qrClient.on('qr', (qr) => {
  console.log('Escaneie o QRCode abaixo com seu WhatsApp para conectar o bot:');
  qrcode.generate(qr, { small: true });
});

qrClient.on('ready', () => {
  console.log('WhatsApp conectado com sucesso via QRCode.');
});

qrClient.on('auth_failure', (msg) => {
  console.error('Falha de autenticação do WhatsApp Web:', msg);
});

qrClient.on('disconnected', (reason) => {
  console.warn('Cliente WhatsApp desconectado:', reason);
});

qrClient.on('message', async (message) => {
  try {
    if (!shouldHandleIncomingMessage(message)) {
      return;
    }

    const waId = message.from.replace('@c.us', '');
    const text = normalizeIncomingText(message.body || '');
    const profileName = message._data?.notifyName || message._data?.pushname || '';

    await processConversation(waId, text, profileName);
  } catch (error) {
    console.error('Erro ao processar mensagem em modo qrcode:', error.message);
  }
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecoverableInitError(error) {
  const message = error?.message || '';

  return (
    message.includes('Execution context was destroyed') ||
    message.includes('Target closed') ||
    message.includes('Navigation failed') ||
    message.includes('Protocol error')
  );
}

async function initializeQrClientWithRetry() {
  for (let attempt = 1; attempt <= MAX_INIT_RETRIES; attempt += 1) {
    try {
      await qrClient.initialize();
      return;
    } catch (error) {
      const isChromeMissing = error?.message?.includes('Could not find Chrome');
      const canRetry = isRecoverableInitError(error) && attempt < MAX_INIT_RETRIES;

      if (isChromeMissing) {
        console.error('Chrome não encontrado para o whatsapp-web.js.');
        console.error('Execute: npx puppeteer browsers install chrome');
        console.error('Ou defina CHROME_EXECUTABLE_PATH no .env com o caminho do chrome.exe.');
      }

      console.error(`Falha ao inicializar cliente QRCode (tentativa ${attempt}/${MAX_INIT_RETRIES}):`, error.message);

      if (!canRetry) {
        throw error;
      }

      console.log(`Tentando novamente em ${RETRY_DELAY_MS / 1000}s...`);
      await wait(RETRY_DELAY_MS);
    }
  }
}

app.get('/webhook', (_, res) => {
  return res.status(200).send('Integração via webhook desabilitada. Este bot opera somente com conexão QRCode.');
});

app.post('/webhook', (_, res) => {
  return res.status(200).json({ ok: true, message: 'Webhook desabilitado no modo QRCode-only.' });
});

app.get('/health', (_, res) => {
  res.status(200).json({
    status: 'ok',
    mode: 'qrcode',
    dataDir: BOT_DATA_DIR,
  });
});

app.listen(PORT, () => {
  console.log(`Bot de WhatsApp ativo na porta ${PORT} (modo: qrcode)`);
  console.log(`Diretório de dados do bot: ${BOT_DATA_DIR}`);
  console.log(`Diretório de runtime: ${runtimeDir}`);

  initializeQrClientWithRetry().catch((error) => {
    console.error('Erro fatal ao inicializar cliente QRCode:', error.message);
    process.exit(1);
  });
});
