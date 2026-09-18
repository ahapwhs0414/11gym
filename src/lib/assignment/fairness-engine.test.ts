import assert from "node:assert/strict";
import test from "node:test";
import { assignWeek, type SlotInput, type UserInput } from "./fairness-engine";

function slot(id: string, date: string, order: number): SlotInput {
  return { id, date, sortKey: `${date}-${order}` };
}

function user(id: string, availableSlotCountThisWeek: number): UserInput {
  return { id, gymPreference: "ANY", availableSlotCountThisWeek };
}

test("모든 자리를 채우면서 주간 횟수의 제곱합을 최소화한다", () => {
  const slots = [
    slot("mon", "2026-09-21", 1),
    slot("tue", "2026-09-22", 2),
    slot("wed", "2026-09-23", 3),
    slot("thu", "2026-09-24", 4),
    slot("fri", "2026-09-25", 5),
  ];
  const users = ["A", "B", "C", "D", "E", "F"].map((id) => user(id, 5));
  const slotCandidates = new Map(slots.map((s) => [s.id, users.map((u) => u.id)]));

  const plan = assignWeek({ slots, users, slotCandidates, seed: "week-1" });
  const sortedCounts = Object.values(plan.fairness.counts).sort((a, b) => b - a);

  assert.equal(plan.assignments.length, 10);
  assert.deepEqual(plan.understaffed, []);
  assert.deepEqual(sortedCounts, [2, 2, 2, 2, 1, 1]);
  assert.equal(plan.fairness.spread, 1);
  assert.equal(plan.fairness.optimal, true);
});

test("같은 날짜의 여러 타임에 한 사용자를 두 번 배정하지 않는다", () => {
  const slots = [
    slot("sat-am", "2026-09-26", 1),
    slot("sat-pm", "2026-09-26", 2),
    slot("sat-night", "2026-09-26", 3),
  ];
  const users = [user("A", 3), user("B", 3), user("C", 3)];
  const slotCandidates = new Map(slots.map((s) => [s.id, users.map((u) => u.id)]));

  const plan = assignWeek({ slots, users, slotCandidates, seed: "same-day" });
  const assignedUsers = plan.assignments.map((a) => a.userId);

  assert.equal(plan.assignments.length, 3);
  assert.equal(new Set(assignedUsers).size, 3);
  assert.equal(plan.understaffed.length, 3);
});

test("공평성과 가능 타임 수가 같으면 선호 타임을 우선한다", () => {
  const slots = [slot("sat-1500", "2026-09-26", 1)];
  const users = [user("A", 1), user("B", 1), user("C", 1)];
  const slotCandidates = new Map([["sat-1500", ["A", "B", "C"]]]);
  const preferredSlotCandidates = new Map([["sat-1500", ["B", "C"]]]);

  const plan = assignWeek({
    slots,
    users,
    slotCandidates,
    preferredSlotCandidates,
    seed: "preferred",
  });

  assert.deepEqual(
    new Set(plan.assignments.map((a) => a.userId)),
    new Set(["B", "C"])
  );
});

test("공평성이 같을 때는 선호 타임보다 가능한 타임 수를 먼저 본다", () => {
  const slots = [slot("mon", "2026-09-21", 1)];
  const users = [user("A", 5), user("B", 1), user("C", 1)];
  const slotCandidates = new Map([["mon", ["A", "B", "C"]]]);
  const preferredSlotCandidates = new Map([["mon", ["B", "C"]]]);

  const plan = assignWeek({
    slots,
    users,
    slotCandidates,
    preferredSlotCandidates,
    seed: "availability-before-preference",
  });

  assert.ok(plan.assignments.some((a) => a.userId === "A"));
});

test("선정된 두 사람의 헬스장 선호를 함께 만족시킨다", () => {
  const slots = [slot("mon", "2026-09-21", 1)];
  const users: UserInput[] = [
    { ...user("A", 1), gymPreference: "GYM1" },
    { ...user("B", 1), gymPreference: "GYM2" },
  ];
  const slotCandidates = new Map([["mon", ["A", "B"]]]);

  const plan = assignWeek({ slots, users, slotCandidates, seed: "gyms" });

  assert.ok(plan.assignments.some((a) => a.userId === "A" && a.gym === "GYM1"));
  assert.ok(plan.assignments.some((a) => a.userId === "B" && a.gym === "GYM2"));
});

test("동일한 seed와 입력은 항상 같은 결과를 만든다", () => {
  const slots = [slot("mon", "2026-09-21", 1), slot("tue", "2026-09-22", 2)];
  const users = [user("A", 2), user("B", 2), user("C", 2)];
  const slotCandidates = new Map(slots.map((s) => [s.id, users.map((u) => u.id)]));

  const first = assignWeek({ slots, users, slotCandidates, seed: "fixed" });
  const second = assignWeek({ slots, users, slotCandidates, seed: "fixed" });

  assert.deepEqual(first, second);
});

test("재실행 시 기존 주간 배정 횟수와 배정 날짜를 반영한다", () => {
  const slots = [slot("tue", "2026-09-22", 1)];
  const users: UserInput[] = [
    {
      ...user("A", 2),
      initialAssignmentCount: 1,
      initiallyAssignedDates: ["2026-09-21"],
    },
    user("B", 1),
    user("C", 1),
  ];
  const slotCandidates = new Map([["tue", ["A", "B", "C"]]]);

  const plan = assignWeek({ slots, users, slotCandidates, seed: "rerun" });

  assert.deepEqual(new Set(plan.assignments.map((a) => a.userId)), new Set(["B", "C"]));
  assert.deepEqual(plan.fairness.counts, { A: 1, B: 1, C: 1 });
});
