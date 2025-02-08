import boto3
import json
from uuid import uuid4

brar = boto3.client('bedrock-agent-runtime')


def main():
    with open('agent_ids.json', 'rt', encoding='utf-8') as f:
        documents = json.load(f)
    prompts = [
        'フィボナッチ数列を列挙するコード',
        # 'Kazuhito Go の年休付与日数は？ただし現在は 2025/1/31 です。',
        # 'E-03'
    ]
    for doc, prompt in zip(documents, prompts):
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
                print("\nTrace:")
                print(f"Agent ID: {trace.get('agentId')}")
                print(f"Agent Alias ID: {trace.get('agentAliasId')}")
                print(f"Session ID: {trace.get('sessionId')}")
                if "trace" in trace:
                    trace_details = trace["trace"]
                    if "orchestrationTrace" in trace_details:
                        orch_trace = trace_details["orchestrationTrace"]
                        if "rationale" in orch_trace:
                            print(f"Rationale: {orch_trace['rationale'].get('text')}")
        print(f'AI: {completion}')


if __name__ == '__main__':
    main()
