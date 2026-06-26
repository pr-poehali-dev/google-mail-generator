import json
import os
import requests

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}

BASE = 'https://api.mail.tm'


def handler(event: dict, context) -> dict:
    """Прокси для Mail.tm API: создание ящика, получение токена и писем."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    body = json.loads(event.get('body') or '{}')

    # Получить список доступных доменов
    if action == 'domains':
        r = requests.get(f'{BASE}/domains', timeout=10)
        return {'statusCode': r.status_code, 'headers': CORS, 'body': r.text}

    # Создать новый ящик
    if action == 'create' and method == 'POST':
        address = body.get('address')
        password = body.get('password')
        r = requests.post(f'{BASE}/accounts', json={'address': address, 'password': password}, timeout=10)
        if r.status_code not in (200, 201):
            return {'statusCode': r.status_code, 'headers': CORS, 'body': r.text}
        # Получаем токен
        t = requests.post(f'{BASE}/token', json={'address': address, 'password': password}, timeout=10)
        result = {'account': r.json(), 'token': t.json().get('token')}
        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(result)}

    # Получить письма
    if action == 'messages' and method == 'GET':
        token = body.get('token') or params.get('token', '')
        page = params.get('page', '1')
        r = requests.get(
            f'{BASE}/messages?page={page}',
            headers={'Authorization': f'Bearer {token}'},
            timeout=10,
        )
        return {'statusCode': r.status_code, 'headers': CORS, 'body': r.text}

    # Получить одно письмо полностью
    if action == 'message' and method == 'GET':
        token = params.get('token', '')
        msg_id = params.get('id', '')
        r = requests.get(
            f'{BASE}/messages/{msg_id}',
            headers={'Authorization': f'Bearer {token}'},
            timeout=10,
        )
        return {'statusCode': r.status_code, 'headers': CORS, 'body': r.text}

    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Unknown action'})}
