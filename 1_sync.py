import json
import argparse
import boto3
import time


class AwsOperations:
    def __init__(self, region=None):
        self.session = boto3.Session()
        self.region = region

    def parse_args(self):
        parser = argparse.ArgumentParser()
        parser.add_argument(
            '--stack-name',
            '-s',
            required=True,
            help='Cfn Stack Name',
        )
        parser.add_argument(
            '--region',
            '-r',
            required=True,
            help='region',
        )
        return parser.parse_args()

    def get_cloudformation_outputs(self, stack_name):
        cfn = self.session.client('cloudformation', region_name=self.region)
        response = cfn.describe_stacks(StackName=stack_name)
        return response['Stacks'][0]['Outputs']

    def start_ingestion_job(self, knowledge_base_id, data_source_id):
        bra = self.session.client('bedrock-agent', region_name=self.region)
        response = bra.start_ingestion_job(
            knowledgeBaseId=knowledge_base_id,
            dataSourceId=data_source_id,
        )
        return {
            'ingestionJobId': response['ingestionJob']['ingestionJobId'],
            'dataSourceId': data_source_id,
            'knowledgeBaseId': knowledge_base_id,
        }

    def check_ingestion_job_status(self, job_info):
        bra = self.session.client('bedrock-agent', region_name=self.region)
        while True:
            try:
                response = bra.get_ingestion_job(
                    knowledgeBaseId=job_info['knowledgeBaseId'],
                    dataSourceId=job_info['dataSourceId'],
                    ingestionJobId=job_info['ingestionJobId'],
                )
                status = response['ingestionJob']['status']

                if status in ['FAILED', 'COMPLETE']:
                    print(f"Ingestion Job {job_info['ingestionJobId']} is {status}")
                    return status

                time.sleep(5)

            except Exception as e:
                print(f"Error checking job status: {e}")
                return 'ERROR'

    def process_ingestion_jobs(self, ids):
        ingestion_jobs = []
        for id_info in ids:
            # knowledgeBaseId が存在しない場合はスキップ
            if 'knowledgeBaseId' not in id_info:
                print(
                    f"Skipping ingestion job as knowledgeBaseId is not present in: {id_info}"
                )
                continue

            for data_source_id in id_info.get('DataSourceId', []):
                job = self.start_ingestion_job(
                    id_info['knowledgeBaseId'], data_source_id
                )
                ingestion_jobs.append(job)

        # ingestion_jobs が空の場合は早期リターン
        if not ingestion_jobs:
            print("No ingestion jobs to process")
            return []

        for job in ingestion_jobs:
            self.check_ingestion_job_status(job)

        return ingestion_jobs

    def save_agent_ids(self, ids):
        documents = [
            {
                'agentName': id_info['agentName'],
                'agentId': id_info['agentId'],
                'agentAliasId': id_info['agentAliasId'],
            }
            for id_info in ids
        ]
        with open('agent_ids.json', 'wt', encoding='utf-8') as f:
            f.write(json.dumps(documents, indent=2))

        # GenU 向け
        documents = [
            {
                'displayName': id_info['agentName'],
                'agentId': id_info['agentId'],
                'aliasId': id_info['agentAliasId'],
            }
            for id_info in ids
        ]
        with open('genu.json', 'wt', encoding='utf-8') as f:
            f.write(json.dumps(documents, indent=2))

    def main(self):
        args = self.parse_args()
        self.region = args.region

        outputs = self.get_cloudformation_outputs(args.stack_name)

        ids = []
        for output in outputs:
            data = output['OutputValue']
            if 'agentId' in data:
                ids.append(json.loads(data))

        self.process_ingestion_jobs(ids)

        self.save_agent_ids(ids)


def main():
    AwsOperations().main()


if __name__ == '__main__':
    main()
