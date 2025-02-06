import asyncio
import json
import argparse
import aioboto3


class AsyncAwsOperations:
    def __init__(self):
        self.session = aioboto3.Session()

    async def parse_args(self):
        parser = argparse.ArgumentParser()
        parser.add_argument(
            '--stack-name',
            '-s',
            required=False,
            help='Cfn Stack Name',
        )
        return parser.parse_args()

    async def get_cloudformation_outputs(self, stack_name):
        async with self.session.client('cloudformation') as cfn:
            response = await cfn.describe_stacks(StackName=stack_name)
            return response['Stacks'][0]['Outputs']

    async def start_ingestion_job(self, knowledge_base_id, data_source_id):
        async with self.session.client('bedrock-agent') as bra:
            response = await bra.start_ingestion_job(
                knowledgeBaseId=knowledge_base_id,
                dataSourceId=data_source_id,
            )
            return {
                'ingestionJobId': response['ingestionJob']['ingestionJobId'],
                'dataSourceId': data_source_id,
                'knowledgeBaseId': knowledge_base_id,
            }

    async def check_ingestion_job_status(self, job_info):
        async with self.session.client('bedrock-agent') as bra:
            while True:
                try:
                    response = await bra.get_ingestion_job(
                        knowledgeBaseId=job_info['knowledgeBaseId'],
                        dataSourceId=job_info['dataSourceId'],
                        ingestionJobId=job_info['ingestionJobId'],
                    )
                    status = response['ingestionJob']['status']

                    if status in ['FAILED', 'COMPLETE']:
                        print(f"Ingestion Job {job_info['ingestionJobId']} is {status}")
                        return status

                    await asyncio.sleep(5)

                except Exception as e:
                    print(f"Error checking job status: {e}")
                    return 'ERROR'

    async def process_ingestion_jobs(self, ids):
        ingestion_jobs = []
        for id_info in ids:
            for data_source_id in id_info['DataSourceId']:
                job = await self.start_ingestion_job(
                    id_info['knowledgeBaseId'], data_source_id
                )
                ingestion_jobs.append(job)

        status_tasks = [self.check_ingestion_job_status(job) for job in ingestion_jobs]
        await asyncio.gather(*status_tasks)

        return ingestion_jobs

    async def save_agent_ids(self, ids):
        documents = [
            {
                'agentId': id_info['agentId'],
                'agentAliasId': id_info['agentAliasId'],
            }
            for id_info in ids
        ]

        with open('agent_ids.json', 'wt', encoding='utf-8') as f:
            f.write(json.dumps(documents, indent=2))

    async def main(self):
        args = await self.parse_args()

        outputs = await self.get_cloudformation_outputs(args.stack_name)

        ids = []
        for output in outputs:
            data = output['OutputValue']
            if 'agentId' in data:
                ids.append(json.loads(data))

        await self.process_ingestion_jobs(ids)

        await self.save_agent_ids(ids)


def main():
    asyncio.run(AsyncAwsOperations().main())


if __name__ == '__main__':
    main()
