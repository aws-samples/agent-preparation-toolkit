import boto3
import json
import argparse
from uuid import uuid4
from time import sleep
import pprint


def main():
    # コマンドライン引数の設定
    parser = argparse.ArgumentParser(
        description='Bedrock Agent Runtime client with region specification'
    )
    parser.add_argument(
        '-r', '--region', required=True, help='AWS region name (e.g., us-west-2)'
    )
    parser.add_argument('--raw', action='store_true', help='Display raw trace data')
    args = parser.parse_args()

    # 引数から受け取ったリージョン名を使用してクライアントを初期化
    brar = boto3.client('bedrock-agent-runtime', region_name=args.region)

    with open('agent_ids.json', 'rt', encoding='utf-8') as f:
        documents = json.load(f)
    prompts = {
        'dev-human-resource-agent': 'Kazuhito Go の今年度の年休付与日数は？',
        'dev-product-support-agent': 'E-03',
        'dev-python-coder': '３次元ベクトルの外積を計算するコードを書いて',
        'dev-bedrock-logs-watcher': 'input token が一番多い人を教えて',
        'dev-contract-searcher': '人に仕事を依頼したい',
    }
    for doc in documents:
        prompt = prompts[doc['agentName']]
        print(f'user: {prompt}')
        response = brar.invoke_agent(
            agentId=doc['agentId'],
            agentAliasId=doc['agentAliasId'],
            sessionId=str(uuid4()),
            inputText=prompt,
            enableTrace=True,  # trace を有効化
        )
        completion = ""
        for event in response.get("completion"):
            if "chunk" in event:
                chunk = event["chunk"]
                completion = completion + chunk["bytes"].decode()
            elif "trace" in event:
                # trace 情報を出力
                trace = event["trace"]
                print("\n===== TRACE INFORMATION =====")
                print(f"Agent ID: {trace.get('agentId')}")
                print(f"Agent Alias ID: {trace.get('agentAliasId')}")
                print(f"Session ID: {trace.get('sessionId')}")

                if "trace" in trace:
                    trace_details = trace["trace"]

                    # 生のトレースデータを表示する場合
                    if args.raw:
                        print("\nRaw Trace Data:")
                        pprint.pprint(trace_details)
                        continue

                    # 前処理トレース
                    if "preProcessingTrace" in trace_details:
                        pre_trace = trace_details["preProcessingTrace"]
                        print("\n--- Pre-Processing Trace ---")
                        if "modelInvocationInput" in pre_trace:
                            input_data = pre_trace["modelInvocationInput"]
                            print(
                                f"Foundation Model: {input_data.get('foundationModel')}"
                            )
                            print(f"Prompt Type: {input_data.get('type')}")

                        if "modelInvocationOutput" in pre_trace:
                            output_data = pre_trace["modelInvocationOutput"]
                            if (
                                "metadata" in output_data
                                and "usage" in output_data["metadata"]
                            ):
                                usage = output_data["metadata"]["usage"]
                                print(f"Input Tokens: {usage.get('inputTokens')}")
                                print(f"Output Tokens: {usage.get('outputTokens')}")

                            if "parsedResponse" in output_data:
                                parsed = output_data["parsedResponse"]
                                print(f"Is Valid: {parsed.get('isValid')}")
                                if "rationale" in parsed:
                                    print(f"Rationale: {parsed.get('rationale')}")

                    # オーケストレーショントレース
                    if "orchestrationTrace" in trace_details:
                        orch_trace = trace_details["orchestrationTrace"]
                        print("\n--- Orchestration Trace ---")

                        # 推論の根拠
                        if "rationale" in orch_trace:
                            print(f"Rationale: {orch_trace['rationale'].get('text')}")

                        # モデル呼び出し入力
                        if "modelInvocationInput" in orch_trace:
                            model_input = orch_trace["modelInvocationInput"]
                            print(f"Model: {model_input.get('foundationModel')}")
                            if "inferenceConfiguration" in model_input:
                                inf_config = model_input["inferenceConfiguration"]
                                print(f"Temperature: {inf_config.get('temperature')}")
                                print(f"Top P: {inf_config.get('topP')}")
                                print(f"Max Length: {inf_config.get('maximumLength')}")

                        # モデル呼び出し出力
                        if "modelInvocationOutput" in orch_trace:
                            model_output = orch_trace["modelInvocationOutput"]
                            if (
                                "metadata" in model_output
                                and "usage" in model_output["metadata"]
                            ):
                                usage = model_output["metadata"]["usage"]
                                print(f"Input Tokens: {usage.get('inputTokens')}")
                                print(f"Output Tokens: {usage.get('outputTokens')}")

                        # 観察結果
                        if "observation" in orch_trace:
                            obs = orch_trace["observation"]
                            print(f"Observation Type: {obs.get('type')}")

                            # アクショングループ呼び出し結果
                            if "actionGroupInvocationOutput" in obs:
                                print("Action Group Output Available")

                            # ナレッジベース検索結果
                            if "knowledgeBaseLookupOutput" in obs:
                                kb_output = obs["knowledgeBaseLookupOutput"]
                                if "retrievedReferences" in kb_output:
                                    refs = kb_output["retrievedReferences"]
                                    print(f"Retrieved {len(refs)} references")
                                    for i, ref in enumerate(refs):
                                        print(f"\nReference {i+1}:")
                                        if (
                                            "content" in ref
                                            and "text" in ref["content"]
                                        ):
                                            print(
                                                f"Content: {ref['content']['text'][:100]}..."
                                            )
                                        if "location" in ref:
                                            loc = ref["location"]
                                            print(f"Location Type: {loc.get('type')}")

                            # 最終応答
                            if "finalResponse" in obs:
                                print(
                                    f"Final Response: {obs['finalResponse'].get('text')[:100]}..."
                                )

                    # 後処理トレース
                    if "postProcessingTrace" in trace_details:
                        post_trace = trace_details["postProcessingTrace"]
                        print("\n--- Post-Processing Trace ---")
                        if "modelInvocationInput" in post_trace:
                            input_data = post_trace["modelInvocationInput"]
                            print(
                                f"Foundation Model: {input_data.get('foundationModel')}"
                            )

                        if "modelInvocationOutput" in post_trace:
                            output_data = post_trace["modelInvocationOutput"]
                            if (
                                "metadata" in output_data
                                and "usage" in output_data["metadata"]
                            ):
                                usage = output_data["metadata"]["usage"]
                                print(f"Input Tokens: {usage.get('inputTokens')}")
                                print(f"Output Tokens: {usage.get('outputTokens')}")

                    # ガードレールトレース
                    if "guardrailTrace" in trace_details:
                        guard_trace = trace_details["guardrailTrace"]
                        print("\n--- Guardrail Trace ---")
                        print(f"Action: {guard_trace.get('action')}")
                        if "inputAssessments" in guard_trace:
                            print(
                                f"Input Assessments: {len(guard_trace['inputAssessments'])}"
                            )
                        if "outputAssessments" in guard_trace:
                            print(
                                f"Output Assessments: {len(guard_trace['outputAssessments'])}"
                            )

                    # 失敗トレース
                    if "failureTrace" in trace_details:
                        fail_trace = trace_details["failureTrace"]
                        print("\n--- Failure Trace ---")
                        print(f"Failure Reason: {fail_trace.get('failureReason')}")

        print(f'AI: {completion}')
        sleep(10)


if __name__ == '__main__':
    main()
