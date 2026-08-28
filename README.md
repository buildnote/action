# Buildnote GitHub Action

This action enables integration between your GitHub workflows and Buildnote.

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Buildnote%20Action-blue.svg?colorA=24292e&colorB=0366d6&style=flat&longCache=true&logo=github)](https://github.com/marketplace/actions/buildnote-action)
[![Release Buildnote Action](https://github.com/buildnote/action/actions/workflows/release.yml/badge.svg)](https://github.com/buildnote/action/actions/workflows/release.yml)

## What does this action do?

The Buildnote GitHub Action provides a wrapper around the [Buildnote CLI](https://docs.buildnote.io/reference/cli/download/), allowing you
to:

- Collect test results in various formats
- Collect files from the file system
- Run guardrails and gate the build on their verdicts
- Monitor a job and record every command it runs
- Track command execution statistics
- Gather build tool performance data
- Record pipeline builds, stages, and steps (but GitHub App integration is preferred method)

This information is then sent to your Buildnote dashboard, providing insights into your CI/CD pipeline performance.

## Usage

### Example

```yaml
name: Example workflow using Buildnote
on:
  push:
    branches:
      - main
jobs:
  example:
    name: Example
    runs-on: ubuntu-latest
    steps:
      # Your other steps here

      - name: Collect Buildnote events
        uses: buildnote/action@main
        env:
          BUILDNOTE_GITHUB_JOB_NAME: Example
          BUILDNOTE_API_KEY: ${{ secrets.BUILDNOTE_API_KEY }}
        if: always()
```

> **Note**: The `if: always()` ensures Buildnote can collect data even if previous steps fail.

### Installation only

You can also use the action to install the Buildnote CLI and then call it directly:

```yaml
name: Advanced workflow with direct CLI usage
on:
  push:
    branches:
      - main

jobs:
  example:
    name: Advanced
    runs-on: ubuntu-latest
    steps:
      - name: Install Buildnote CLI
        uses: buildnote/action@main
        with:
          installOnly: 'true'

      - name: Trace commands
        env:
          BUILDNOTE_GITHUB_JOB_NAME: Advanced
          BUILDNOTE_API_KEY: ${{ secrets.BUILDNOTE_API_KEY }}
        run: |
          buildnote trace --name="performance critical command" -- npm run build
          buildnote collect
```

### Guardrails

Run the guardrails configured in `buildnote.json`, or the ones a policy file declares:

```yaml
      - name: Run guardrails
        uses: buildnote/action@main
        with:
          command: guardrails
          args: |
            --policy=guardrails/backend.json
        env:
          BUILDNOTE_API_KEY: ${{ secrets.BUILDNOTE_API_KEY }}
          BUILDNOTE_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Guardrails gate the build: a failing verdict exits non-zero and fails the step. Use `--fail-on=warning`
or `--fail-on=never` to change what counts as a failure, and `--dry-run` to print the verdicts without
submitting or failing anything.

### Monitoring a job

`command: monitor` records every command a build runs, and their exit codes, without any change to the
build itself. It has two modes.

**Around a command.** Pass a `--` separator followed by the command and the monitor wraps it, tracing it
and everything it starts. This needs no privileges and works on any runner:

```yaml
      - name: Build under the monitor
        uses: buildnote/action@main
        with:
          command: monitor
          args: |
            -- ./gradlew build
        env:
          BUILDNOTE_API_KEY: ${{ secrets.BUILDNOTE_API_KEY }}
          BUILDNOTE_GITHUB_JOB_NAME: build
```

The step exits with the wrapped command's own exit code, so a failing build still fails the job.

**Attached to the job.** With no `--`, the monitor attaches to the runner process and records every
step that follows. The action starts it in the background and stops it in its post step, which is when
the recorded commands are submitted:

```yaml
      - name: Start the monitor
        uses: buildnote/action@main
        with:
          command: monitor
        env:
          BUILDNOTE_API_KEY: ${{ secrets.BUILDNOTE_API_KEY }}
          BUILDNOTE_GITHUB_JOB_NAME: build

      - run: ./gradlew build
      - run: ./gradlew test
```

Attaching upwards uses `ptrace`, and Linux runners restrict it: the action lowers
`/proc/sys/kernel/yama/ptrace_scope` to `0` for you, writing it directly or through passwordless `sudo`.
GitHub-hosted Ubuntu runners allow this. Where it is not allowed - a container without `SYS_PTRACE`, a
self-hosted runner without passwordless `sudo`, macOS - the attach fails, the step reports why and the
job carries on untraced. Use the wrapping mode there instead.

Three things to know about the attached mode:

- The monitor inherits its environment when it starts, so `BUILDNOTE_API_KEY` and
  `BUILDNOTE_GITHUB_JOB_NAME` must be set on the monitor step itself, not on a later one.
- Run one monitor step per job. A process can have only one tracer, so a second attach fails.
- Events are submitted when the monitor is stopped in the post step. A runner that is torn down with
  `SIGKILL` submits nothing.

### Using with GitHub Token

Buildnote preferred way of integration with GitHub is via custom app. In the rare cases where users may not have access
to create a custom GitHub app, Buildnote CLI provides a way to fetch and upload pipeline events directly.

This example shows how to use the action in a workflow that also sends pipeline events directly (with use of GitHub
access token):

```yaml
on:
  push:
    branches:
      - main

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4.1.7

      - name: Collect events
        uses: buildnote/action@main
        env:
          BUILDNOTE_API_KEY: ${{ secrets.BUILDNOTE_API_KEY }}
          BUILDNOTE_GITHUB_JOB_NAME: build-and-test
          BUILDNOTE_GITHUB_TOKEN: ${{secrets.GITHUB_PAT}}
        if: always()
```

Make sure that `buildnote.json` file is configured to collect GitHub action events as per below

```json
{
  "collect": {
    "githubAction": {
      "enabled": true
    }
  }
}
```

## Configuration

### Inputs

| Input         | Description                               | Required | Default |
|---------------|-------------------------------------------|----------|---------|
| `version`     | Version of Buildnote CLI to use           | No       | latest  |
| `command`     | Buildnote CLI command to execute          | No       | collect |
| `args`        | Additional command arguments              | No       |         |
| `verbose`     | Runs Buildnote CLI in verbose mode        | No       | false   |
| `installOnly` | Install Buildnote without running command | No       | false   |

Supported `command` values are `collect`, `guardrails`, `monitor`, `report`, `submit` and `version`.

`version` takes a release number, `latest`, or `dev`. `dev` tracks the newest development build and is
downloaded again on every run, since the build behind it changes while still calling itself `dev`.

### Environment variables

| Variable                    | Description                                             | Required |
|-----------------------------|---------------------------------------------------------|----------|
| `BUILDNOTE_API_KEY`         | API key for authenticating with Buildnote service       | Yes      |
| `BUILDNOTE_GITHUB_JOB_NAME` | Name of the GitHub job (must match workflow definition) | Yes      |
| `BUILDNOTE_GITHUB_TOKEN`    | GitHub token used to fetch pipeline information         | No       |

## GitHub integration in details

For detailed GitHub configuration please refer to
our [documentation page](https://docs.buildnote.io/guide/integrations/github/).

## License

[Apache License 2.0](./LICENSE)