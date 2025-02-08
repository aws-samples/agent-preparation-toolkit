import tempfile
import pytest
import os
import traceback
from typing import Dict, Any
from io import StringIO


def write_code(code: str, filename: str):
    """コードをファイルに書き込む"""
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.py') as temp_file:
        temp_file.write(code)
        temp_path = temp_file.name
    new_path = os.path.join(os.path.dirname(temp_path), filename)
    os.rename(temp_path, new_path)
    return new_path


def run_tests(test_path: str) -> Dict[str, Any]:
    """テストを実行する"""
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
    """pytest の出力をキャプチャするためのプラグイン"""

    def __init__(self, stdout_capture, stderr_capture):
        self.stdout_capture = stdout_capture
        self.stderr_capture = stderr_capture

    def pytest_runtest_logreport(self, report):
        if report.failed:
            if hasattr(report, "longrepr"):
                self.stderr_capture.write(str(report.longrepr))


def main(event):
    """メイン処理"""
    try:
        print(event)  # デバッグ用

        parameters = {param["name"]: param["value"] for param in event["parameters"]}
        code = parameters.get("code", "")
        test_code = parameters.get("test_code", "")

        code_path = write_code(code, "main.py")
        test_path = write_code(test_code, "test_main.py")

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

        print(response)  # デバッグ用
        return response

    except Exception as e:
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
