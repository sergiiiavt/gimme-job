# Connect revisions to delivery

## Git state, CI state and production state

A commit records source. CI executes configured checks. Deployment publishes an artifact and configuration to an environment. These are separate events with separate evidence. A merged commit is not proof that production updated, and successful deployment is not proof that every product scenario works.

Trace a release from source revision to built artifact, target environment and observed behavior. Preserve the relationship even when the hosting platform creates a synthetic merge revision for a PR or a queue.

## Checks must identify what they tested

Prefer reproducible commands that developers can run locally and CI can run on a clean checkout. Install declared dependencies, run the relevant lint/type/content/test/build checks, and retain diagnostic artifacts when useful. Secrets for deployment should not be available to arbitrary untrusted contributions.

A workflow triggered for a PR may test the head commit or a generated merge result depending on its configuration. Inspect checkout behavior and revision rather than assuming. Test results from an earlier head or different integration base may no longer support the current proposal.

## Enforce policy at the receiving boundary

Protected branches or repository rules can require reviews, successful checks, linear history or restricted updates. Their exact behavior depends on host settings and permissions. Local hooks provide fast feedback, but are local code, can be absent and can often be bypassed; they do not enforce server authorization.

Use unique, meaningful required-check names and understand skipped, pending and successful states. A workflow file that never runs for a changed path can leave a required check waiting. Fix the configuration contract rather than bypass the release gate silently.

## Tags identify release points

On a clean repository at the intended tested commit, this local example creates an annotated training tag:

```sh
git rev-parse HEAD
git tag -a v0.1.0-lab -m "Local collaboration lab release"
git show --no-patch v0.1.0-lab
```

Use an unused tag name. A lightweight tag is a direct ref; an annotated tag has an object with a message and metadata and can be signed. Creating a local tag does not publish it. If authorized, push the specific intended tag rather than every unrelated local tag.

Agree that published release tags are immutable. Git can technically move a ref, but moving a tag after consumers fetched it breaks the assumption that a release name identifies one artifact. A hosting release page and a Git tag are related but distinct objects.

## Signing and provenance

Signing a commit or tag can establish that a key signed that object according to the trust policy. It does not prove that the signer reviewed the code, that dependencies are safe or that the deployed artifact was built from it. Artifact provenance and verified build inputs address another part of that chain.

## Hotfixes and backports

Identify the deployed version and supported maintenance branch before applying a fix. Cherry-pick a reviewed change only after checking its dependencies; test it against the older branch’s actual dependency and schema versions. Then integrate an equivalent fix into any other affected supported line so a future release does not reintroduce the defect.

Keep emergency procedures explicit: who can approve, which checks remain required, how to roll back and how to record follow-up. Urgency does not change which state a Git command modifies.

## Verify after delivery

Confirm that the production workflow ran for the merged revision, its artifact was deployed, health checks pass and the requested behavior is observable. Check cache or asset versions if the UI still looks old. Database migrations, secrets and external integrations can make an otherwise correct source revision behave differently across environments.

## Checkpoint and answer

**Question:** Main is green and a release tag exists. Can you say the fix is deployed?

**Answer:** Not yet. Verify the deployment run and target environment, identify the delivered revision or artifact, and check live behavior. Git references and CI results describe only part of the delivery chain.
