---
title: "Settings > AI: knowledge sources"
parent: User guide
nav_order: 10.45
---

# Settings > AI: knowledge sources

**Settings > Organization > AI > Knowledge** (`/settings/ai?tab=knowledge`) is where an organization gives its
[AI agents](ai-agents.md) the notes that make their work fit the organization: runbooks, naming
conventions and architecture notes. Built-in triage, remediation and summary runs retrieve the
matching excerpts, and the AI agent cites them in its result. The tab is shown to people who hold
`ai_knowledge:read`; adding, approving and deleting need `ai_knowledge:manage`. Owners and
administrators hold both.

Do not upload owners, criticality or SLAs: they come from your assets. Nothing in a knowledge
source changes a finding by itself (see [what a citation can do](#how-ai-agents-use-it)).

## Add a source

1. Choose **Add source**.
2. Enter a **Name** and an optional **Description**.
3. Choose who can use it (**Visibility**): **Organization** (every AI agent of the
   organization) or **Teams** (only AI agents in the teams you pick, under **Teams that can use it**).
4. Choose the **Data class**: **Internal** or **Restricted**. Restricted text is masked strictly
   and only reaches AI agents whose data ceiling is restricted. Visibility, data class and teams
   cannot be changed later.
5. Save. The source starts as **Pending approval**.

Open the source and choose **Add document**: paste text (plain text or Markdown) or choose a
`.md` or `.txt` file, up to 256 KB per document.

- A document that holds a credential is refused.
- Text that looks like instructions to an AI model is **Quarantined** until a reviewer
  acknowledges it. Approving such text asks you to confirm that you reviewed it.

## Approval

Nothing reaches an AI agent until a second person approves it. The reviewer sees the documents
and chooses **Approve** or **Reject** (with a **Reason**). The organization owner may approve a
source they added themselves; the source then says **Approved by the organization owner who added
it**, and the approval is recorded as a self-approval. Approving asks for a recent sign-in.

| Status | Meaning |
|---|---|
| **Pending approval** | Waiting for a reviewer. No AI agent reads it. |
| **Approved** | AI agents may retrieve it. |
| **Rejected** | Never reaches an AI agent. |
| **Disabled** | AI agents stopped reading it. Disabling applies at once. |
| **Replaced** | An older version, replaced by a newer approved one. |

Editing a document (**Edit as new version**) creates a pending version. The approved version keeps
serving until the new one is approved. **Delete document** removes one version; **Delete source**
removes the source and its documents, and past AI runs keep only the ids and digests of what they
cited.

## Preview retrieval

**Preview retrieval** shows which excerpts a chosen AI agent would retrieve for a **Question**.
It shows document text, so it needs `ai_knowledge:manage`. It checks the AI agent's visibility and
data ceiling the same way a run does.

## How AI agents use it

- Retrieval never crosses organizations, and an AI agent reads only the sources visible to it and
  within its data ceiling.
- Matching excerpts are masked (see [data masking](ai-data-masking.md)), fenced as reference
  material and cited as `kb:<n>`.
- Knowledge alone never changes a finding: a suggestion that rests only on knowledge is written as
  a comment. The AI agent's comment names the cited documents.
- A run's detail lists what it saw (`retrieval_mode`, `knowledge`).

## API

Routes under `/api/v1/ai/knowledge`: `GET` and `POST /sources`, `GET`, `PATCH` and `DELETE
/sources/{id}`, `POST /sources/{id}/approve`, `/reject` and `/disable`, `POST
/sources/{id}/documents`, `DELETE /documents/{id}` and `POST /preview`. Deleting and approving ask
for a recent sign-in.
