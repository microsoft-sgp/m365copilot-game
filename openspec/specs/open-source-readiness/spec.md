# open-source-readiness

## Purpose

Defines the repository, documentation, community health, legal notice, data responsibility, deployment consistency, and secret hygiene requirements needed for public open-source readiness.

## Requirements

### Requirement: Public Repository Entrypoint

The repository SHALL provide a root README that explains the project purpose, target audience, primary features, architecture, local setup options, deployment entry points, testing commands, data-handling considerations, contribution path, support path, security reporting path, and license.

#### Scenario: New adopter lands on the repository

- **GIVEN** a first-time adopter opens the repository README
- **WHEN** they scan the README for how to evaluate and run the project
- **THEN** the README MUST identify what the app does, who it is for, how to run it locally, where to deploy it from, where to get help, where to report vulnerabilities, and which license applies

#### Scenario: README links to deeper guidance

- **GIVEN** a reader needs contribution, support, security, deployment, or license details
- **WHEN** they follow README links
- **THEN** the repository MUST provide linked files or sections for each topic using repository-relative paths

### Requirement: Community Health Files

The repository SHALL include GitHub-recognized community health files for contributor onboarding, code of conduct, security policy, support expectations, issue intake, pull request intake, and code ownership.

#### Scenario: Contributor opens an issue or pull request

- **GIVEN** a contributor starts a new issue or pull request on GitHub
- **WHEN** GitHub renders the issue or pull request authoring experience
- **THEN** the contributor MUST see templates or guidance that ask for relevant context, reproduction details, testing notes, and agreement to follow the code of conduct

#### Scenario: Maintainer reviews ownership

- **GIVEN** a maintainer configures branch protection or review expectations
- **WHEN** they inspect repository ownership guidance
- **THEN** the repository MUST include a CODEOWNERS file or explicit maintainer placeholder for the project owners to finalize before public release

### Requirement: Microsoft Conduct Security And Legal Notices

The repository SHALL provide public notices for Microsoft-compatible code of conduct, security vulnerability reporting, license, trademark usage, warranty limitations, and support boundaries.

#### Scenario: Security reporter finds a vulnerability

- **GIVEN** a security researcher believes the project has a vulnerability
- **WHEN** they read the repository security policy
- **THEN** the policy MUST tell them not to open a public GitHub issue and MUST direct them to the Microsoft-approved vulnerability reporting path or a maintainer-confirmed reporting path

#### Scenario: User evaluates Microsoft association

- **GIVEN** a public user sees Microsoft 365 Copilot, Microsoft, or Copilot names in the repository
- **WHEN** they read the legal or README notice
- **THEN** the repository MUST clarify license terms, trademark ownership, non-warranty terms, and whether the project is provided as a sample or supported product

### Requirement: Deployer Data Responsibility

The repository SHALL document the categories of data the app stores or exports and SHALL state that deployers are responsible for privacy, consent, retention, access control, and compliance for their event or organization.

#### Scenario: Event facilitator prepares production use

- **GIVEN** an event facilitator plans to deploy the app with real attendees
- **WHEN** they read setup or deployment documentation
- **THEN** the documentation MUST identify that player names, emails, gameplay progress, admin emails, OTP metadata, and CSV exports can contain personal or sensitive operational data

#### Scenario: Admin exports player data

- **GIVEN** an admin uses export features
- **WHEN** they read support, README, or deployment guidance
- **THEN** the documentation MUST state that exported files should be protected according to the deployer's organizational data-handling policies

### Requirement: Setup And Deployment Consistency

The repository SHALL keep setup and deployment documentation consistent with the current product behavior and SHALL include required deploy-time configuration files in source when practical.

#### Scenario: Deployment guide verifies gameplay

- **GIVEN** the current product uses server-assigned packs
- **WHEN** a user follows deployment verification steps
- **THEN** the documentation MUST NOT instruct them to manually pick a pack or use Quick Pick as part of the current primary flow

#### Scenario: Static Web Apps deployment needs SPA fallback

- **GIVEN** Azure Static Web Apps requires a fallback config for hash or SPA routing behavior
- **WHEN** a public user builds the frontend for deployment
- **THEN** the required `staticwebapp.config.json` file MUST already exist in source or the documentation MUST explain why it is intentionally generated elsewhere

### Requirement: Public Secret Hygiene

The repository SHALL avoid committed production secrets and SHALL provide placeholder-only examples for local settings, deployment values, keys, connection strings, tokens, and Terraform variables.

#### Scenario: Maintainer scans public docs before release

- **GIVEN** public release preparation includes a secret scan over docs and configuration examples
- **WHEN** the scan checks for real-looking keys, connection strings, deployment tokens, subscription identifiers, tenant identifiers, and production endpoints
- **THEN** any production secret or environment-specific private value MUST be removed, replaced with a placeholder, or moved to secure deployment storage before release

#### Scenario: User copies local setup examples

- **GIVEN** a user copies sample local configuration
- **WHEN** the sample contains credentials or keys
- **THEN** the sample MUST clearly identify them as local-only or placeholder values and MUST tell users not to reuse them in shared, staging, or production environments
