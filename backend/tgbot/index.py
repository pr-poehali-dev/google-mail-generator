import json
import os
import requests

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

MINI_APP_URL = 'https://google-mail-generator.poehali.dev'


def send_message(chat_id: int, text: str, reply_markup: dict = None):
    token = os.environ['TELEGRAM_BOT_TOKEN']
    payload = {'chat_id': chat_id, 'text': text, 'parse_mode': 'HTML'}
    if reply_markup:
        payload['reply_markup'] = json.dumps(reply_markup)
    requests.post(f'https://api.telegram.org/bot{token}/sendMessage', json=payload, timeout=10)


def handler(event: dict, context) -> dict:
    """Webhook Telegram-бота MailForge. Обрабатывает команду /start и открывает Mini App."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    message = body.get('message') or body.get('edited_message')

    if not message:
        return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}

    chat_id = message['chat']['id']
    text = message.get('text', '')
    first_name = message.get('from', {}).get('first_name', 'друг')

    if text.startswith('/start'):
        send_message(
            chat_id,
            f'👋 Привет, <b>{first_name}</b>!\n\n'
            f'Я помогу создать временную почту прямо здесь, в Telegram.\n\n'
            f'Нажми кнопку ниже — ящик будет готов за секунду 👇',
            reply_markup={
                'inline_keyboard': [[
                    {
                        'text': '📬 Открыть MailForge',
                        'web_app': {'url': MINI_APP_URL}
                    }
                ]]
            }
        )
    elif text.startswith('/help'):
        send_message(
            chat_id,
            '📖 <b>Как пользоваться:</b>\n\n'
            '1. Нажми /start\n'
            '2. Открой приложение кнопкой\n'
            '3. Создай временный ящик\n'
            '4. Используй адрес для регистрации на любом сайте\n'
            '5. Письма придут прямо в приложение\n\n'
            '⏱ Каждый ящик живёт 40 минут'
        )
    else:
        send_message(
            chat_id,
            'Нажми /start чтобы открыть приложение 📬'
        )

    return {'statusCode': 200, 'headers': CORS, 'body': 'ok'}
