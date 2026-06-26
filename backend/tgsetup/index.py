import json
import os
import requests

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}


def handler(event: dict, context) -> dict:
    """Регистрирует webhook и настраивает команды Telegram-бота MailForge."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    token = os.environ['TELEGRAM_BOT_TOKEN']
    params = event.get('queryStringParameters') or {}
    webhook_url = params.get('webhook_url', '')

    if not webhook_url:
        # Вернуть текущий статус webhook
        r = requests.get(f'https://api.telegram.org/bot{token}/getWebhookInfo', timeout=10)
        return {'statusCode': 200, 'headers': CORS, 'body': r.text}

    # Установить webhook
    r = requests.post(
        f'https://api.telegram.org/bot{token}/setWebhook',
        json={'url': webhook_url, 'allowed_updates': ['message']},
        timeout=10,
    )

    # Установить команды бота
    requests.post(
        f'https://api.telegram.org/bot{token}/setMyCommands',
        json={'commands': [
            {'command': 'start', 'description': 'Открыть MailForge'},
            {'command': 'help', 'description': 'Как пользоваться'},
        ]},
        timeout=10,
    )

    # Установить имя и описание
    requests.post(
        f'https://api.telegram.org/bot{token}/setMyDescription',
        json={'description': 'Создавай временные почтовые ящики прямо в Telegram. Письма приходят по-настоящему, ящик живёт 40 минут.'},
        timeout=10,
    )

    return {'statusCode': 200, 'headers': CORS, 'body': r.text}
