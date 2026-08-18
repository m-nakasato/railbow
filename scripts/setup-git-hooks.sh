git config hook.runHook true
git config hook.pre-commit-lint.event pre-commit
git config hook.pre-commit-lint.command "npm run lint"
git config hook.pre-merge-test.event pre-merge-commit
git config hook.pre-merge-test.command "npm test #"
git config hook.pre-push-test.event pre-push
git config hook.pre-push-test.command "npm test #"
