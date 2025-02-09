export interface Prompt {
  instruction: string;
  preProcessing: string;
  orchestration: string;
  knowledgeBaseResponseGeneration: string;
  postProcessing: string;
  memorySummarization: string;
}

export interface CustomPrompt extends Partial<Prompt> {
  agentPromptsId: string;
}
