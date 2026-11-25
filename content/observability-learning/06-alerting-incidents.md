# Alerting and incident response

An alert interrupts a person. A good one interrupts the right person, at the right time, about something that matters and that they can act on; a bad one trains people to ignore alerts until a real outage slips through. When an alert does reveal a real problem, the response is a process too: who leads, who changes the system, who talks to users, and how the team learns from it afterwards.

This chapter covers what makes a good alert, page versus ticket, runbooks, incident response roles and practices, what QA does during and after an incident, blameless postmortems, testing alerts, and a postmortem of a real incident on this site. Burn-rate alerts on SLOs are covered in [SLIs, SLOs and error budgets](/learn/observability?topic=slo-error-budgets).

**Prerequisites:** [Metrics, golden signals and percentiles](/learn/observability?topic=metrics), [SLIs, SLOs and error budgets](/learn/observability?topic=slo-error-budgets).

## What makes a good alert

Google's SRE book sets a high bar for anything that pages a person:

- **Urgent.** It needs attention now, not tomorrow.
- **Actionable.** There is something the responder can do.
- **Requires intelligence.** If the response is always the same mechanical steps, automate them instead of paging.
- **About a symptom users feel, or will feel soon.** Slow or failing requests, not high CPU on one machine.
- **New.** A page for a problem that is already known and being handled is noise.

A practical test for every rule: could I ignore this page? Does it definitely mean users are affected? Is there another page that already covers the same problem?

## Page, ticket or dashboard

Not every signal deserves a page. The SRE book separates three destinations:

| Destination | For | Example |
|---|---|---|
| Page | Urgent, user-visible problems that need a human now | Fast error-budget burn on checkout |
| Ticket | Real problems that can wait for working hours | Slow budget burn over days; disk at 80% and rising |
| Dashboard or log | Information for investigation, no action required | CPU of a single instance, a restarted container that recovered |

Two techniques reduce noise. Require the condition to hold for at least two evaluation cycles before an alert fires, so one bad sample does not wake anyone. And alert on burn rate with long and short windows, which react to sustained problems and stop soon after recovery.

## Runbooks

Every alert should link to a runbook: what the alert means, how to confirm it, the first safe steps, how to escalate and how to tell when it is over. A runbook is also a test artefact: if following it in a test environment does not work, the runbook is wrong, and it is better to find out before an incident.

## Incident response

When a problem is serious, declare an incident early. The SRE book's criteria are practical: a second team is needed, the problem is visible to customers, or it is still unsolved after an hour of focused work. Declaring an incident is cheap; coordinating too late is expensive.

| Role | Responsibility |
|---|---|
| Incident commander | Holds the overall picture, assigns work, decides; holds every role not delegated |
| Operations | The only people changing the system during the incident |
| Communications | Regular updates to stakeholders and users |
| Planning | Longer-term work: bugs, handoffs, tracking temporary changes so they can be reverted |

Three practices matter most: a living incident document with the current state and timeline; one agreed place where responders coordinate; and priorities in a fixed order: stop the bleeding, restore service, preserve evidence for the postmortem.

## QA during and after an incident

QA engineers are often the people who know the product's behaviour best, which is valuable during an incident, as long as the work goes through the incident commander:

- **Reproduce** the problem in a safe environment and narrow down which inputs, users or versions are affected.
- **Assess the blast radius:** which journeys, data and customers are affected, and since when.
- **Verify the mitigation:** test the rollback or the fix before and after it goes out.
- **Watch the recovery:** error rates, latency and the original symptom, not just the alert going quiet.
- **Do not change the system on your own.** During an incident only the operations role modifies production; a well-meant test that writes data can make things worse.

After the incident, QA's main contribution is answering two questions: which test would have caught this before release, and which signal would have detected it sooner?

## Blameless postmortems

A postmortem is a written record of an incident: its impact, the actions taken to mitigate it, its causes and the follow-up actions that prevent it from happening again. Blameless means it looks for contributing causes in systems and processes, assuming everyone acted with good intentions and the information they had.

The SRE book lists typical triggers: user-visible downtime or degradation beyond a threshold, any data loss, on-call intervention such as a rollback, resolution taking longer than a threshold, and a monitoring failure, which usually means the incident was found by a person rather than an alert. Agree on the triggers before you need them.

A useful postmortem has a summary, the impact, a timeline, root and contributing causes, what went well and what did not, and action items with owners and priorities. The most valuable metric in the timeline is often **time to detect**: how long the problem existed before anyone knew.

## Testing alerts

Alerts are code and fail like code: wrong thresholds, wrong labels, a query that never matches. Test them by triggering the condition in a test environment and checking that the alert fires, reaches the right destination and clears. The simulation below compares an alert that fires on the first bad sample with one that requires two consecutive bad samples, on a noisy error-rate series with one real problem:

```python
THRESHOLD = 0.05

error_rate = [0.01, 0.07, 0.01, 0.02, 0.06, 0.01, 0.02, 0.09, 0.12, 0.15, 0.11, 0.03, 0.01, 0.08, 0.01]
real_problem = range(7, 11)

def evaluate(series, threshold, cycles):
    pages = []
    streak = 0
    firing = False
    for minute, value in enumerate(series):
        streak = streak + 1 if value > threshold else 0
        if streak >= cycles and not firing:
            pages.append(minute)
            firing = True
        if streak == 0:
            firing = False
    return pages

for cycles in [1, 2]:
    pages = evaluate(error_rate, THRESHOLD, cycles)
    false_pages = [minute for minute in pages if minute not in real_problem]
    detected = [minute for minute in pages if minute in real_problem]
    delay = detected[0] - real_problem.start if detected else None
    print(f"fire after {cycles} bad sample(s): pages at {pages}, false pages {len(false_pages)}, detection delay {delay} min")
```

Requiring two bad samples removes the three false pages at the cost of one minute of detection delay. That trade-off, noise against speed, is the core of every alert design, and it should be decided deliberately rather than by default settings.

## Case study: a postmortem of the disk-full incident

The disk-full incident on this site's server, introduced in [Observability for QA engineers](/learn/observability?topic=observability-for-qa&section=case-study-the-disk-that-filled-up), written up as a short blameless postmortem:

| Section | Content |
|---|---|
| Summary | The server's disk reached 100%. Deployments of the AI service failed, the database playground's MongoDB was down, and several containers reported failing health checks. |
| Impact | MongoDB in the database playground unavailable for about eight days; matching AI deployment upload failures observed on 14, 19 and 21 November, while the previous version kept serving. |
| Detection | Found by a person after an unrelated deployment failed, not by an alert: a monitoring failure. |
| Timeline | June: untagged images start accumulating with every deployment. 13 November: the MongoDB container crashes. 14 November: the earliest matching upload failure in the reviewed workflow history; matching failures recur on 19 and 21 November. 21 November: read-only diagnosis finds the disk at 100%; untagged images and build cache removed, the container restarted, every container healthy again. |
| Root cause | Each deployment pulled a new image and nothing removed the previous one. |
| Contributing causes | No alert on disk saturation; no external check of the playground; the deployment failure message did not mention disk space; a script bug meant the cleanup step after deployment never ran. |
| What went well | Diagnosis started read-only; cleanup removed only unused images; the fix was verified by the next deployment. |
| Action items | Done: remove replaced images on every deployment and fail early with a clear message when free space is low; fix the script so post-deployment steps run. Open: a disk-usage alert, an external check of the playground, log rotation for containers. |

The QA questions have clear answers here. A black-box test of the playground running every few minutes would have detected the outage on the first day, and a saturation alert could have warned earlier, depending on its threshold and the disk-growth trend. Without retained metrics, an exact warning date cannot be established.

Evidence: [14 November workflow](https://github.com/sergiiiavt/gimme-job/actions/runs/43585173844). Matching symptoms do not establish one uninterrupted outage or an identical cause. Alert timing is a counterfactual, not an observed measurement.

## Common mistakes

- **Paging on causes.** High CPU or one failed instance wakes people for problems users never notice.
- **Alerts without runbooks.** The responder starts from zero at 3 a.m.
- **Alerts that fire on one sample.** Noise teaches people to ignore pages.
- **Declaring incidents too late.** Coordination problems grow faster than technical ones.
- **Everyone changing production at once.** Only the operations role should modify the system.
- **Postmortems that name people.** Blame hides the system problems that will cause the next incident.
- **Action items without owners.** The same incident will happen again.

## Summary

Page only for urgent, actionable, user-visible problems that need human judgement; send the rest to tickets or dashboards, and require conditions to persist before alerts fire. Link every alert to a tested runbook. Declare incidents early, separate the roles of command, operations, communication and planning, and prioritise stopping the damage, restoring service and preserving evidence. QA helps by reproducing, scoping and verifying, never by changing production alone, and after the incident by naming the missing test and the missing signal. Write blameless postmortems with owned action items, and test alerts like any other code.
