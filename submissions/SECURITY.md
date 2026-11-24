# How we run submitted code

Submissions contain code that we run: a harness runs the `.py` file of a variant, an eval runs its Inspect task, and a weights file can hold code too. These are our rules for that code. They protect our systems, and they make each run the same as the run that you did.

## Before we run it

- **The code is in the pull request.** We run only the code of the submission's folder (a variant's `code/`, a harness or an Inspect task) with our own scripts, not code from another place. Code that downloads more code and runs it is not permitted.
- **Each pin is a fixed version.** Commits are 40-character SHAs, packages are in a lock with hashes, and each data or weights file has a sha256. No branches, tags or "latest". `check.mjs`, `check-eval.mjs` and `check-harness.mjs` check this.
- **New packages get more review.** Tell us why the harness needs each new package. We can ask you to remove one.
- **Other repos are pinned at a commit.** The commit hash stops the code from changing. We may fork a repo into our organization, so that our runs still work if the repo is deleted.
- **Files cannot run code when we load them.** Use safetensors, or a `.pt` file of tensors only: we load `.pt` files with `torch.load(..., weights_only=True)`. Pickle files (`.pkl`, `.joblib`) are not permitted. Use `trust_remote_code` only for a dataset at a pinned revision, and tell why.

## Where we run it

- **On new machines for each submission.** We make new GPU pods (a large model needs a larger pod), run the submission, and then delete the pods. A pod has no access to our database, our storage, or our deploy and payment keys, and no secrets in its own environment: code can read it. RunPod adds `RUNPOD_API_KEY` to each pod; that key can act only on its own pod.
- **With an empty environment.** We start each command with [`run-isolated.sh`](run-isolated.sh). It gives the command only the variables that we name. It stops if the machine has a secret file, and it warns about key names in the pod's environment.
- **With keys that can do little.** The pod gets a read-only Hugging Face token, and, if the eval uses a judge model, an API key with a low spend limit. We make the keys for that run, and we delete them after it.
- **We read the output as data.** We copy only `results.json` and the outputs of each item, and our own scripts import them. We do not run code from the output.

## What we ask of you

- Connect only to the services that the eval needs: Hugging Face for the pinned files, the package index for the locked packages, and the API of the judge model. We read the code for other connections.
- Read keys from the environment. Do not print them, and do not write them to a file. Do not read files with keys or passwords (for example `~/.aws` or `~/.ssh`): the checks refuse code that does.
- Do not hide what the code does (for example, encoded or minified code).
- You do not need `run-isolated.sh` on your own machine. It is for our pods, and it stops on a machine with secret files.

## Report a security problem

If you find a security problem in our harnesses, our checks or the site, write to support@openaudit.com with "Security" in the subject. Do not open a public issue or pull request for it.
