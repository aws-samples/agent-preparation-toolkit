import boto3
import json
from uuid import uuid4

brar = boto3.client('bedrock-agent-runtime')


def main():
    with open('agent_ids.json', 'rt', encoding='utf-8') as f:
        documents = json.load(f)
    prompts = ['Kazuhito Go の年休付与日数は？ただし現在は 2025/1/31 です。', 'E-03']
    for doc, prompt in zip(documents, prompts):
        print(f'user: {prompt}')
        response = brar.invoke_agent(
            agentId=doc['agentId'],
            agentAliasId=doc['agentAliasId'],
            sessionId=str(uuid4()),
            inputText=prompt,
        )
        completion = ""
        for event in response.get("completion"):
            chunk = event["chunk"]
            completion = completion + chunk["bytes"].decode()
        print(f'AI: {completion}')


if __name__ == '__main__':
    main()
