import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';
import { Construct } from 'constructs';

export interface BucketDeploymentProps {
  sourcePaths: string[];
  destinationKeyPrefix?: string;
}

export class BucketDeployment extends Construct {
  public readonly bucket: s3.Bucket;
  public readonly deployment: s3deploy.BucketDeployment;
  public readonly destinationKeyPrefix: string;

  constructor(scope: Construct, id: string, props: BucketDeploymentProps) {
    super(scope, id);

    const destinationKeyPrefix = props.destinationKeyPrefix || 'data/' 
    
    this.bucket = new s3.Bucket(this, 'Bucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      serverAccessLogsPrefix: 'AccessLogs/',
    });

    this.deployment = new s3deploy.BucketDeployment(this, 'BucketDeployment', {
      sources: props.sourcePaths.map(sourcePath => s3deploy.Source.asset(path.dirname(sourcePath))),
      destinationBucket: this.bucket,
      destinationKeyPrefix: destinationKeyPrefix
    });
    this.destinationKeyPrefix = destinationKeyPrefix;
  }
}