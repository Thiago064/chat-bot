const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
app.use(express.json());

const {
  PORT = 3000,
  WHATSAPP_CONNECTION_MODE = 'cloud',
  WHATSAPP_VERIFY_TOKEN,
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
} = process.env;

const isCloudMode = WHATSAPP_CONNECTION_MODE === 'cloud';
const isQrCodeMode = WHATSAPP_CONNECTION_MODE === 'qrcode';

if (!isCloudMode && !isQrCodeMode) {
  console.error('WHATSAPP_CONNECTION_MODE inválido. Use "cloud" ou "qrcode".');
  process.exit(1);
}

if (isCloudMode && (!WHATSAPP_VERIFY_TOKEN || !WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID)) {
  console.error('Variáveis de ambiente faltando para modo cloud. Confira o arquivo .env.example');
  process.exit(1);
}

const sessions = new Map();
let qrClient = null;

const PURPOSES = {
  '1': 'Projeto em andamento',
  '2': 'Agendar reunião',
  '3': 'Solicitar orçamento',
};

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

async function sendWhatsAppMessage(to, message) {
  if (isQrCodeMode) {
    if (!qrClient) {
      throw new Error('Cliente WhatsApp QRCode ainda não inicializado.');
    }

    const chatId = to.includes('@') ? to : `${to}@c.us`;
    await qrClient.sendMessage(chatId, message);
    return;
  }

  const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

  await axios.post(
    url,
    {
      messaging_product: 'whatsapp',
      to,
      text: { body: message },
    },
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
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

async function handleIncomingCloudMessage(messageData, contact = {}) {
  const waId = messageData.from;
  const text = normalizeIncomingText(messageData?.text?.body);
  const profileName = contact?.profile?.name || '';

  await processConversation(waId, text, profileName);
}

function initQrCodeMode() {
  const { Client, LocalAuth } = require('whatsapp-web.js');
  const qrcode = require('qrcode-terminal');

  qrClient = new Client({
    authStrategy: new LocalAuth({ clientId: 'chat-bot' }),
    puppeteer: {
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  qrClient.on('qr', (qr) => {
    console.log('Escaneie o QRCode abaixo com seu WhatsApp para conectar o bot:');
    qrcode.generate(qr, { small: true });
  });

  qrClient.on('ready', () => {
    console.log('WhatsApp conectado com sucesso via QRCode.');
  });

  qrClient.on('message', async (message) => {
    try {
      if (message.fromMe || message.from.includes('@g.us')) {
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

  qrClient.initialize();
}

app.get('/webhook', (req, res) => {
  if (isQrCodeMode) {
    return res.status(200).send('Modo QRCode ativo: endpoint webhook desabilitado.');
  }

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  try {
    if (isQrCodeMode) {
      return res.status(200).json({ ok: true, message: 'Modo QRCode ativo. Webhook ignorado.' });
    }

    const entries = req.body?.entry || [];

    for (const entry of entries) {
      const changes = entry?.changes || [];

      for (const change of changes) {
        const value = change?.value;

        if (!value?.messages?.length) {
          continue;
        }

        const contactsByWaId = new Map((value.contacts || []).map((contact) => [contact.wa_id, contact]));

        for (const message of value.messages) {
          if (message.type !== 'text') {
            continue;
          }

          const contact = contactsByWaId.get(message.from) || value.contacts?.[0];
          await handleIncomingCloudMessage(message, contact);
        }
      }
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error('Erro ao processar webhook:', error?.response?.data || error.message);
    return res.sendStatus(500);
  }
});

app.get('/health', (_, res) => {
  res.status(200).json({
    status: 'ok',
    mode: isQrCodeMode ? 'qrcode' : 'cloud',
  });
});

app.listen(PORT, () => {
  console.log(`Bot de WhatsApp ativo na porta ${PORT} (modo: ${WHATSAPP_CONNECTION_MODE})`);

  if (isQrCodeMode) {
    initQrCodeMode();
  }
});
