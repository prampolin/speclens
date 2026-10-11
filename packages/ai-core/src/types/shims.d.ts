declare module '@huggingface/transformers' {
  export const env: {
    allowRemoteModels?: boolean;
    allowLocalModels?: boolean;
    localModelPath?: string;
  };
  export function pipeline(
    task: string,
    model: string,
    options?: { revision?: string; local_files_only?: boolean }
  ): Promise<any>;
}

declare module 'onnxruntime-node' {
  export class InferenceSession {
    static create(path: string): Promise<any>;
  }
}
