# Introduction to generative AI for software testing

Chapter 1 gives the vocabulary for the rest of the syllabus: types of AI, how LLMs work, and where they help in testing.

## The AI spectrum

- **Symbolic AI:** rule-based; represents knowledge with symbols and logic.
- **Classical machine learning:** data-driven; needs data preparation, feature selection and training.
- **Deep learning:** neural networks learn features automatically, though people are still often involved.
- **Generative AI:** deep learning used to create new content such as text, images and code.

The key practical advantage of GenAI: pre-trained models can be used without an extra training phase, with the risks covered in chapter 3.

## How LLMs work

- **LLM:** a GenAI model pre-trained on large text datasets, based on the transformer architecture. An **SLM** is a compact model with fewer parameters.
- **Tokenization:** splitting text into tokens: characters, sub-words or words. Cost and limits are counted in tokens.
- **Embedding:** a numerical vector representing a token's meaning and context.
- **Context window:** how much text, in tokens, the model can consider at once. Larger windows raise computational cost.
- **Inference** predicts the next token. Plausible output is not necessarily correct output.
- **Non-determinism** comes from probabilistic inference and hyperparameters such as temperature.

## Foundation, instruction-tuned and reasoning LLMs

| Type | What it is |
| --- | --- |
| Foundation LLM | General-purpose, broadly pre-trained, usually needs adaptation |
| Instruction-tuned LLM | Fine-tuned on prompt and response pairs to follow instructions (non-reasoning) |
| Reasoning LLM | Adds structured reasoning: logical inference, multi-step problem solving, chain-of-thought |

## Multimodal models

A **multimodal LLM** processes text, images, sound and video. A **vision-language model (VLM)** is a subset that combines visual and textual information, useful for checking a screenshot against a requirement or generating acceptance criteria from a wireframe.

## Where LLMs help in testing

Requirements analysis, test case creation, test oracle generation, test data generation, test automation support, test result analysis and testware creation.

## AI chatbots vs LLM-powered testing applications

An **AI chatbot** is conversational and interactive: good for routine tasks, exploration and onboarding. An **LLM-powered testing application** integrates an LLM through APIs into tools for defined or automated tasks; it is more customisable and scalable. Both depend on good prompt engineering.
