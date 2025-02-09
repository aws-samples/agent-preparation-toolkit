import boto3
import json
from uuid import uuid4
from time import sleep

brar = boto3.client('bedrock-agent-runtime')


def main():
    with open('agent_ids.json', 'rt', encoding='utf-8') as f:
        documents = json.load(f)
    prompts = {
        'dev-human-resource-agent': 'Kazuhito Go の今年度の年休付与日数は？',
        'dev-product-support-agent': 'E-03',
        'dev-python-coder': '３次元ベクトルの外積を計算するコードを書いて',
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
        sleep(10)


if __name__ == '__main__':
    main()
