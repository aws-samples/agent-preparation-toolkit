import tempfile
import pytest
import os
import traceback
import logging
from typing import Dict, Any
from io import StringIO
from datetime import datetime

# ログの設定
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ログフォーマットの設定
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')

# 既存のハンドラをクリアして新しいハンドラを追加
if logger.handlers:
    logger.handlers.clear()
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.addHandler(handler)


def write_code(code: str, filename: str, directory: str) -> str:
    """コードをファイルに書き込む"""
    file_path = os.path.join(directory, filename)
    logger.debug(f"Writing code to file: {file_path}")
    try:
        with open(file_path, 'w') as f:
            f.write(code)
        logger.info(f"Successfully wrote code to {filename}")
        return file_path
    except Exception as e:
        logger.error(f"Failed to write code to {filename}: {str(e)}")
        raise


def run_tests(test_path: str) -> Dict[str, Any]:
    """テストを実行する"""
    logger.info(f"Starting test execution: {test_path}")
    try:
        capture_output = StringIO()
        stderr_output = StringIO()

        start_time = datetime.now()
        plugin = CaptureManager(capture_output, stderr_output)
        result = pytest.main(["-v", test_path], plugins=[plugin])
        execution_time = (datetime.now() - start_time).total_seconds()

        output = capture_output.getvalue()
        error_output = stderr_output.getvalue()

        if result == 0:
            status = "success"
            message = "All tests passed!"
            logger.info(f"Tests passed successfully in {execution_time:.2f} seconds")
        else:
            status = "failure"
            message = "Some tests failed."
            logger.warning(f"Tests failed in {execution_time:.2f} seconds")
            logger.debug(f"Test output: {output}")
            logger.debug(f"Error output: {error_output}")

        return {
            "status": status,
            "message": message,
            "exitCode": result,
            "output": output,
            "error": error_output,
            "executionTime": f"{execution_time:.2f}s",
        }
    except Exception as e:
        logger.error(f"Test execution failed: {str(e)}")
        logger.error(traceback.format_exc())
        return {
            "status": "error",
            "message": str(e),
            "exitCode": 1,
            "output": "",
            "error": str(e),
            "executionTime": "0s",
        }


class CaptureManager:
    """テスト出力をキャプチャするプラグイン"""

    def __init__(self, stdout_capture, stderr_capture):
        self.stdout_capture = stdout_capture
        self.stderr_capture = stderr_capture

    def pytest_runtest_logreport(self, report):
        if report.failed:
            if hasattr(report, "longrepr"):
                error_msg = str(report.longrepr)
                self.stderr_capture.write(error_msg)
                logger.error(f"Test failed: {report.nodeid}")
                logger.debug(f"Error details: {error_msg}")


def main(event: Dict) -> Dict:
    """メイン処理を実行する"""
    request_id = event.get('sessionId', 'unknown')
    logger.info(f"Starting main function with request ID: {request_id}")

    try:
        logger.debug(f"Received event: {event}")

        parameters = {param["name"]: param["value"] for param in event["parameters"]}
        code = parameters.get("code", "")
        test_code = parameters.get("test_code", "")

        with tempfile.TemporaryDirectory() as temp_dir:
            logger.info(f"Created temporary directory: {temp_dir}")

            code_path = write_code(code, "main.py", temp_dir)
            test_path = write_code(test_code, "test_main.py", temp_dir)

            result = run_tests(test_path)
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

            logger.info(f"Request {request_id} completed successfully")
            return response

    except Exception as e:
        logger.error(f"Request {request_id} failed with error: {str(e)}")
        logger.error(traceback.format_exc())
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


def lambda_handler(event: Dict, context: Any) -> Dict:
    """Lambda handler"""
    if context:
        logger.info(f"Lambda function ARN: {context.invoked_function_arn}")
        logger.info(f"CloudWatch log stream name: {context.log_stream_name}")
        logger.info(f"CloudWatch log group name: {context.log_group_name}")
        logger.info(f"Request ID: {context.aws_request_id}")
        logger.info(f"Mem. limits(MB): {context.memory_limit_in_mb}")

    return main(event)
