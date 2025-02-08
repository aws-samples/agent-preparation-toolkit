export interface Prompt {
  preProcessing: string;
  orchestration: string;
  knowledgeBaseResponseGeneration: string;
  postProcessing: string;
  memorySummarization: string;
}

export interface CustomPrompt extends Partial<Prompt> {
  useCaseId: string;
}
