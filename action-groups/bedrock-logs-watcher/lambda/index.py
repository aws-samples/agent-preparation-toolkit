import os
import boto3
from typing import Dict, Any
from io import StringIO
import sqlparse


def is_select_statement(sql: str) -> bool:
    """SQLがSELECT文かどうかを判定する"""
    parsed = sqlparse.parse(sql)
    if not parsed:
        return False
    return parsed[0].get_type().upper() == 'SELECT'


def execute_athena_query(sql: str, workgroup: str, event) -> Dict[str, Any]:
    """Athenaクエリを実行し結果をCSV形式で返す"""
    athena_client = boto3.client('athena')

    try:
        print('SQL 実行開始')
        # クエリの実行
        response = athena_client.start_query_execution(
            QueryString=sql, WorkGroup=workgroup
        )
        print('SQL スタート')

        query_execution_id = response['QueryExecutionId']

        # クエリの完了を待つ
        while True:
            query_status = athena_client.get_query_execution(
                QueryExecutionId=query_execution_id
            )
            state = query_status['QueryExecution']['Status']['State']
            if state in ['SUCCEEDED', 'FAILED', 'CANCELLED']:
                print(state)
                break

        if state == 'FAILED':
            error_message = query_status['QueryExecution']['Status'].get(
                'StateChangeReason', 'Unknown error'
            )
            print('Failed')
            print(error_message)
            body = f"{error_message} というエラーが出ました。リクエストを修正してください。"

            response_body = {'text/Csv': {'body': body}}
            action_response = {
                'actionGroup': event['actionGroup'],
                'apiPath': event['apiPath'],
                'httpMethod': event['httpMethod'],
                'httpStatusCode': 200,
                'responseBody': response_body,
            }
            return {'messageVersion': '1.0', 'response': action_response}

        if state == 'CANCELLED':
            print('Query was cancelled')
            body = 'Query was cancelled'

            response_body = {'text/Csv': {'body': body}}
            action_response = {
                'actionGroup': event['actionGroup'],
                'apiPath': event['apiPath'],
                'httpMethod': event['httpMethod'],
                'httpStatusCode': 200,
                'responseBody': response_body,
            }
            return {'messageVersion': '1.0', 'response': action_response}

        # 結果の取得
        results = athena_client.get_query_results(QueryExecutionId=query_execution_id)

        # 結果をCSV形式に変換
        csv_buffer = StringIO()
        header = [
            col['Label']
            for col in results['ResultSet']['ResultSetMetadata']['ColumnInfo']
        ]
        csv_buffer.write(','.join(header) + '\n')

        for row in results['ResultSet']['Rows'][1:]:  # ヘッダー行をスキップ
            values = [field.get('VarCharValue', '') for field in row['Data']]
            csv_buffer.write(','.join(values) + '\n')
        body = csv_buffer.getvalue()
        print(body)
        response_body = {'text/Csv': {'body': body}}
        action_response = {
            'actionGroup': event['actionGroup'],
            'apiPath': event['apiPath'],
            'httpMethod': event['httpMethod'],
            'httpStatusCode': 200,
            'responseBody': response_body,
        }
        return {'messageVersion': '1.0', 'response': action_response}

    except Exception as e:
        print('ERROR Return Content')
        print(str(e))
        return {'statusCode': 200, 'body': str(e)}


def lambda_handler(event: Dict[str, Any], _) -> Dict[str, Any]:

    print(event)

    # WorkGroupの設定
    workgroup = os.environ.get('ATHENA_WORKGROUP', 'dev-bedrock-logs-workgroup')
    table = (
        '"'
        + os.environ.get('DATABASE', 'dev-bedrock_logs_db')
        + '"."'
        + os.environ.get('TABLE', 'dev-bedrock_model_invocation_logs')
        + '"'
    )

    print(table)

    # SQLの取得
    sql = None
    for param in event.get('parameters', []):
        if param.get('name') == 'sql':
            sql = param.get('value').replace('BEDROCK_LOG.INVOCATION_LOG', table)
            break
    print(sql)

    if not sql:
        return {'statusCode': 200, 'body': 'SQL parameter is required'}

    # SELECT文のみ許可
    if not is_select_statement(sql):
        return {'statusCode': 200, 'body': 'Only SELECT statements are allowed'}

    return execute_athena_query(sql, workgroup, event)


if __name__ == "__main__":
    sql = '''SELECT
    schematype,
    schemaversion,
    timestamp,
    accountid,
    identity.arn,
    region,
    requestid,
    operation,
    modelid,
    input.inputcontenttype,
    input.inputTokenCount,
    input.inputbodyjson,
    output.outputcontenttype,
    output.outputTokenCount,
    output.outputbodyjson
FROM BEDROCK_LOG.INVOCATION_LOG
limit 10;'''
    test_event = {
        "messageVersion": "1.0",
        "parameters": [
            {
                "name": "sql",
                "type": "string",
                "value": sql,
            }
        ],
        "inputText": "ログを 10 件取って",
        "apiPath": "/select",
        "sessionId": "XXXXXXXXXXXXXXX",
        "agent": {
            "name": "bedrock-logs-watcher",
            "version": "DRAFT",
            "id": "XXXXXXXXXX",
            "alias": "TSTALIASID",
        },
        "actionGroup": "bedrock-logs-query",
        "sessionAttributes": {},
        "promptSessionAttributes": {},
        "httpMethod": "GET",
    }

    result = lambda_handler(test_event, None)
    print(result)
