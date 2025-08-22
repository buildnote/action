# Buildnote GitHub Action

This action enables integration between your GitHub workflows and Buildnote.

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Buildnote%20Action-blue.svg?colorA=24292e&colorB=0366d6&style=flat&longCache=true&logo=github)](https://github.com/marketplace/actions/buildnote-action)
[![Release Buildnote Action](https://github.com/buildnote/action/actions/workflows/release.yml/badge.svg)](https://github.com/buildnote/action/actions/workflows/release.yml)

## What does this action do?

The Buildnote GitHub Action provides a wrapper around the [Buildnote CLI](https://buildnote.io/docs/cli/), allowing you
to:

- Collect test results in various formats
- Collect files from the file system
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
| `version`     | Version of Buildnote CLI to use           | No       | 1.1.0  |
| `command`     | Buildnote CLI command to execute          | No       | collect |
| `args`        | Additional command arguments              | No       |         |
| `verbose`     | Runs Buildnote CLI in verbose mode        | No       | false   |
| `installOnly` | Install Buildnote without running command | No       | false   |

### Environment variables

| Variable                    | Description                                             | Required |
|-----------------------------|---------------------------------------------------------|----------|
| `BUILDNOTE_API_KEY`         | API key for authenticating with Buildnote service       | Yes      |
| `BUILDNOTE_GITHUB_JOB_NAME` | Name of the GitHub job (must match workflow definition) | Yes      |
| `BUILDNOTE_GITHUB_TOKEN`    | GitHub token used to fetch pipeline information         | No       |

## GitHub integration in details

For detailed GitHub configuration please refer to
our [documentation page](https://buildnote.io/docs/integrations/github/).

## License

[Apache License 2.0](./LICENSE)