/**
 * 한 주 전체를 동시에 계산하는 순수 배정 최적화 엔진.
 *
 * 우선순위는 반드시 아래 사전식(lexicographic) 순서를 따른다.
 *   1. 채울 수 있는 자리를 최대한 채운다.
 *   2. 개인별 주간 배정 횟수의 제곱합을 최소화한다.
 *   3. 공평성이 같으면 가능한 타임을 많이 제출한 사람을 우선한다.
 *   4. 선호 타임을 최대한 반영한다.
 *   5. 힘레븐1/2 선호를 최대한 반영한다.
 *   6. 완전히 같으면 seed 기반의 결정론적 타이브레이커를 사용한다.
 *
 * 최소비용 최대유량으로 전체 조합을 탐색하므로 앞선 타임의 선택 때문에
 * 뒤 타임의 더 좋은 조합을 놓치는 greedy 방식의 문제가 없다.
 */

export type GymKey = "GYM1" | "GYM2";
export type GymPreference = GymKey | "ANY";

export interface SlotInput {
  id: string;
  /** YYYY-MM-DD, 동일 날짜 중복 배정 방지에 사용 */
  date: string;
  /** 결정론적인 노드 생성 순서에 사용 (예: `${date}-${startTime}`) */
  sortKey: string;
  /** 재실행할 때 이미 채워져 있어 새로 배정하지 않을 헬스장 */
  prefilledGyms?: GymKey[];
}

export interface UserInput {
  id: string;
  gymPreference: GymPreference;
  /** 이번 주 가능 또는 선호로 제출한 전체 타임 수 */
  availableSlotCountThisWeek: number;
  /** 재실행 전에 이미 존재하는 이번 주 배정 수 */
  initialAssignmentCount?: number;
  /** 재실행 전에 이미 배정된 날짜 */
  initiallyAssignedDates?: string[];
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

export interface FairnessSummary {
  counts: Record<string, number>;
  maximum: number;
  minimum: number;
  spread: number;
  sumSquares: number;
  /** 현재 제약 안에서 제곱합이 최소임을 최적화 엔진이 보장한다. */
  optimal: true;
}

export interface AssignmentPlan {
  assignments: AssignmentPlanEntry[];
  understaffed: UnderstaffedEntry[];
  fairness: FairnessSummary;
}

/** [공평성, 가능 타임 우선, 선호 타임, 헬스장 선호, seed tie] */
type Cost = [number, number, number, number, number];

interface Edge {
  to: number;
  reverseIndex: number;
  capacity: number;
  cost: Cost;
  assignment?: AssignmentPlanEntry;
}

const ZERO_COST: Cost = [0, 0, 0, 0, 0];

function addCost(a: Cost, b: Cost): Cost {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4]];
}

function negateCost(cost: Cost): Cost {
  return [-cost[0], -cost[1], -cost[2], -cost[3], -cost[4]];
}

function compareCost(a: Cost, b: Cost): number {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function stableHash(value: string): number {
  // FNV-1a 32-bit. 암호화 목적이 아니라 동일 입력의 결과 재현용이다.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function addEdge(
  graph: Edge[][],
  from: number,
  to: number,
  capacity: number,
  cost: Cost,
  assignment?: AssignmentPlanEntry
) {
  const forward: Edge = {
    to,
    reverseIndex: graph[to].length,
    capacity,
    cost,
    assignment,
  };
  const reverse: Edge = {
    to: from,
    reverseIndex: graph[from].length,
    capacity: 0,
    cost: negateCost(cost),
  };
  graph[from].push(forward);
  graph[to].push(reverse);
}

function addNode(graph: Edge[][]): number {
  graph.push([]);
  return graph.length - 1;
}

/** 잔여 그래프에서 사전식 비용이 가장 작은 증가 경로를 찾는다. */
function shortestAugmentingPath(graph: Edge[][], source: number, sink: number) {
  const distance: Array<Cost | null> = Array(graph.length).fill(null);
  const previousNode = Array<number>(graph.length).fill(-1);
  const previousEdge = Array<number>(graph.length).fill(-1);
  distance[source] = ZERO_COST;

  // 역방향 간선은 음수 비용일 수 있으므로 Bellman-Ford를 사용한다.
  for (let pass = 0; pass < graph.length - 1; pass += 1) {
    let changed = false;
    for (let from = 0; from < graph.length; from += 1) {
      const base = distance[from];
      if (!base) continue;
      for (let edgeIndex = 0; edgeIndex < graph[from].length; edgeIndex += 1) {
        const edge = graph[from][edgeIndex];
        if (edge.capacity <= 0) continue;
        const candidate = addCost(base, edge.cost);
        const current = distance[edge.to];
        if (!current || compareCost(candidate, current) < 0) {
          distance[edge.to] = candidate;
          previousNode[edge.to] = from;
          previousEdge[edge.to] = edgeIndex;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  if (!distance[sink]) return null;
  return { previousNode, previousEdge };
}

function minCostMaximumFlow(graph: Edge[][], source: number, sink: number) {
  while (true) {
    const path = shortestAugmentingPath(graph, source, sink);
    if (!path) break;

    let node = sink;
    while (node !== source) {
      const from = path.previousNode[node];
      const edgeIndex = path.previousEdge[node];
      if (from < 0 || edgeIndex < 0) {
        throw new Error("배정 최적화 경로를 복원하지 못했습니다.");
      }
      const edge = graph[from][edgeIndex];
      edge.capacity -= 1;
      graph[node][edge.reverseIndex].capacity += 1;
      node = from;
    }
  }
}

export function assignWeek(params: {
  slots: SlotInput[];
  users: UserInput[];
  /** slotId -> 그 슬롯을 가능 또는 선호로 제출한 userId 목록 */
  slotCandidates: Map<string, string[]>;
  /** slotId -> 해당 슬롯을 선호로 제출한 userId 목록 */
  preferredSlotCandidates?: Map<string, string[]>;
  /** 같은 입력이면 같은 결과를 만드는 주차+투표 해시 */
  seed: string;
}): AssignmentPlan {
  const {
    slots,
    users,
    slotCandidates,
    preferredSlotCandidates = new Map<string, string[]>(),
    seed,
  } = params;

  const orderedSlots = [...slots].sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const orderedUsers = [...users].sort((a, b) => a.id.localeCompare(b.id));
  const userById = new Map(orderedUsers.map((user) => [user.id, user]));

  const graph: Edge[][] = [];
  const source = addNode(graph);
  const sink = addNode(graph);
  const userDateNodes = new Map<string, number>();
  const seatNodes = new Map<string, number>();

  const openSeats: Array<{ slot: SlotInput; gym: GymKey; key: string }> = [];
  for (const slot of orderedSlots) {
    const prefilled = new Set(slot.prefilledGyms ?? []);
    for (const gym of ["GYM1", "GYM2"] as GymKey[]) {
      if (!prefilled.has(gym)) openSeats.push({ slot, gym, key: `${slot.id}:${gym}` });
    }
  }

  for (const seat of openSeats) {
    const node = addNode(graph);
    seatNodes.set(seat.key, node);
    addEdge(graph, node, sink, 1, ZERO_COST);
  }

  for (const user of orderedUsers) {
    const userNode = addNode(graph);
    const blockedDates = new Set(user.initiallyAssignedDates ?? []);
    const eligibleDates = new Set<string>();
    for (const slot of orderedSlots) {
      if (blockedDates.has(slot.date)) continue;
      if ((slotCandidates.get(slot.id) ?? []).includes(user.id)) eligibleDates.add(slot.date);
    }

    const initialCount = user.initialAssignmentCount ?? 0;
    for (let index = 1; index <= eligibleDates.size; index += 1) {
      const resultingCount = initialCount + index;
      const squareIncrement = resultingCount ** 2 - (resultingCount - 1) ** 2;
      addEdge(graph, source, userNode, 1, [
        squareIncrement,
        -user.availableSlotCountThisWeek,
        0,
        0,
        0,
      ]);
    }

    for (const date of [...eligibleDates].sort()) {
      const dateNode = addNode(graph);
      userDateNodes.set(`${user.id}:${date}`, dateNode);
      addEdge(graph, userNode, dateNode, 1, ZERO_COST);
    }
  }

  for (const seat of openSeats) {
    const candidateIds = [...new Set(slotCandidates.get(seat.slot.id) ?? [])].sort();
    const preferredIds = new Set(preferredSlotCandidates.get(seat.slot.id) ?? []);
    for (const userId of candidateIds) {
      const user = userById.get(userId);
      if (!user || (user.initiallyAssignedDates ?? []).includes(seat.slot.date)) continue;
      const dateNode = userDateNodes.get(`${user.id}:${seat.slot.date}`);
      const seatNode = seatNodes.get(seat.key);
      if (dateNode === undefined || seatNode === undefined) continue;

      const prefersTime = preferredIds.has(user.id);
      const gymMismatch = user.gymPreference !== "ANY" && user.gymPreference !== seat.gym;
      const tie = stableHash(`${seed}|${user.id}|${seat.slot.id}|${seat.gym}`);
      addEdge(
        graph,
        dateNode,
        seatNode,
        1,
        [0, 0, prefersTime ? 0 : 1, gymMismatch ? 1 : 0, tie],
        { slotId: seat.slot.id, gym: seat.gym, userId: user.id }
      );
    }
  }

  minCostMaximumFlow(graph, source, sink);

  const assignments: AssignmentPlanEntry[] = [];
  for (const edges of graph) {
    for (const edge of edges) {
      if (edge.assignment && edge.capacity === 0) assignments.push(edge.assignment);
    }
  }
  assignments.sort((a, b) => {
    const slotCompare = a.slotId.localeCompare(b.slotId);
    return slotCompare !== 0 ? slotCompare : a.gym.localeCompare(b.gym);
  });

  const assignedSeatKeys = new Set(assignments.map((a) => `${a.slotId}:${a.gym}`));
  const understaffed = openSeats
    .filter((seat) => !assignedSeatKeys.has(seat.key))
    .map((seat) => ({ slotId: seat.slot.id, gym: seat.gym }));

  const counts: Record<string, number> = {};
  for (const user of orderedUsers) counts[user.id] = user.initialAssignmentCount ?? 0;
  for (const assignment of assignments) counts[assignment.userId] += 1;

  const fairnessUserIds = orderedUsers
    .filter((user) => user.availableSlotCountThisWeek > 0 || (user.initialAssignmentCount ?? 0) > 0)
    .map((user) => user.id);
  const fairnessCounts = fairnessUserIds.map((id) => counts[id]);
  const maximum = fairnessCounts.length > 0 ? Math.max(...fairnessCounts) : 0;
  const minimum = fairnessCounts.length > 0 ? Math.min(...fairnessCounts) : 0;

  return {
    assignments,
    understaffed,
    fairness: {
      counts,
      maximum,
      minimum,
      spread: maximum - minimum,
      sumSquares: fairnessCounts.reduce((sum, count) => sum + count ** 2, 0),
      optimal: true,
    },
  };
}
