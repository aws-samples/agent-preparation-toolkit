#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AgentPreparationToolkitStack } from '../lib/agents-preparation-toolkit-stack';

const app = new cdk.App();

const env = app.node.tryGetContext('env') || 'Dev-';

new AgentPreparationToolkitStack(app, `${env}AgentPreparationToolkitStack`, {env});