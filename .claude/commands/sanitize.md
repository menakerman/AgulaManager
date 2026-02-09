---
description: Sanitize code after changes
---
npm run lint and fix errors.
npm test and fix errors.
npm run build and fix errors.
read file .claude/SANITIZE.md from the root of the project, and see the commit sha of the last run.
npm run test -- --coverage for all changed files since the last run. if it is below 80% for a specific file, add tests. avoid using mocks if possible, but do use them if it is the only way to test the code.
npm run lint on the test files that were changed.
write the commit sha of the current run to the file .claude/SANITIZE.md from the root of the project.
commit the changes you have made.
