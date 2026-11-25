# Deploying and integrating GenAI in test organisations

Chapter 5 is the test manager's view: strategy, model choice, adoption phases and changing roles.

## Shadow AI

**Shadow AI** is the use of GenAI tools without formal approval or oversight. Its risks: security and privacy weaknesses in personal tools, compliance and regulatory violations with possible legal consequences, and unclear intellectual property and licensing.

## Key aspects of a GenAI test strategy

- Measurable objectives, such as productivity, shorter cycles and better quality.
- LLM selection aligned with objectives, infrastructure and scalability.
- Data quality and security.
- Training covering technical and ethical skills.
- Metrics for the effectiveness of GenAI results.
- Process guidelines: rules for sensitive data, transparency about GenAI use, and quality gates for reviewing testware.

## Selecting an LLM or SLM

- **Model performance** against the organisation's own benchmarks.
- **Fine-tuning potential** for the domain.
- **Recurring cost:** licences and operating expenses, estimated from token counts, prompts and task frequency.
- **Community and support:** an active community and good documentation.

## Adoption phases

1. **Discovery:** build awareness and capability through training, access and first experiments.
2. **Initiation and usage definition:** prioritise use cases and evaluate LLM-powered test infrastructure.
3. **Utilisation and iteration:** integrate GenAI fully, with continuous monitoring and measurement.

Phases can run in parallel for different use cases.

## Skills and capability building

- **Core skills:** prompt engineering, understanding context windows, reviewing test output.
- **Competencies:** assessing LLM capabilities, refining prompts, evaluating AI-generated testware.
- **Knowledge:** GenAI risks and mitigations, data sanitisation, privacy-preserving prompting, environmental impact.

Build capability through hands-on practice, structured learning paths, peer learning and gradual integration into daily work. A **prompt pattern** is a reusable template for consistent output; **communities of practice** share prompt libraries and lessons learned.

## How roles change

- **Testers** move from test design and execution specialists to AI-assisted test specialists who review AI output, refine prompts and maintain prompt libraries.
- **Test managers** develop AI-based test strategies, manage AI risks, set governance, and lead hybrid teams of people and GenAI agents.

## A bounded pilot decision

Pilot 20 synthetic tickets with pre-agreed checks: all critical expected conditions covered, no invented facts, no private-data leakage and measured total review time. Split normal, ambiguous and adversarial cases. Compare with the current human workflow; include setup and correction effort. If drafting is faster but review takes longer, do not call it a productivity gain. Expand only after the agreed evidence, owner and rollback conditions are met; training and role changes depend on the organization.
