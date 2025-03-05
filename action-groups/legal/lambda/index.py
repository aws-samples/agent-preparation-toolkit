import json
import os
import boto3
from botocore.exceptions import ClientError

# S3クライアントの初期化
s3_client = boto3.client('s3')


def lambda_handler(event, context):
    try:
        print(f"Received event: {json.dumps(event)}")

        # 環境変数からバケット名を取得
        bucket_name = os.environ.get('CONTRACT_BUCKET')
        if not bucket_name:
            error_body = {'error': 'CONTRACT_BUCKET environment variable is not set'}
            response_body = {'application/json': {'body': error_body}}
            print(f"Error response: {response_body}")

            action_response = {
                'actionGroup': event.get('actionGroup', ''),
                'apiPath': event.get('apiPath', ''),
                'httpMethod': event.get('httpMethod', ''),
                'httpStatusCode': 500,
                'responseBody': response_body,
            }
            return {'messageVersion': '1.0', 'response': action_response}

        # APIパスを取得
        api_path = event.get('apiPath', '')

        # /list エンドポイント - バケット内のすべてのファイルとその更新日を返す
        if api_path == '/list':
            return list_files(bucket_name, event)

        # /get エンドポイント - 指定されたキーのファイルの署名付きURLを返す
        elif api_path == '/get':
            # パラメータからキーを取得
            parameters = event.get('parameters', [])
            file_key = None

            for param in parameters:
                if param.get('name') == 'text':
                    file_key = param.get('value', '')
                    break

            if not file_key:
                error_body = {'error': 'File key not provided'}
                response_body = {'application/json': {'body': error_body}}
                print(f"Error response: {response_body}")

                action_response = {
                    'actionGroup': event.get('actionGroup', ''),
                    'apiPath': event.get('apiPath', ''),
                    'httpMethod': event.get('httpMethod', ''),
                    'httpStatusCode': 400,
                    'responseBody': response_body,
                }
                return {'messageVersion': '1.0', 'response': action_response}

            return get_signed_url(bucket_name, file_key, event)

        else:
            error_body = {'error': f'Invalid API path: {api_path}'}
            response_body = {'application/json': {'body': error_body}}
            print(f"Error response: {response_body}")

            action_response = {
                'actionGroup': event.get('actionGroup', ''),
                'apiPath': event.get('apiPath', ''),
                'httpMethod': event.get('httpMethod', ''),
                'httpStatusCode': 404,
                'responseBody': response_body,
            }
            return {'messageVersion': '1.0', 'response': action_response}

    except Exception as e:
        error_body = {'error': str(e)}
        response_body = {'application/json': {'body': error_body}}
        print(f"Error response: {response_body}")

        action_response = {
            'actionGroup': event.get('actionGroup', ''),
            'apiPath': event.get('apiPath', ''),
            'httpMethod': event.get('httpMethod', ''),
            'httpStatusCode': 500,
            'responseBody': response_body,
        }
        return {'messageVersion': '1.0', 'response': action_response}


def list_files(bucket_name, event):
    """S3バケット内のすべてのファイルとその更新日を返す"""
    try:
        response = s3_client.list_objects_v2(Bucket=bucket_name)

        files = []
        if 'Contents' in response:
            for item in response['Contents']:
                # ISO形式の日時文字列に変換
                last_modified = item['LastModified'].isoformat()
                files.append({'key': item['Key'], 'lastModified': last_modified})

        body = {'files': files}
        response_body = {'application/json': {'body': body}}
        print(f"Success response: {response_body}")

        action_response = {
            'actionGroup': event.get('actionGroup', ''),
            'apiPath': event.get('apiPath', ''),
            'httpMethod': event.get('httpMethod', ''),
            'httpStatusCode': 200,
            'responseBody': response_body,
        }
        return {'messageVersion': '1.0', 'response': action_response}

    except ClientError as e:
        error_body = {'error': str(e)}
        response_body = {'application/json': {'body': error_body}}
        print(f"Error response: {response_body}")

        action_response = {
            'actionGroup': event.get('actionGroup', ''),
            'apiPath': event.get('apiPath', ''),
            'httpMethod': event.get('httpMethod', ''),
            'httpStatusCode': 500,
            'responseBody': response_body,
        }
        return {'messageVersion': '1.0', 'response': action_response}


def get_signed_url(bucket_name, file_key, event):
    """指定されたキーのファイルの署名付きURLを生成して返す"""
    try:
        # 署名付きURLの有効期限（秒）
        expiration = 300  # 1時間

        # 署名付きURLを生成
        signed_url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': bucket_name, 'Key': file_key},
            ExpiresIn=expiration,
        )

        body = {'signedUrl': signed_url, 'expiresIn': expiration, 'fileName': file_key}
        response_body = {'application/json': {'body': body}}
        print(f"Success response: {response_body}")

        action_response = {
            'actionGroup': event.get('actionGroup', ''),
            'apiPath': event.get('apiPath', ''),
            'httpMethod': event.get('httpMethod', ''),
            'httpStatusCode': 200,
            'responseBody': response_body,
        }
        return {'messageVersion': '1.0', 'response': action_response}

    except ClientError as e:
        error_body = {'error': str(e)}
        response_body = {'application/json': {'body': error_body}}
        print(f"Error response: {response_body}")

        action_response = {
            'actionGroup': event.get('actionGroup', ''),
            'apiPath': event.get('apiPath', ''),
            'httpMethod': event.get('httpMethod', ''),
            'httpStatusCode': 500,
            'responseBody': response_body,
        }
        return {'messageVersion': '1.0', 'response': action_response}


if __name__ == "__main__":
    BUCKET_NAME = 'type your bucket'
    os.environ['CONTRACT_BUCKET'] = BUCKET_NAME
    test_event = {
        "messageVersion": "1.0",
        "parameters": [
            {
                "name": "text",
                "type": "string",
                "value": "type your file prefix",
            }
        ],
        "inputText": "この契約書をみて",
        "apiPath": "/list",
        "sessionId": "XXXXXXXXXXXXXXX",
        "agent": {
            "name": "legal-agent",
            "version": "DRAFT",
            "id": "XXXXXXXXXX",
            "alias": "TSTALIASID",
        },
        "actionGroup": "legal-doc-searcher",
        "sessionAttributes": {},
        "promptSessionAttributes": {},
        "httpMethod": "GET",
    }
    result = lambda_handler(test_event, None)
    print(result)
