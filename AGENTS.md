<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:business-rules -->

# IMPORTANT BUSINESS RULES (헬스장 직감 관리 시스템)

이 프로젝트에서 코드를 작성/수정할 때 아래 규칙을 절대 임의로 변경하지 않는다.
전체 기능명세서: 프로젝트 문서 저장소의 `헬스장_직감_관리_웹앱_최종_기능명세서.md` 참고.

1. 모든 직감 시간마다 힘레븐1과 힘레븐2 각각 1명의 직감자가 필요하다. (DB: `duty_assignments`의 `@@unique([dutySlotId, gymId])`로 보장)
2. 동일 사용자는 같은 날짜에 최대 1개의 직감만 수행할 수 있다. (애플리케이션 레벨 검증 필수, DB 제약만으로는 표현 불가)
3. 사용자의 가능 여부(`availability`)와 선호 여부(`preferred`) 기본값은 false(불가능)다.
4. 사용자는 타임별로 불가능/가능/선호 중 하나를 선택한다. 선호는 `available=true`, `preferred=true`이며 가능 타임 수에는 1개로만 계산한다.
5. "모든 시간 불가능" 체크 시 해당 사용자의 모든 슬롯 가능 여부는 false여야 하고, 자동 배정 후보에서 제외된다.
6. 투표 마감은 매주 금요일 21:00(KST)이다.
7. 금요일 21:00 이후 자동 배정을 실행한다 (Vercel Cron, UTC 12:00 금요일 = KST 21:00).
8. 배정 완료 후 모든 사용자가 자신의 다음 직감을 즉시 확인할 수 있어야 한다.
9. 한 주 전체를 동시에 최적화하며, 결원을 최소화한 뒤 개인별 주간 배정 횟수 제곱합을 최소화한다.
10. 공평성이 같은 조합 중에서는 가능 타임을 많이 제출한 사람을 우선한다. 이 조건 때문에 공평성이 깨져서는 안 된다.
11. 가능 시간이 적은 사용자가 배정 기회를 완전히 잃지 않도록 해야 한다.
12. 최적화 우선순위는 결원 최소화 → 주간 공평성 → 가능 타임 수 → 선호 타임 → 헬스장 선호 → seed 타이브레이커다.
13. 사용자는 자신의 헬스장 선호도를 언제든 변경할 수 있다 (변경은 다음 자동 배정부터 적용, 이미 확정된 배정에는 소급 적용하지 않는다).
14. 직감 교환에는 관리자 승인이 필요하지 않다.
15. 교환 상대방이 수락하고 시스템 검증(활성 계정, 동일 날짜 중복 방지, 하루 2회 방지, 이미 완료된 직감이 아닌지)을 통과하면 자동으로 변경한다. 이미 완료된(`DutyLog.status === COMPLETED`) 직감은 요청 생성/수락 어느 시점에도 교환할 수 없다(양방향은 양쪽 다 검사). 해당 시간에 가능하다고 투표했는지 여부는 더 이상 교환 제약 조건이 아니다(투표하지 않은 사람과도 교환 가능).
16. 관리자는 직감을 직접 변경할 수 있다.
17. 관리자 강제 변경은 사유를 입력받아 감사 로그(`audit_logs`)에 기록한다.
18. 직감 시작 시간에는 실제 출석 시간을 기록한다 (예정 시각보다 늦으면 지각으로 처리).
19. 직감 종료 전 필수 체크리스트를 모두 완료해야 종료 버튼이 활성화된다.
20. 모든 직감 이력(`assignment_history`, `audit_logs`, `duty_logs` 등)은 삭제하지 않고 보관한다 (append-only). 단, 관리자가 잘못된/테스트 기록을 정리하기 위해 사유를 입력하고 특정 `DutyAssignment`(및 연결된 `duty_logs`/`checklist_logs`/`assignment_history`/`duty_exchange_requests`)를 완전히 삭제하는 것은 예외로 허용한다(§78.1) — 삭제 전 상태는 반드시 감사 로그에 스냅샷으로 남긴다.
21. 사용자는 자신의 전체 직감 일정(과거/현재/미래)을 확인할 수 있다.
22. 관리자는 월별 모든 사용자의 직감/출석/퇴근 기록을 확인할 수 있다.
23. 모바일 반응형은 필수다 (사용자 화면은 모바일 우선, 관리자 화면은 PC 우선 + 모바일 기본 지원).
24. PWA는 필수다 (Phase 9에서 구현 예정).
25. 사용자 이름이 변경되어도 과거 기록과의 연결이 끊기면 안 된다 → 모든 관계는 `userId`(고정 ID) 기준으로 연결하고, 화면에는 현재 이름을 표시한다.
26. PIN/비밀번호는 반드시 해시(bcrypt)로 저장한다. 평문 저장 절대 금지.
27. 자동 배정 실행 시 §74(검증 체크리스트)를 모두 통과해야 확정한다. 하나라도 실패하면 해당 슬롯은 `UNDERSTAFFED`로 표시하고 임의로 중복 배정하지 않는다.
28. 공휴일 등으로 평일도 주말처럼 3타임이 필요할 수 있다 (§3.3). 관리자가 `special_schedule_days`에 날짜를 등록하면 요일과 무관하게 그 날은 주말 패턴(3타임)으로 슬롯이 생성된다. 이미 생성된 슬롯은 지정/해제와 무관하게 유지된다(삭제하지 않음).
29. 관리자는 정규 투표 마감(금요일 21:00) 이전에도 특정 주의 투표를 조기 마감하고 즉시 자동 배정을 실행할 수 있다 (`voting_closures`). 조기 마감된 주는 사용자가 더 이상 투표를 수정할 수 없다. 재오픈하면 그 조기 마감으로 생성된 배정도 함께 취소한다(단, 이미 시작된 직감이 있으면 재오픈을 거부한다).
30. 직감 종료 시 문제/건의 사항(`DutyLog.issueNote`)은 선택 입력이며, 필수 체크리스트 완료 여부나 종료 가능 여부에 영향을 주지 않는다.
31. 조기 종료 판정에도 지각 판정과 동일하게 관리자 설정 유예 시간(`EARLY_END_GRACE_MINUTES`, 기본 5분)을 둔다. 예정 종료 시각으로부터 유예 시간 이내로 일찍 끝내는 것은 정상 종료로 처리한다.
32. 직감 시작·종료·체크리스트 작성은 배정된 날짜(KST 기준 당일)에만 할 수 있다. 사용자는 당일 안에서 시작/종료를 취소하고 다시 진행할 수 있다(종료 취소 없이 시작 취소 불가).

<!-- END:business-rules -->
