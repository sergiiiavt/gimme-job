# Infrastructure as Code: from repeatability to controlled change

## What you should understand after this chapter

Infrastructure as Code is not primarily about a specific tool. It is the practice of describing infrastructure changes in version-controlled, reviewable code so that the same intent can be executed repeatedly and verified.

By the end of this chapter you should be able to explain the difference between manual infrastructure, infrastructure automation, and declarative IaC; identify the inputs that must stay outside source control; design an idempotent provisioning flow; and decide what evidence proves that a provisioning run actually succeeded.

## The mental model

A useful infrastructure workflow has four separate concerns: **intent**, **execution**, **state**, and **verification**.

```diagram
ENGINEERING INTENT
      |
      v
Version-controlled infrastructure code
      |
      +---- inputs / configuration
      |           |
      |           +---- non-secret values
      |           +---- secrets from protected storage
      v
Provisioning execution
      |
      +---- create missing resources
      +---- reuse resources that already match
      +---- update resources that intentionally changed
      v
Real infrastructure
      |
      v
Verification: network, service health, DNS, TLS, application readiness
```

The important property is not that every execution creates something. A good provisioning run can also conclude that the required resource already exists and should be reused.

## Manual infrastructure, automation, and declarative IaC

Manual infrastructure means an operator clicks through a cloud console and remembers the configuration. It can work, but the actual system is difficult to reproduce and the review history is weak.

Infrastructure automation replaces manual clicks with executable code. The code can call cloud APIs, create servers, configure firewalls, update DNS, and bootstrap software. If that code is version controlled and designed to be safely re-run, it already provides many of the practical benefits people expect from IaC.

Declarative tools such as Terraform or OpenTofu add another model: you declare the desired resources and the tool compares that declaration with recorded and observed state before planning changes.

> GimmeJob currently uses **idempotent provisioning code through provider APIs**, not Terraform. That distinction matters. The learning goal is to understand the IaC engineering principles first and then recognize how different tools implement them.

## Idempotency: the property that makes re-runs safe

An idempotent provisioning operation tries to converge on the required result instead of blindly creating another copy every time.

A typical pattern is:

```text
look up resource by stable identity
if it exists:
    verify or update it
else:
    create it
```

For a server this may mean searching by a stable server name. For a firewall it may mean reusing a named firewall. For DNS it may mean updating an existing record rather than creating duplicate records.

Without this property, automation becomes dangerous because retrying after a partial failure can create duplicate infrastructure.

## Inputs, configuration, and secrets

Infrastructure code should make the boundary between code and runtime inputs obvious.

| Input type | Example | Where it belongs |
| --- | --- | --- |
| Stable architecture choice | server type, hostname pattern, required ports | version-controlled code |
| Environment configuration | production domain, region preference | code or environment configuration |
| Authentication credential | cloud API token | GitHub Actions secret or another secret store |
| Generated runtime secret | database password, application encryption key | generated on the target system or secure secret store |
| Public material | SSH public key | source control can be acceptable |
| Private key | SSH private key | never in the repository |

A repository should contain enough information to reproduce the infrastructure **without containing the credentials required to take control of it**.

## Provisioning is only half of the system

A cloud API returning `201 Created` does not prove that the application is usable.

Infrastructure verification should follow the actual dependency chain. For a public web service this can include:

1. The compute resource exists and has a network address.
2. The intended firewall is attached.
3. Bootstrap completed successfully.
4. Required containers or services are healthy.
5. DNS resolves to the expected endpoint.
6. TLS is valid.
7. An HTTPS request reaches the application.

This turns a provisioning script into a delivery system rather than a resource-creation script.

## Drift and source of truth

Drift is the difference between the infrastructure that your code expects and the infrastructure that actually exists.

Declarative IaC tools usually provide explicit plan/state mechanisms for detecting drift. API-driven scripts need to implement this deliberately by reading remote state before deciding what to do.

The more infrastructure behavior lives only in a provider console, the harder drift becomes to understand. A useful rule is: if a setting materially affects availability, security, reproducibility, or cost, ask whether it should be represented in version-controlled infrastructure code.

## Failure handling and partial success

Provisioning frequently crosses several external systems. One step can succeed while the next fails.

```diagram
Create firewall       SUCCESS
      |
Create server         SUCCESS
      |
Attach firewall       SUCCESS
      |
Configure DNS         FAILURE
      |
Result: infrastructure exists but service is not yet reachable by hostname
```

A robust design therefore needs stable resource identities, safe re-runs, bounded retries, clear errors, and verification that distinguishes resource creation from end-to-end readiness.

## A practical review checklist

When reviewing infrastructure code, ask:

- Can I understand what resources will exist after a successful run?
- Can I run it again without creating duplicates?
- Are credentials injected rather than committed?
- Does the code use stable resource identities?
- Is network exposure explicit?
- Is bootstrap reproducible?
- Can a failed middle step be retried safely?
- Is there an end-to-end readiness check?
- Can I identify which parts are still manual?

These questions are more transferable than memorizing a particular provider syntax.

## Connection to the next chapter

The next chapter applies this model to the actual GimmeJob production automation. It follows the GitHub Actions trigger, Hetzner API provisioning, cloud-init bootstrap, Docker Compose runtime, Cloudflare DNS, Caddy HTTPS, and n8n readiness check as one reproducible system.

## Summary

Infrastructure as Code is a controlled-change model: infrastructure behavior is represented in reviewable code, sensitive inputs are separated, operations are safe to repeat, and the real result is verified. Declarative tools are one implementation of that model, but the same principles also apply to carefully designed provider-API automation.

## Sources

- [GimmeJob Hetzner provisioning implementation](https://github.com/sergiiiavt/gimme-job/blob/main/ops/hetzner/provision.mjs)
- [GimmeJob Hetzner GitHub Actions workflow](https://github.com/sergiiiavt/gimme-job/blob/main/.github/workflows/hetzner-n8n.yml)
- [Hetzner Cloud API documentation](https://docs.hetzner.cloud/)
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions)
