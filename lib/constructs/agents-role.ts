import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface AgentRoleProps{
  accountId: string;
  region: string;
  agentName: string;
  knowledgeBaseIds?: string[];
  roleName: string;
  lambdaFunctions?: lambda.Function[];
  s3Buckets?: s3.Bucket[];
}

export class AgentRole extends Construct {
  public readonly roleArn: string;
  constructor(scope: Construct, id: string, props: AgentRoleProps) {
    super(scope, id);
    
    const bedrockPolicy = new iam.ManagedPolicy(this, 'bedrockPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['bedrock:InvokeModel'],
          resources: [
            `arn:aws:bedrock:${props.region}::foundation-model/*`
          ]
        }),
        // knowledgeBaseIdsが存在する場合のみ、このポリシーステートメントを追加
        ...(props.knowledgeBaseIds && props.knowledgeBaseIds.length > 0 
          ? [
              new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                  'bedrock:Retrieve',
                  'bedrock:RetrieveAndGenerate'
                ],
                resources: props.knowledgeBaseIds.map(id =>
                  `arn:aws:bedrock:${props.region}:${props.accountId}:knowledge-base/${id}`
                )
              })
            ]
          : []
        )
      ]
    });

    const agentRole = new iam.Role(this, 'AgentRole', {
      roleName: `AmazonBedrockExecutionRoleForAgents_${props.roleName}`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      managedPolicies: [bedrockPolicy],
    });

    if (props.lambdaFunctions && props.lambdaFunctions.length > 0) {
      for (const lambdaFunction of props.lambdaFunctions) {
        lambdaFunction.grantInvoke(agentRole);
      }
    }
    
    if (props.s3Buckets && props.s3Buckets.length > 0) {
      for (const bucket of props.s3Buckets) {
        bucket.grantRead(agentRole);
      }
    }

    this.roleArn = agentRole.roleArn
  }
}