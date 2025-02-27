#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AgentPreparationToolkitStack } from '../lib/agents-preparation-toolkit-stack';
import { ENVIRONMENT_CONFIG} from '../parameter';

const app = new cdk.App();

const prefix: string = ENVIRONMENT_CONFIG.prefix;

new AgentPreparationToolkitStack(app, `${prefix}AgentPreparationToolkitStack`,{
  env: { region: 'us-west-2' },
});