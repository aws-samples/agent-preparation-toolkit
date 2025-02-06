import sqlite3
import json
from typing import Dict, Any


def create_error_response(
    event: Dict[str, Any], error_message: str, status_code: int = 400
) -> Dict[str, Any]:
    """エラーレスポンスを生成する関数"""
    response_body = {
        'application/json': {
            'body': json.dumps({'error': error_message}, ensure_ascii=False)
        }
    }
    action_response = {
        'actionGroup': event['actionGroup'],
        'apiPath': event['apiPath'],
        'httpMethod': event['httpMethod'],
        'httpStatusCode': status_code,
        'responseBody': response_body,
    }
    return {'messageVersion': '1.0', 'response': action_response}


def lambda_handler(event: Dict[str, Any], _) -> Dict[str, Any]:
    try:
        print(event)
        api_path = event.get("apiPath")
        if not api_path:
            return create_error_response(event, "APIパスが指定されていません。")

        if api_path != "/select":
            return create_error_response(event, f"未対応のAPIパス: {api_path}")

        # SQLパラメータの取得
        parameters = event.get('parameters', [])
        sql = None
        for param in parameters:
            if param.get('name') == 'sql':
                sql = param.get('value')
                break

        if not sql:
            return create_error_response(event, "SQLクエリが指定されていません。")

        # SQLインジェクション対策のための簡易チェック
        dangerous_keywords = ["DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE"]
        if any(keyword in sql.upper() for keyword in dangerous_keywords):
            return create_error_response(
                event, "不正なSQLクエリが検出されました。", 403
            )

        # データベース接続
        db_path = '/tmp/support.db'
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
        except sqlite3.Error as e:
            return create_error_response(
                event, f"データベース接続エラー: {str(e)}", 500
            )

        try:
            # テーブル作成
            ddl = '''
            CREATE TABLE IF NOT EXISTS support (
                error_code TEXT NOT NULL,
                support TEXT NOT NULL,
                date DATE NOT NULL,
                supporter TEXT NOT NULL,
                device_id TEXT NOT NULL
            )
            '''
            cursor.execute(ddl)

            # サンプルデータ投入
            support = [
                (
                    'E-01',
                    '給紙トレイの用紙補充と用紙ガイドの調整を実施。センサー部分の清掃も行った',
                    '2023-11-01',
                    '山田太郎',
                    'PRN-2023-0001',
                ),
                (
                    'E-02',
                    '後部カバーを開けて詰まった用紙を除去。給紙ローラーの清掃も実施',
                    '2023-11-02',
                    '鈴木花子',
                    'PRN-2023-0054',
                ),
                (
                    'E-01',
                    '用紙センサーの清掃とファームウェアの再起動で解決',
                    '2023-11-02',
                    '佐藤次郎',
                    'PRN-2023-0078',
                ),
                (
                    'E-03',
                    '純正トナーカートリッジへの交換を実施。装着位置の調整も行った',
                    '2023-11-03',
                    '田中明子',
                    'PRN-2023-0023',
                ),
                (
                    'E-04',
                    'カバーセンサーの清掃とカバーヒンジの調整を実施',
                    '2023-11-03',
                    '山田太郎',
                    'PRN-2023-0089',
                ),
                (
                    'E-05',
                    'ヘッドクリーニングを3回実施。その後テストページで印刷品質を確認',
                    '2023-11-04',
                    '鈴木花子',
                    'PRN-2023-0012',
                ),
                (
                    'E-02',
                    '給紙ローラーの交換を実施。メンテナンスキットによる定期点検も実施',
                    '2023-11-04',
                    '佐藤次郎',
                    'PRN-2023-0045',
                ),
                (
                    'E-03',
                    'カートリッジの抜き差しとクリーニングを実施。認識エラー解消',
                    '2023-11-05',
                    '田中明子',
                    'PRN-2023-0067',
                ),
                (
                    'E-04',
                    'カバーの破損を確認。交換部品の手配と修理を実施',
                    '2023-11-05',
                    '山田太郎',
                    'PRN-2023-0034',
                ),
                (
                    'E-05',
                    'インクパッドの交換とヘッドクリーニングを実施',
                    '2023-11-06',
                    '鈴木花子',
                    'PRN-2023-0098',
                ),
            ]
            cursor.executemany(
                'INSERT OR IGNORE INTO support VALUES (?, ?, ?, ?, ?)', support
            )
            conn.commit()

            # クエリ実行
            cursor.execute(sql)

            # カラム名を取得
            columns = [description[0] for description in cursor.description]

            # 結果を取得
            rows = cursor.fetchall()

            # 連想配列のリストを作成
            result_list = []
            for row in rows:
                row_dict = {columns[i]: value for i, value in enumerate(row)}
                result_list.append(row_dict)

            # JSON文字列に変換
            json_string = json.dumps(result_list, ensure_ascii=False)

            response_body = {'application/json': {'body': json_string}}
            action_response = {
                'actionGroup': event['actionGroup'],
                'apiPath': event['apiPath'],
                'httpMethod': event['httpMethod'],
                'httpStatusCode': 200,
                'responseBody': response_body,
            }
            return {'messageVersion': '1.0', 'response': action_response}

        except sqlite3.Error as e:
            return create_error_response(event, f"SQLクエリ実行エラー: {str(e)}", 500)

        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        return create_error_response(
            event, f"予期せぬエラーが発生しました: {str(e)}", 500
        )


# ローカルでテストする場合
if __name__ == "__main__":
    test_event = {
        "messageVersion": "1.0",
        "parameters": [
            {
                "name": "sql",
                "type": "string",
                "value": "SELECT error_code, support, date, supporter, device_id FROM support WHERE error_code = 'E-01'",
            }
        ],
        "inputText": "E-01 のログを教えて",
        "apiPath": "/select",
        "sessionId": "290000338583531",
        "agent": {
            "name": "hr",
            "version": "DRAFT",
            "id": "OEEPPYDESQ",
            "alias": "TSTALIASID",
        },
        "actionGroup": "hr-db-access",
        "sessionAttributes": {},
        "promptSessionAttributes": {},
        "httpMethod": "GET",
    }
    result = lambda_handler(test_event, None)
    print(result)
