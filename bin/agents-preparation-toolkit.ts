#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AgentPreparationToolkitStack } from '../lib/agents-preparation-toolkit-stack';
import { AwsSolutionsChecks, NagSuppressions } from 'cdk-nag'
import { Aspects } from 'aws-cdk-lib';

const app = new cdk.App();

// Aspects.of(app).add(new AwsSolutionsChecks({ verbose: true }))

const env = app.node.tryGetContext('env') || 'Dev-';

// const agentPreparationToolkitStack = new AgentPreparationToolkitStack(app, `${env}AgentPreparationToolkitStack`, {
//   env
// });
new AgentPreparationToolkitStack(app, `${env}AgentPreparationToolkitStack`, {env});