export interface ModelOption {
  id: string;
  label: string;
}

export const OPENROUTER_MODELS: ModelOption[] = [
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "openai/gpt-5.4-nano", label: "GPT-5.4 Nano" },
  { id: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini" },
];

export const OPENAI_MODELS: ModelOption[] = [
  { id: "gpt-5.4-nano", label: "GPT-5.4 Nano" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  { id: "gpt-5.4", label: "GPT-5.4" },
  { id: "o4-mini", label: "o4-mini" },
];

export const DEFAULT_OPENROUTER_MODEL = "google/gemini-2.5-flash";
export const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";

export const defaultModelForProvider = (provider: string): string => {
  switch (provider) {
    case "openai":
      return DEFAULT_OPENAI_MODEL;
    default:
      return DEFAULT_OPENROUTER_MODEL;
  }
};

export const modelsForProvider = (provider: string): ModelOption[] => {
  switch (provider) {
    case "openai":
      return OPENAI_MODELS;
    default:
      return OPENROUTER_MODELS;
  }
};
