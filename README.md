# WhatsApp Lead Bot (triagem de clientes)

Bot para WhatsApp com foco em triagem de clientes em potencial. Quando recebe uma mensagem de um contato, responde com:

1. Saudação básica.
2. Menu com três opções:
   - Projeto em andamento
   - Agendar reunião
   - Solicitar orçamento
3. Pergunta de detalhamento conforme a opção escolhida.
4. Mensagem final pedindo para aguardar contato do engenheiro responsável.

## Requisitos

- Node.js 18+
- NPM

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Configure o modo de conexão no `.env`:

- `WHATSAPP_CONNECTION_MODE=cloud` para usar WhatsApp Cloud API
- `WHATSAPP_CONNECTION_MODE=qrcode` para conectar via QRCode (WhatsApp Web)

### Variáveis para modo Cloud API

Necessárias apenas quando `WHATSAPP_CONNECTION_MODE=cloud`:

- `WHATSAPP_VERIFY_TOKEN`: token para validação do webhook
- `WHATSAPP_ACCESS_TOKEN`: token da Cloud API
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número de WhatsApp na Meta

## Executando

### Modo Cloud API

```bash
npm run start:cloud
```

### Modo QRCode (conectar WhatsApp direto no bot)

```bash
npm run start:qrcode
```

Ao iniciar em modo QRCode, o terminal exibirá um QRCode. Escaneie com o WhatsApp para conectar.

## Endpoints

- `GET /webhook`: verificação do webhook pela Meta (somente no modo cloud)
- `POST /webhook`: recebimento das mensagens (somente no modo cloud)
- `GET /health`: healthcheck (retorna o modo ativo: `cloud` ou `qrcode`)

## Fluxo de conversa

- Cliente envia qualquer mensagem
- Bot responde menu inicial
- Cliente escolhe `1`, `2` ou `3`
- Bot faz uma pergunta complementar
- Cliente responde detalhes
- Bot finaliza: “aguarde contato do nosso engenheiro responsável”

Comando para reiniciar o fluxo a qualquer momento:

- Enviar `menu`
