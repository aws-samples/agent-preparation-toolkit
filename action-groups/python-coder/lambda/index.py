import tempfile
import pytest
import os
import traceback
from typing import Dict, Any
from io import StringIO


def write_code(code: str, filename: str, directory: str):
    file_path = os.path.join(directory, filename)
    with open(file_path, 'w') as f:
        f.write(code)
    return file_path


def run_tests(test_path: str) -> Dict[str, Any]:
    try:
        capture_output = StringIO()
        stderr_output = StringIO()

        plugin = CaptureManager(capture_output, stderr_output)
        result = pytest.main(["-v", test_path], plugins=[plugin])

        output = capture_output.getvalue()
        error_output = stderr_output.getvalue()

        if result == 0:
            status = "success"
            message = "All tests passed!"
        else:
            status = "failure"
            message = "Some tests failed."

        return {
            "status": status,
            "message": message,
            "exitCode": result,
            "output": output,
            "error": error_output,
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "exitCode": 1,
            "output": "",
            "error": str(e),
        }


class CaptureManager:
    def __init__(self, stdout_capture, stderr_capture):
        self.stdout_capture = stdout_capture
        self.stderr_capture = stderr_capture

    def pytest_runtest_logreport(self, report):
        if report.failed:
            if hasattr(report, "longrepr"):
                self.stderr_capture.write(str(report.longrepr))


def main(event):
    try:
        print('main 関数スタート')
        print('イベント受信')
        print(event)  # デバッグ用

        parameters = {param["name"]: param["value"] for param in event["parameters"]}
        code = parameters.get("code", "")
        test_code = parameters.get("test_code", "")

        with tempfile.TemporaryDirectory() as temp_dir:
            # 同じディレクトリにコードとテストコードを書き込む
            code_path = write_code(code, "main.py", temp_dir)
            test_path = write_code(test_code, "test_main.py", temp_dir)

            result = run_tests(test_path)

            # コードとテストコードも結果に含める
            result["code"] = code
            result["test_code"] = test_code

            response = {
                "messageVersion": "1.0",
                "response": {
                    "actionGroup": event["actionGroup"],
                    "apiPath": event["apiPath"],
                    "httpMethod": event["httpMethod"],
                    "httpStatusCode": 200,
                    "responseBody": {"application/json": {"result": result}},
                },
            }
        print('--処理完了--')
        print(response)  # デバッグ用
        return response

    except Exception as e:
        print('--例外発生--')
        print(e)  # デバッグ用
        return {
            "messageVersion": "1.0",
            "response": {
                "actionGroup": event["actionGroup"],
                "apiPath": event["apiPath"],
                "httpMethod": event["httpMethod"],
                "httpStatusCode": 500,
                "responseBody": {
                    "application/json": {
                        "error": str(e),
                        "traceback": traceback.format_exc(),
                    }
                },
            },
        }


def lambda_handler(event, context):
    """Lambda handler"""
    return main(event)


if __name__ == "__main__":
    event = {
        'messageVersion': '1.0',
        'parameters': [
            {
                'name': 'code',
                'type': 'string',
                'value': 'def fibonacci(n):\n    if not isinstance(n, int):\n        raise TypeError("Input must be an integer")\n    if n < 0:\n        raise ValueError("Input must be non-negative")\n    if n == 0:\n        return []\n    if n == 1:\n        return [0]\n    \n    fib = [0, 1]\n    for i in range(2, n):\n        fib.append(fib[i-1] + fib[i-2])\n    return fib\n\n# テスト用のコード\ndef test_fibonacci_basic():\n    assert fibonacci(0) == []\n    assert fibonacci(1) == [0]\n    assert fibonacci(2) == [0, 1]\n    assert fibonacci(5) == [0, 1, 1, 2, 3]\n    assert fibonacci(8) == [0, 1, 1, 2, 3, 5, 8, 13]\n\ndef test_fibonacci_error_cases():\n    with pytest.raises(ValueError):\n        fibonacci(-1)\n    with pytest.raises(TypeError):\n        fibonacci(3.5)\n    with pytest.raises(TypeError):\n        fibonacci("3")\n\ndef test_fibonacci_specific_positions():\n    result = fibonacci(10)\n    assert result[7] == 13  # 8番目の数\n    assert result[9] == 34  # 10番目の数',
            },
            {
                'name': 'test_code',
                'type': 'string',
                'value': 'from main import fibonacci\nimport pytest\n\ndef test_fibonacci_basic():\n    assert fibonacci(0) == []\n    assert fibonacci(1) == [0]\n    assert fibonacci(2) == [0, 1]\n    assert fibonacci(5) == [0, 1, 1, 2, 3]\n    assert fibonacci(8) == [0, 1, 1, 2, 3, 5, 8, 13]\n\ndef test_fibonacci_error_cases():\n    with pytest.raises(ValueError):\n        fibonacci(-1)\n    with pytest.raises(TypeError):\n        fibonacci(3.5)\n    with pytest.raises(TypeError):\n        fibonacci("3")\n\ndef test_fibonacci_specific_positions():\n    result = fibonacci(10)\n    assert result[7] == 13  # 8番目の数\n    assert result[9] == 34  # 10番目の数',
            },
        ],
        'sessionId': '290000338583472',
        'agent': {
            'name': 'Dev-python-coder',
            'version': 'DRAFT',
            'id': 'PDBIB8DMUT',
            'alias': 'TSTALIASID',
        },
        'actionGroup': 'tester',
        'promptSessionAttributes': {},
        'sessionAttributes': {},
        'inputText': 'フィボナッチ数列を列挙するコード',
        'httpMethod': 'GET',
        'apiPath': '/code/test',
    }
    lambda_handler(event, None)
