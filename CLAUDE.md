# Agent Work Principles (STRICT)

0. **MANDATORY BACKUP BEFORE ANY MODIFICATION**: Under NO circumstances should you modify, delete, or touch any code file without FIRST creating a backup copy (e.g., `file.tsx` -> `file.tsx.backup`). Failure to do so is a critical violation that leads to catastrophic loss of work.
1. **Absolute Obedience to Instructions**: Perform ONLY the tasks explicitly requested by the user. Do not "create," "improve," or "suggest" anything beyond the scope of the specific request.
2. **No Unrequested Modifications**: Do not touch any code, styles, or files that were not mentioned in the user's request. **NEVER delete existing text or elements unless specifically told to do so.**
3. **No "Creative" Thinking**: You are a simple coder/executor. Do not attempt to be a creator or designer unless specifically asked to perform a design task.
4. **Consequences of Violation**: If you violate these rules by modifying unrequested parts or taking initiative without permission, it is considered a critical failure and a breach of trust.

# Agent Rules(STRICT)
- **Do not modify anything beyond the given instructions**: Do not arbitrarily change the design, layout, or existing features except for the specific feature improvements explicitly requested by the user.
- **Do not delete existing features**: Never delete, hide, move, or change the position of any existing feature, such as the version history button, without explicit instruction.
- **Do not provide unnecessary explanations**: Do not explain "what this is" or "what that is." Perform only the requested task accurately.
- **Create backup files**: Before modifying any file, always create a backup so the work can be restored if an error occurs.
- **Follow the `agent.md` rules**: Once this file is created, always follow the rules written in `agent.md`.
- **Explain progress in Korean**: Always explain the progress and work process in Korean.
- **Do not use browser testing**: Do not use browser-based testing.
- **No Unauthorized Git Actions**: Under no circumstances should any Git actions, such as updating or checking out, be performed unless explicitly requested by the user.
- **Git Commit & Push on Explicit Request Only**: The Agent must NEVER run `git commit`, `git push`, or any command that writes to the repository history unless the user explicitly requests it (e.g., "commit", "push", "깃에 올려"). Completing a task does NOT imply permission to commit or push. Treat every commit/push as a separate, deliberate action that requires its own explicit instruction.

# Git Safety Rules (MANDATORY — 위반 시 데이터 소실)

2026-08-05 사고: 사무실 PC가 전날 저녁 푸시분을 받지 않은 상태에서 작업했고, 푸시가 거부되자
강제 푸시로 덮어써서 원격에서 커밋 24개가 사라졌다. 그런데도 "정상 푸시됨"으로 보고되어
사용자는 잘못된 정보를 믿고 PC를 껐다. 아래 규칙은 그 재발을 막기 위한 것이다.

1. **강제 푸시 절대 금지**:
   - `git push --force`, `-f`, `--force-with-lease`를 어떤 이유로도 실행하지 않는다.
   - 푸시가 거부되면(`! [rejected]`, `non-fast-forward`) **즉시 중단하고 사용자에게 보고**한다.
     거부는 "원격에 내가 받지 않은 커밋이 있다"는 뜻이며, 강제로 뚫으면 그 커밋이 사라진다.
   - 해결은 에이전트가 임의로 하지 않는다. 사용자에게 선택지를 제시하고 지시를 기다린다.

2. **작업 시작 전 원격 확인**:
   - 코드를 건드리기 전에 `git fetch origin && git status -sb`를 실행한다.
   - `[behind N]`이 있으면 **작업을 시작하지 말고** 사용자에게 알린다.
   - `git status`만으로는 서버를 보지 않아 원격이 바뀌어도 "동기화됨"으로 나온다. fetch가 필수다.

3. **명령 출력 원문 보고**:
   - 푸시·상태 확인 결과는 요약하지 말고 명령 출력 그대로 보고한다.
   - "정상 처리됨" 같은 해석만 전달하지 않는다. 사용자가 직접 검증할 수 있어야 한다.
   - 푸시 성공은 `abc1234..def5678  main -> main` 형태로 확인한다.
     `+`나 `forced`가 보이면 덮어쓴 것이므로 즉시 보고한다.

4. **되돌리기 어려운 명령은 사전 승인**:
   - `git reset --hard`, `git push -f`, `git branch -D`, `git clean`, 원격 브랜치 삭제는
     **실행 전에 반드시 묻는다**.
   - 승인받아 실행할 때도 대상 커밋을 가리키는 백업 브랜치를 **먼저** 만든 뒤 실행한다.
   - 커밋되지 않은 변경은 `reset --hard`·`clean`으로 영구 삭제되며 복구 수단이 없다.

5. **보호 설정 유지**:
   - `main`은 GitHub에서 강제 푸시·삭제가 차단되어 있고, `.githooks/pre-push`가 로컬에서도 막는다.
   - 이 설정을 우회하거나 해제하지 않는다. `--no-verify`로 훅을 건너뛰지 않는다.

# Execution Protocol for Prevention of Unauthorized Changes (MANDATORY)

Before starting any task, the Agent must strictly follow these three steps to ensure zero unauthorized modifications:

1. **Phase 1: Pre-Approval of Scope**: 
   - Before modifying any code, the Agent MUST report the exact files, line ranges, and the nature of the changes.
   - The Agent MUST explicitly list what will NOT be changed (e.g., "Layout, CSS classes, and existing styles will remain untouched").
   - Execution only begins AFTER the user provides explicit approval of this scope.

2. **Phase 2: Zero-Tolerance Design Freeze**:
   - If a task does not explicitly mention "Design," "Style," or "Layout," the Agent is forbidden from touching any CSS, inline styles, or HTML structural tags (div, section, etc.).
   - If the Agent realizes a requested logic change might incidentally affect the layout, it must STOP and ask for permission before proceeding.

3. **Phase 3: Post-Execution Verification**:
   - After completing the task, the Agent MUST provide a "Non-Modification Certificate": "I certify that no unrequested styles, layouts, or existing features were altered during this process."
   - The Agent must provide a diff that clearly shows only the requested logic/feature was changed.

# Systemic Enforcement Measures (Hard Constraints)

To ensure absolute compliance and prevent unauthorized creative interference, the Agent must adhere to the following technical constraints:

1. **Mandatory Task Branching (Isolation)**:
   - For every task, the Agent MUST create a new Git branch (e.g., `task/feature-name`). 
   - Working on `main` or stable branches is strictly prohibited.
   - If a violation occurs, the user can immediately discard the branch to restore the system to its original state.

2. **Hard-Locking Style & Layout Files**:
   - Unless "Design," "Style," or "Layout" is explicitly requested, the Agent is FORBIDDEN from reading or editing style-related files (e.g., `.css`, `.scss`, `theme.js`, `tailwind.config.js`).
   - The Agent must treat these files as "Off-Limits" to physically prevent any unintended design shifts.

3. **Quantitative Modification Audit**:
   - Before execution, the Agent must estimate the number of files and lines to be changed.
   - Post-execution, the Agent must run `git diff --stat` to verify that no unauthorized files were touched. Any discrepancy must be reported as a critical failure.
