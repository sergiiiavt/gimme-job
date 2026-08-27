export interface IstqbAiTestingSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: string;
  role: string;
}

export const istqbAiTestingSources: IstqbAiTestingSource[] = [
  {
    id: "istqb-ctai-page",
    title: "Certified Tester AI Testing (CT-AI) Version 2.0",
    url: "https://istqb.org/certifications/certified-tester-ai-testing-ct-ai/",
    publisher: "ISTQB",
    kind: "official-certification-page",
    role: "Primary authority for the current certification scope, prerequisite, exam format, retirement of v1.0, business outcomes, and official downloads.",
  },
  {
    id: "istqb-ctai-syllabus-v2",
    title: "Certified Tester AI Testing Syllabus v2.0",
    url: "https://istqb.org/wp-content/uploads/2026/05/ISTQB-_CTAI_Syllabus_v2.0_Release.pdf",
    publisher: "ISTQB",
    kind: "official-syllabus",
    role: "Primary exam authority. Learning objectives, terminology, chapter scope, recommended training time, and hands-on objectives in this guide are mapped to this syllabus.",
  },
  {
    id: "istqb-ctai-sample-questions-v22",
    title: "CT-AI v2.0 Sample Exam Questions v2.2",
    url: "https://istqb.org/?download_id=9561&sdm_process_download=1",
    publisher: "ISTQB",
    kind: "official-sample-exam",
    role: "Official reference for question style and difficulty. Use after completing the learning chapters; do not memorize the questions.",
  },
  {
    id: "istqb-ctai-sample-answers-v22",
    title: "CT-AI v2.0 Sample Exam Answers v2.2",
    url: "https://istqb.org/?download_id=9564&sdm_process_download=1",
    publisher: "ISTQB",
    kind: "official-sample-exam-answers",
    role: "Official explanations for the v2.2 sample exam. Review reasoning, not only the correct option.",
  },
  {
    id: "istqb-ctai-faq",
    title: "CT-AI Version 2.0 FAQ",
    url: "https://istqb.org/help/ct-ai-v2/",
    publisher: "ISTQB",
    kind: "official-faq",
    role: "Current clarification of v2.0 changes, prerequisite, exam format, and the distinction between CT-AI and CT-GenAI.",
  },
  {
    id: "istqb-glossary",
    title: "ISTQB Glossary",
    url: "https://glossary.istqb.org/",
    publisher: "ISTQB",
    kind: "official-glossary",
    role: "Normative terminology companion. When everyday usage conflicts with ISTQB wording, learn the exam terminology used by the syllabus and glossary.",
  },
  {
    id: "iso-25059",
    title: "ISO/IEC 25059:2023 — Quality model for AI systems",
    url: "https://www.iso.org/standard/80655.html",
    publisher: "ISO",
    kind: "standard",
    role: "AI-system quality model referenced by the CT-AI syllabus. Use it to understand the source of AI-specific quality characteristics; exam wording follows the syllabus.",
  },
  {
    id: "nist-ai-rmf",
    title: "Artificial Intelligence Risk Management Framework",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
    publisher: "NIST",
    kind: "risk-framework",
    role: "Practical companion for connecting AI quality, risk, governance, monitoring, and lifecycle controls to real systems.",
  },
  {
    id: "nist-genai-profile",
    title: "AI RMF: Generative Artificial Intelligence Profile",
    url: "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence",
    publisher: "NIST",
    kind: "genai-risk-guidance",
    role: "Additional risk vocabulary and mitigations for generative AI systems. Useful for GenAI/LLM test design and red-team exercises.",
  },
  {
    id: "google-ml-crash-course",
    title: "Machine Learning Crash Course",
    url: "https://developers.google.com/machine-learning/crash-course",
    publisher: "Google for Developers",
    kind: "technical-learning",
    role: "Optional technical reinforcement for ML fundamentals, classification, neural networks, data, and generalization concepts used by CT-AI.",
  },
  {
    id: "sklearn-model-evaluation",
    title: "Model evaluation: quantifying the quality of predictions",
    url: "https://scikit-learn.org/stable/modules/model_evaluation.html",
    publisher: "scikit-learn",
    kind: "technical-reference",
    role: "Technical companion for classification metrics and model-evaluation examples. The exam definitions should still be learned from the ISTQB syllabus.",
  },
  {
    id: "sklearn-confusion-matrix",
    title: "sklearn.metrics.confusion_matrix",
    url: "https://scikit-learn.org/stable/modules/generated/sklearn.metrics.confusion_matrix.html",
    publisher: "scikit-learn",
    kind: "technical-reference",
    role: "Concrete implementation reference for confusion matrices used in the hands-on classification exercise.",
  },
];

export default istqbAiTestingSources;
