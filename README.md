# WhatsApp Lead Bot (triagem de clientes)

Bot para WhatsApp com foco em triagem de clientes em potencial, operando **somente por conexão via QRCode** (WhatsApp Web).

## Posso usar sem IDE e sem VS Code?

Sim. Você pode rodar apenas com terminal.

## Posso usar com “dois cliques” em um `.exe`?

Sim. Este projeto foi adaptado para empacotamento como executável Windows (`.exe`) usando `pkg`.

---

## Requisitos

- Node.js 18+
- NPM
- Internet na máquina de build para baixar dependências

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Ajuste o `.env` (opcional):

- `PORT`: porta local (padrão `3000`)
- `CHROME_EXECUTABLE_PATH`: caminho absoluto do Chrome/Chromium
- `BOT_DATA_DIR`: diretório onde o bot salva sessão/autenticação

---

## Executar em modo desenvolvimento (sem .exe)

```bash
npm run setup:chrome
npm run start:qrcode
```

Ao iniciar, o terminal exibirá um QRCode. Escaneie com o WhatsApp para conectar o bot.

Esta versão responde **somente mensagens novas recebidas em conversa direta** (`@c.us`).
Grupos, listas/broadcast, canais e status são ignorados.

---

## Gerar executável `.exe` (Windows)

### 1) Na máquina de build

```bash
npm install
npm run setup:chrome
npm run build:exe
```

O arquivo será gerado em:

- `dist/whatsapp-lead-bot.exe`

### 2) Arquivos para copiar para outra máquina

Copie para a máquina destino:

- `dist/whatsapp-lead-bot.exe`
- um arquivo `.env` (ao lado do `.exe`) com suas configurações

Exemplo `.env` mínimo na máquina destino:

```env
PORT=3000
# CHROME_EXECUTABLE_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
# BOT_DATA_DIR=C:\whatsapp-lead-bot-data
```

### 3) Rodar na máquina destino

- Dê dois cliques em `whatsapp-lead-bot.exe` **ou** rode no terminal:

```bash
./whatsapp-lead-bot.exe
```

O bot lerá o `.env` do mesmo diretório do executável.

---

## Troubleshooting

- **Could not find Chrome**
  - Instale o Chrome na máquina, ou
  - configure `CHROME_EXECUTABLE_PATH` no `.env`.
- **Execution context was destroyed / Protocol error**
  - O bot já tenta reiniciar automaticamente algumas vezes antes de encerrar.

## Endpoints

- `GET /health`: healthcheck
- `GET /webhook` e `POST /webhook`: apenas informativos (webhook desabilitado no modo QRCode-only)
