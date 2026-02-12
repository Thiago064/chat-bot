# WhatsApp Lead Bot (triagem de clientes)

Bot para WhatsApp com foco em triagem de clientes em potencial, operando **somente por conexão via QRCode** (WhatsApp Web).

Quando recebe uma mensagem de um contato, responde com:

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

3. Ajuste o `.env`:

- `PORT`: porta local (padrão `3000`)
- `CHROME_EXECUTABLE_PATH` (opcional): caminho absoluto do Chrome/Chromium. Útil no Windows quando o Puppeteer não encontra o navegador automaticamente.

## Executando (QRCode)

```bash
npm run setup:chrome
npm run start:qrcode
```

Ao iniciar, o terminal exibirá um QRCode. Escaneie com o WhatsApp para conectar o bot.

Se aparecer erro como `Could not find Chrome`, execute `npm run setup:chrome` novamente ou configure `CHROME_EXECUTABLE_PATH` no `.env` com o caminho do seu `chrome.exe`.

> Observação: os scripts usam `--no-deprecation` para ocultar o aviso `[DEP0040] punycode`, que é emitido por dependência interna do ecossistema do WhatsApp Web no Node.js atual.

## Endpoints

- `GET /health`: healthcheck
- `GET /webhook` e `POST /webhook`: retornam mensagem informando que webhook está desabilitado, pois esta versão opera apenas com QRCode

## Fluxo de conversa

- Cliente envia qualquer mensagem
- Bot responde menu inicial
- Cliente escolhe `1`, `2` ou `3`
- Bot faz uma pergunta complementar
- Cliente responde detalhes
- Bot finaliza: “aguarde contato do nosso engenheiro responsável”

Comando para reiniciar o fluxo a qualquer momento:

- Enviar `menu`
