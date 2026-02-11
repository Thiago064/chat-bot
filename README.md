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
- Conta da Meta com WhatsApp Cloud API configurada
- `phone_number_id` e `access_token`

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Preencha as variáveis no `.env`:

- `WHATSAPP_VERIFY_TOKEN`: token para validação do webhook
- `WHATSAPP_ACCESS_TOKEN`: token da Cloud API
- `WHATSAPP_PHONE_NUMBER_ID`: ID do número de WhatsApp na Meta
- `PORT`: porta local (opcional, padrão `3000`)

## Executando

```bash
npm start
```

## Endpoints

- `GET /webhook`: verificação do webhook pela Meta
- `POST /webhook`: recebimento das mensagens
- `GET /health`: healthcheck

## Fluxo de conversa

- Cliente envia qualquer mensagem
- Bot responde menu inicial
- Cliente escolhe `1`, `2` ou `3`
- Bot faz uma pergunta complementar
- Cliente responde detalhes
- Bot finaliza: “aguarde contato do nosso engenheiro responsável”

Comando para reiniciar o fluxo a qualquer momento:

- Enviar `menu`
