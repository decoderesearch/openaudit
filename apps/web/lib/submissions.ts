/** How to submit a method variant: the methods with a harness in the repo's `evals/` folder. */

import { NEXT_PUBLIC_URL } from '@/lib/env';

/** The style of the page buttons that submit to us (not the navbar's Submit). */
export const SUBMIT_BUTTON =
  'inline-flex w-fit shrink-0 items-center gap-x-1 rounded-full border border-sky-700 bg-sky-700 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap text-white uppercase transition-colors hover:border-sky-800 hover:bg-sky-800 [&_svg]:size-3.5 [&_svg]:shrink-0';

export const REPO_URL = 'https://github.com/decoderesearch/openaudit';

export type Harness = {
  /** The harness folder in the repo. */
  path: string;
  /** The evals that it runs. */
  evals: string[];
  /** What a submitter gives, for example "lens". In lowercase, it is `artifact` in `rules.json`. */
  artifact: string;
  /** The artifact forms that it takes. */
  formats: string[];
  smoke: { model: string; time: string };
  /** Our leaderboard models. The same list is in the harness's `submission/rules.json`. */
  models: string[];
  /** True: an artifact on a model that is not in `models` is also good. */
  anyModel: boolean;
  /** The data that the evals need for each model, and how the harness gets it. */
  modelData: string;
  /** The models that rank the variants. The same list is `coreModels` in `rules.json`. */
  coreModels?: string[];
  /** For a harness that fits a recipe on each model: what the recipe is. */
  recipe?: string;
};

const VARIED_DECEPTION: Harness = {
  path: 'evals/varied-deception',
  evals: ['varied-deception'],
  artifact: 'detector',
  formats: [
    'A recipe: a .py file with TRAIN_DATA (the training data, at fixed commits) and fit_detector(model_name, data, acts). The harness fits the detector on the model, then runs the evaluation.',
    'An activation detector: a .py file with load_detector(model_name). Its object has layers, a threshold and score(acts, chat).',
    'A chat detector: a .py file with load_detector(model_name). Its object has a threshold and score_chats(chats). It can call an API or load the model.',
  ],
  recipe:
    'A probe is specific to one model, so a variant is a recipe: the steps that fit the probe on any model. We use your recipe to fit the probe on each core model, and we rank only a variant with a recipe. Detector files that you fit yourself are optional.',
  coreModels: [
    'Qwen/Qwen3.5-4B',
    'google/gemma-4-E4B-it',
    'google/gemma-2-9b-it',
    'Qwen/Qwen3-14B',
    'zai-org/GLM-4.7-Flash',
    'Qwen/Qwen3.6-27B',
    'google/gemma-4-31B-it',
    'meta-llama/Llama-3.3-70B-Instruct',
    'MiniMaxAI/MiniMax-M2.7',
  ],
  smoke: { model: 'Qwen/Qwen3-4B', time: 'a few minutes on one GPU, with --limit 100' },
  models: [
    'MiniMaxAI/MiniMax-M2',
    'MiniMaxAI/MiniMax-M2.7',
    'Qwen/Qwen3-14B',
    'Qwen/Qwen3-30B-A3B',
    'Qwen/Qwen3-32B',
    'Qwen/Qwen3-4B',
    'Qwen/Qwen3-8B',
    'Qwen/Qwen3.5-122B-A10B-FP8',
    'Qwen/Qwen3.5-27B',
    'Qwen/Qwen3.5-35B-A3B-FP8',
    'Qwen/Qwen3.5-4B',
    'Qwen/Qwen3.6-27B',
    'Qwen/Qwen3.6-35B-A3B',
    'XiaomiMiMo/MiMo-V2-Flash',
    'deepseek-ai/DeepSeek-V3.2',
    'google/gemma-2-9b-it',
    'google/gemma-3-12b-it',
    'google/gemma-3-27b-it',
    'google/gemma-4-26B-A4B-it',
    'google/gemma-4-31B-it',
    'google/gemma-4-E2B-it',
    'google/gemma-4-E4B-it',
    'meta-llama/Llama-3.3-70B-Instruct',
    'moonshotai/Kimi-K2.5',
    'moonshotai/Kimi-K2.6',
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'zai-org/GLM-4.5-Air-FP8',
    'zai-org/GLM-4.7-FP8',
    'zai-org/GLM-4.7-Flash',
    'zai-org/GLM-5-FP8',
    'zai-org/GLM-5.1-FP8',
  ],
  anyModel: false,
  modelData: "The evaluation data is the models' own transcripts with their labels, so it is only for these models.",
};

/** The harnesses of each method. The first is the main one. */
export const HARNESSES: Record<string, Harness[]> = {
  'workspace-lenses': [
    {
      path: 'evals/workspace-lenses',
      evals: ['workspace-lens-readout', 'workspace-probe-swap'],
      artifact: 'lens',
      formats: [
        'A linear lens: a .pt file with a d_model × d_model map J for one or more readout layers. Both evals run.',
        'Any other lens: a .py file with load_lens(model, layers, hf_model_name). Its object maps a residual to the last layer. Only the readout eval runs.',
      ],
      smoke: { model: 'Qwen/Qwen3.5-0.8B', time: 'about 3 minutes on one GPU' },
      models: [
        'Qwen/Qwen3.6-27B',
        'google/gemma-4-31B',
        'allenai/Olmo-3-1125-32B',
        'Qwen/Qwen3.5-9B',
        'Qwen/Qwen3.5-122B-A10B',
        'deepseek-ai/DeepSeek-V4-Flash',
      ],
      anyModel: true,
      modelData:
        "The readout eval uses only the items that the model answers correctly. For our models, we have the grades of the model's answers. For another model, the harness grades them first.",
    },
    {
      path: 'evals/workspacebench',
      evals: ['workspacebench'],
      artifact: 'lens',
      formats: [
        'A linear lens: a .pt file with a d_model × d_model map J for each read layer (20 to 60). You choose its readout: norm, W_U · norm(J·h), or cosine, the J-Lens readout.',
        'Any other lens, also a text lens: a .py file with load_reader(model_name). Its object reads a residual and gives the top tokens or text samples.',
      ],
      smoke: { model: 'Qwen/Qwen3.5-0.8B', time: 'a few minutes on one GPU, with a few cents of judge calls' },
      models: ['Qwen/Qwen3.6-27B'],
      anyModel: false,
      modelData:
        'The read plan of each question (its layers and token positions) is for Qwen3.6-27B. A summarizer and a Claude judge score the readouts: about $50 to $160 of API calls for each lens with the Batch API.',
    },
  ],
  probes: [VARIED_DECEPTION],
  'llm-monitors': [VARIED_DECEPTION],
  'logprob-classifiers': [VARIED_DECEPTION],
  'sparse-autoencoders': [
    {
      path: 'evals/sparse-autoencoders',
      evals: [
        'synth-sae-bench-16k',
        'sae-bench-core',
        'sae-bench-sparse-probing',
        'sae-bench-absorption',
        'sae-bench-scr',
        'sae-bench-tpp',
        'sae-bench-ravel',
        'sae-bench-unlearning',
        'sae-bench-autointerp',
      ],
      artifact: 'SAE',
      formats: [
        'SynthSAEBench: a .py file with load_sae(device). It gives a SAELens SAE.',
        'SAEBench: a .py file with load_sae(model, layer, device, dtype). It gives a SAEBench BaseSAE, with decoder rows of norm 1.',
      ],
      smoke: { model: 'the SynthSAEBench-16k model', time: 'less than 1 minute on one GPU, with --samples 10000' },
      models: ['google/gemma-2-2b', 'EleutherAI/pythia-160m-deduped', 'decoderesearch/synth-sae-bench-16k-v1'],
      anyModel: false,
      modelData:
        'The published SAEs to rank against are only for these models: SAEBench at one layer of Gemma 2 2B and Pythia 160M, and SynthSAEBench on its synthetic model.',
    },
  ],
};

export const submitPath = (methodSlug: string) => `/methods/${methodSlug}/submit`;

/** The method whose harness runs the eval `evalSlug`, or undefined. */
export function harnessMethodOf(evalSlug: string): string | undefined {
  return Object.entries(HARNESSES).find(([, hs]) => hs.some((h) => h.evals.includes(evalSlug)))?.[0];
}

/** A prompt to give a coding agent, so that it runs the harness and makes the submission. */
export function agentPrompt(methodSlug: string, h: Harness): string {
  return [
    `Help me submit a new ${h.artifact} to OpenAudit, as a variant of the method "${methodSlug}".`,
    `Follow the rules and checkpoints in ${NEXT_PUBLIC_URL}/contribute/agents.md.`,
    '',
    `1. Clone ${REPO_URL}. Read submissions/README.md, ${h.path}/README.md and ${h.path}/submission/README.md.`,
    h.recipe
      ? `2. Put my ${h.artifact} into a recipe, as in the harness README: TRAIN_DATA and fit_detector. See examples/apollo_recipe.py.`
      : `2. Put my ${h.artifact} into one of the forms in the harness README.`,
    `3. Set up the harness as its README says. Tell me the cost before you spend money or GPU time. Then run the smoke run on ${h.smoke.model} (a test model, not ranked) and fix all errors.`,
    h.coreModels
      ? `4. Run the full eval (all chats, no --limit) with --recipe on one small core model, for example ${h.coreModels[0]}. We fit your recipe on the other core models: ${h.coreModels.slice(1).join(', ')}.`
      : h.anyModel
        ? `4. Run the full tier on each model that I have a ${h.artifact} for. One model is enough, and it can be a model that is not on our leaderboard.`
        : `4. Run the full tier on each model that I have a ${h.artifact} for. One model is enough. It must be one of: ${h.models.join(', ')}.`,
    '5. Do not fit or tune on held-out eval items. Tell me if my method did.',
    h.recipe
      ? `6. If the recipe uses new training data, put it on Hugging Face at a commit (a private repo until I approve). Copy ${h.path}/submission/submission.json to submissions/${methodSlug}/<variant>/, fill it in with the recipe, and copy results.json into it. Put the recipe file and its tests in code/ in that folder. Write README.md with a summary first (see submissions/README.md). Run node submissions/check.mjs and node submissions/rank.mjs on results.json.`
      : `6. Put the weights on Hugging Face at a commit (a private repo until I approve). Copy ${h.path}/submission/submission.json to submissions/${methodSlug}/<variant>/, fill it in with the recipe, and copy results.json into it. Put each .py file and its tests in code/ in that folder. Write README.md with a summary first (see submissions/README.md). Run node submissions/check.mjs and node submissions/rank.mjs on results.json.`,
    '7. Show me the summary and the files before you make anything public or open a pull request. Open it from a fork in my account.',
    '',
    `My ${h.artifact}: <describe it, or give its path or link>`,
  ].join('\n');
}
