# Project Rules

- Keep the product focused on the student smart calendar: recurring commitments, deadline-based study planning, and rescheduling unfinished work.
- Do not add unrelated features or change the product concept without approval.
- Keep the static app dependency-light. Do not add external services, credentials, or personal data to the repository.
- Treat local browser storage as per-user data; do not imply that schedules sync between users.
- Add regression tests for scheduling and completion behavior. Run `npm test` before pushing changes.
- GitHub Pages deploys from `main` only after the test job passes.
