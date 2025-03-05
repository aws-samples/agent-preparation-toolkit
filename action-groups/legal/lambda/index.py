import json
import os
import boto3
from botocore.exceptions import ClientError

s3_client = boto3.client('s3')
bucket_name = os.environ.get('CONTRACT_BUCKET')
doc_data_prefix = os.environ.get('DOC_DATA_PREFIX')


def lambda_handler(event, context):
    try:
        print(f"Received event: {json.dumps(event)}")

        # 環境変数からバケット名を取得

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

        # パラメータからファイル名を取得（/listと/getの両方で使用）
        parameters = event.get('parameters', [])
        file_name = None

        for param in parameters:
            if param.get('name') == 'text':
                file_name = param.get('value', '')
                break

        # /list エンドポイント - バケット内のファイルとその更新日を返す
        if api_path == '/list':
            return list_files(bucket_name, event, file_name)

        # /get エンドポイント - 指定されたキーのファイルの署名付きURLを返す
        elif api_path == '/get':
            if not file_name:
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

            return get_signed_url(bucket_name, file_name, event)

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


def list_files(bucket_name, event, file_name=None):
    """S3バケット内のファイルとその更新日を返す。file_nameが指定された場合は一致するファイルのみを返す"""
    try:
        response = s3_client.list_objects_v2(Bucket=bucket_name, Prefix=doc_data_prefix)

        files = []
        if 'Contents' in response:
            for item in response['Contents']:
                # ファイル名が指定されていない、または指定されたファイル名に一致する場合のみ追加
                if file_name is None or file_name in item['Key']:
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
        expiration = 3600  # 60分

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
