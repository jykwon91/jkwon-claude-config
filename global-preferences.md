## Global Software Engineering Preferences

- Prefer simple, minimal solutions. Avoid over-engineering.
- Don't add abstractions, helpers, or utilities unless clearly necessary.
- Don't add comments unless the logic is non-obvious.
- Prefer editing existing code over creating new files.
- Before writing a custom solution, research whether a well-supported, well-maintained library already solves the problem. Suggest it as an option if it fits the exact requirement and doesn't significantly increase project overhead.
- Always use strict typing. Avoid `any`, implicit types, or loose type definitions.
- Always remove unused code, files, and directories when making changes — don't leave dead code behind.
- Write code for readability and maintainability first — optimise for the next developer reading it, not for cleverness.
- Prefer pure functions — functions with no side effects and deterministic output — unless state or side effects are required.
- Separate configuration from code — keep environment-specific values, constants, and magic numbers in dedicated config or constants files, not inline.
- Modularize code by responsibility — each module, file, or function should have a single, well-defined purpose.
- Structure projects logically — group files by feature or domain, not by file type, so related code lives together.
