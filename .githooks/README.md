# git 훅

## 설치 (PC마다 한 번씩)

```
git config core.hooksPath .githooks
```

훅은 `.git/hooks/`에 있으면 git으로 전파되지 않는다. 그래서 저장소에 넣어 두고
위 한 줄로 연결한다. **집·사무실 PC 모두에서 실행해야 한다.**

확인:
```
git config core.hooksPath      # .githooks 가 찍히면 적용됨
```

## pre-push — 강제 푸시 차단

원격 커밋이 내 커밋의 조상이 아니면(= 원격 이력을 덮어쓰는 푸시면) 푸시를 중단한다.
원격 브랜치 삭제 푸시도 막는다.

2026-08-05에 사무실에서 강제 푸시가 나가면서 전날 저녁 커밋 24개가 원격에서 지워진
사고가 있었다. 그때 푸시는 원래 거부됐어야 했고, 거부를 무시하고 덮어쓴 것이 원인이다.

막혔을 때는 강제로 뚫지 말고 받아서 확인한다:
```
git fetch origin
git log --oneline HEAD..origin/main    # 내가 안 받은 원격 커밋
git log --oneline origin/main..HEAD    # 원격에 없는 내 커밋
```

## 작업 시작 전 습관

```
git fetch origin && git status -sb
```
`[behind N]`이 붙으면 받기 전에 작업을 시작하지 않는다.
`git status`만으로는 서버를 보지 않아 원격이 바뀌어도 "동기화 완료"로 나온다.
