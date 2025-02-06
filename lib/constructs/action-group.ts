import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import { BucketDeployment } from './bucket-deployment';

type OpenApiPath = `${string}.json` | `${string}.yaml`;

export interface ActionGroupProps {
  openApiSchemaPath: OpenApiPath;
  lambdaFunctionPath: string;
  actionGroupName: string;
  lambdaPolicy?: iam.PolicyStatement;
}

export class ActionGroup extends Construct {
  public readonly actionGroupName : string;
  public readonly actionGroupExecutor : { lambda: string};
  public readonly apiSchemaBucketName: string;
  public readonly apiSchemaObjectKey: string;
  public readonly lambdaFunction: lambda.Function;
  public readonly lambdaRole: iam.Role;
  public readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: ActionGroupProps) {
    super(scope, id);

    this.actionGroupName = props.actionGroupName;

    const bucketDeployment = new BucketDeployment(this, 'Bucket',{
      sourcePaths : [props.openApiSchemaPath],
    });

    this.bucket = bucketDeployment.bucket
    
    this.apiSchemaBucketName = this.bucket.bucketName;
    
    this.apiSchemaObjectKey = path.join(bucketDeployment.destinationKeyPrefix, path.basename(props.openApiSchemaPath));

    this.lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    if (props.lambdaPolicy) {
      this.lambdaRole.addToPolicy(props.lambdaPolicy);
    }


    this.lambdaFunction = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.PYTHON_3_13,
      code: lambda.Code.fromAsset(path.join(props.lambdaFunctionPath)),
      handler: 'index.lambda_handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      role: this.lambdaRole
    });

    new iam.ManagedPolicy(this, 'LambdaPolicy', {
      description: 'Lambda basic execution policy',
      roles: [this.lambdaRole],
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents',
          ],
          resources: [
            `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/lambda/${this.lambdaFunction.functionName}:*`,
            `arn:aws:logs:${cdk.Stack.of(this).region}:${cdk.Stack.of(this).account}:log-group:/aws/lambda/${this.lambdaFunction.functionName}`,
          ],
        }),
      ],
    });
  }
}