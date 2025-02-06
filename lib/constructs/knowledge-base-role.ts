import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';

export interface KnowledgeBaseRoleProps{
  buckets : s3.Bucket[];
}

export class KnowledgeBaseRole extends Construct {
  public readonly arn: string;
  private readonly knowledgeBaseRole: iam.Role;

  constructor(scope: Construct, id: string, props: KnowledgeBaseRoleProps) {
    super(scope, id);

    const knowledgeBaseRole = new iam.Role(this, 'KnowledgeBaseRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    });
    
    for (const bucket of props.buckets){
      bucket.grantRead(knowledgeBaseRole);
    }

    knowledgeBaseRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: ['*'],
        actions: ['bedrock:InvokeModel'],
      })
    );
    this.knowledgeBaseRole = knowledgeBaseRole;
    this.arn = knowledgeBaseRole.roleArn;
  }
  public grantRead(collectionArn: string): void {
    this.knowledgeBaseRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        resources: [collectionArn],
        actions: ['aoss:APIAccessAll'],
      })
    );
  }
}