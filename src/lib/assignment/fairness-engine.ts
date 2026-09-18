/**
 * 순수 배정 알고리즘 (DB/Next.js 의존성 없음 — 스크립트로 단독 테스트 가능).
 * 명세서 §19-31의 우선순위를 아래처럼 매핑한다.
 *
 *   §23 1단계 (필수 조건)      → 호출자가 slotCandidates를 만들 때 이미 필터링해서 전달
 *   §23 동일 날짜 중복 방지    → assignedDates로 슬롯 처리 중 동적으로 제외
 *   §24 3단계 (가능 슬롯 수)   → 슬롯을 후보자 수가 적은(위험한) 순서로 먼저 처리 (우선순위 6)
 *   주간 공평성                 → 후보 정렬 1번째 키: 이번 주 현재 배정 횟수(적을수록 우선)
 *   가능 시간 우선             → 후보 정렬 2번째 키: 이번 주 가능 슬롯 수(많을수록 우선)
 *   §29 9순위 (동점 시 랜덤)   → 최종 타이브레이커
 *   §30/§31 (헬스장 배정)      → decideGyms()
 */

export type GymKey = "GYM1" | "GYM2";
export type GymPreference = GymKey | "ANY";

export interface SlotInput {
  id: string;
  /** YYYY-MM-DD, 동일 날짜 중복 배정 방지에 사용 */
  date: string;
  /** 동일 후보자 수일 때 결정론적 처리 순서를 위한 정렬 키 (예: `${date}-${startTime}`) */
  sortKey: string;
  /**
   * 이전 실행에서 이미 채워진 헬스장 (재실행 시 중복 배정 방지).
   * 여기 포함된 헬스장은 건드리지 않고, 나머지 헬스장만 새로 채운다.
   */
  prefilledGyms?: GymKey[];
}

export interface UserInput {
  id: string;
  gymPreference: GymPreference;
  /** 이번 주 본인이 가능하다고 표시한 슬롯 수 */
  availableSlotCountThisWeek: number;
}

export interface AssignmentPlanEntry {
  slotId: string;
  gym: GymKey;
  userId: string;
}

export interface UnderstaffedEntry {
  slotId: string;
  gym: GymKey;
}

export interface AssignmentPlan {
  assignments: AssignmentPlanEntry[];
  understaffed: UnderstaffedEntry[];
}

interface WorkingUser extends UserInput {
  workingCount: number;
  assignedDates: Set<string>;
}

function other(gym: GymKey): GymKey {
  return gym === "GYM1" ? "GYM2" : "GYM1";
}

/** 두 명이 확정된 뒤 힘레븐1/2를 배정한다 (명세서 §30/§31). */
function decideGyms(p1: WorkingUser, p2: WorkingUser, random: () => number): [GymKey, GymKey] {
  const pref1 = p1.gymPreference;
  const pref2 = p2.gymPreference;

  // 1순위: 선호 반영. 서로 다른 헬스장을 원하면 충돌 없음.
  if (pref1 !== "ANY" && pref2 !== "ANY" && pref1 !== pref2) {
    return [pref1, pref2];
  }
  if (pref1 !== "ANY" && pref2 === "ANY") {
    return [pref1, other(pref1)];
  }
  if (pref2 !== "ANY" && pref1 === "ANY") {
    return [other(pref2), pref2];
  }

  if (pref1 !== "ANY" && pref1 === pref2) {
    // 둘 다 같은 헬스장을 원하면 과거 이력을 보지 않고 랜덤으로 한 명에게 선호 헬스장을 배정한다.
    return random() < 0.5 ? [pref1, other(pref1)] : [other(pref1), pref1];
  }

  // 둘 다 "상관없음"이면 과거 이력을 보지 않고 랜덤 배정한다.
  return random() < 0.5 ? ["GYM1", "GYM2"] : ["GYM2", "GYM1"];
}

function compareCandidates(a: WorkingUser, b: WorkingUser): number {
  // 1순위: 이번 주 배정 횟수를 최대한 균등하게 유지한다.
  if (a.workingCount !== b.workingCount) return a.workingCount - b.workingCount;

  // 2순위: 같은 횟수라면 이번 주 가능한 타임이 많은 사람을 우선한다.
  if (a.availableSlotCountThisWeek !== b.availableSlotCountThisWeek) {
    return b.availableSlotCountThisWeek - a.availableSlotCountThisWeek;
  }

  return 0;
}

export function assignWeek(params: {
  slots: SlotInput[];
  users: UserInput[];
  /** slotId -> 그 슬롯에 가능하다고 표시한 userId 목록 */
  slotCandidates: Map<string, string[]>;
  random?: () => number;
}): AssignmentPlan {
  const { slots, users, slotCandidates, random = Math.random } = params;

  const workingUsers = new Map<string, WorkingUser>(
    users.map((u) => [
      u.id,
      {
        ...u,
        workingCount: 0,
        assignedDates: new Set<string>(),
      },
    ])
  );

  // 후보자 수가 적은(=결원 위험이 높은) 슬롯을 먼저 처리한다 (§24, 우선순위 6).
  const orderedSlots = [...slots].sort((a, b) => {
    const countA = slotCandidates.get(a.id)?.length ?? 0;
    const countB = slotCandidates.get(b.id)?.length ?? 0;
    if (countA !== countB) return countA - countB;
    return a.sortKey.localeCompare(b.sortKey);
  });

  const assignments: AssignmentPlanEntry[] = [];
  const understaffed: UnderstaffedEntry[] = [];

  for (const slot of orderedSlots) {
    const prefilled = new Set(slot.prefilledGyms ?? []);
    const openGyms: GymKey[] = (["GYM1", "GYM2"] as GymKey[]).filter((g) => !prefilled.has(g));
    if (openGyms.length === 0) continue; // 이미 두 자리 모두 채워짐 (재실행)

    const candidateIds = slotCandidates.get(slot.id) ?? [];
    const eligible = candidateIds
      .map((id) => workingUsers.get(id))
      .filter((u): u is WorkingUser => !!u && !u.assignedDates.has(slot.date));

    const ranked = [...eligible].sort(compareCandidates);
    // 동점 구간을 랜덤으로 섞기 위해 정렬 후 동점 그룹 내에서만 셔플한다.
    shuffleTiedGroups(ranked, random);

    const chosen = ranked.slice(0, openGyms.length);

    if (openGyms.length === 2) {
      if (chosen.length === 2) {
        const [gymA, gymB] = decideGyms(chosen[0], chosen[1], random);
        applyAssignment(chosen[0], slot, gymA, assignments);
        applyAssignment(chosen[1], slot, gymB, assignments);
      } else if (chosen.length === 1) {
        const gym: GymKey = chosen[0].gymPreference !== "ANY" ? chosen[0].gymPreference : "GYM1";
        applyAssignment(chosen[0], slot, gym, assignments);
        understaffed.push({ slotId: slot.id, gym: other(gym) });
      } else {
        understaffed.push({ slotId: slot.id, gym: "GYM1" }, { slotId: slot.id, gym: "GYM2" });
      }
    } else {
      // 한 자리만 비어 있는 재실행 상황: 그 한 자리만 채운다.
      const onlyGym = openGyms[0];
      if (chosen.length === 1) {
        applyAssignment(chosen[0], slot, onlyGym, assignments);
      } else {
        understaffed.push({ slotId: slot.id, gym: onlyGym });
      }
    }
  }

  return { assignments, understaffed };
}

function applyAssignment(
  user: WorkingUser,
  slot: SlotInput,
  gym: GymKey,
  assignments: AssignmentPlanEntry[]
) {
  assignments.push({ slotId: slot.id, gym, userId: user.id });
  user.workingCount += 1;
  user.assignedDates.add(slot.date);
}

/** compareCandidates 기준으로 완전히 동점인 인접 구간만 랜덤 셔플한다 (§29 9순위). */
function shuffleTiedGroups(sorted: WorkingUser[], random: () => number) {
  let start = 0;
  while (start < sorted.length) {
    let end = start + 1;
    while (end < sorted.length && compareCandidates(sorted[start], sorted[end]) === 0) {
      end += 1;
    }
    for (let i = end - 1; i > start; i -= 1) {
      const j = start + Math.floor(random() * (i - start + 1));
      [sorted[i], sorted[j]] = [sorted[j], sorted[i]];
    }
    start = end;
  }
}
