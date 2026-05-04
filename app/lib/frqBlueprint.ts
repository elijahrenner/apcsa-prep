export const FRQ_ARCHETYPE_ORDER = [
  "methods_control",
  "class_writing",
  "arraylist",
  "array_2d",
] as const;

export type FrqArchetype = (typeof FRQ_ARCHETYPE_ORDER)[number];

export type FrqBlueprint = {
  id: FrqArchetype;
  position: number;
  label: string;
  shortLabel: string;
  totalPoints: number;
  defaultTopic: string;
  drillWeight: number;
  masteryTargets: string[];
  rubricFocus: string[];
};

export const FRQ_BLUEPRINT: FrqBlueprint[] = [
  {
    id: "methods_control",
    position: 1,
    label: "Methods & Control",
    shortLabel: "Methods",
    totalPoints: 7,
    defaultTopic: "u2_s2_8",
    drillWeight: 7,
    masteryTargets: [
      "method signatures and return types",
      "loop bounds, accumulators, and early returns",
      "String traversal with substring/indexOf and boolean helpers",
    ],
    rubricFocus: [
      "correct header",
      "complete traversal",
      "conditional branch logic",
      "correct return/update",
    ],
  },
  {
    id: "class_writing",
    position: 2,
    label: "Class Writing",
    shortLabel: "Class",
    totalPoints: 7,
    defaultTopic: "u3_s3_4",
    drillWeight: 7,
    masteryTargets: [
      "private instance variables",
      "constructor overloads and default values",
      "mutator/accessor behavior and toString formatting",
    ],
    rubricFocus: [
      "field declarations",
      "constructor initialization",
      "state mutation",
      "specified output format",
    ],
  },
  {
    id: "arraylist",
    position: 3,
    label: "ArrayList",
    shortLabel: "ArrayList",
    totalPoints: 5,
    defaultTopic: "u4_s4_10",
    drillWeight: 5,
    masteryTargets: [
      "ArrayList traversal by index or enhanced for",
      "adding/removing while preserving required order",
      "object method calls inside collection logic",
    ],
    rubricFocus: [
      "correct collection type",
      "safe traversal",
      "filter/transform condition",
      "correct final collection or count",
    ],
  },
  {
    id: "array_2d",
    position: 4,
    label: "2D Array",
    shortLabel: "2D",
    totalPoints: 6,
    defaultTopic: "u4_s4_13",
    drillWeight: 6,
    masteryTargets: [
      "nested row/column loops",
      "null/empty-cell checks and boundary cases",
      "helper-method use while scanning or updating a grid",
    ],
    rubricFocus: [
      "row/column dimensions",
      "nested loop bounds",
      "cell-level condition",
      "correct update/return",
    ],
  },
];

export const FRQ_BLUEPRINT_BY_ID = new Map(FRQ_BLUEPRINT.map((b) => [b.id, b]));

export function frqArchetypeLabel(archetype: string): string {
  return FRQ_BLUEPRINT_BY_ID.get(archetype as FrqArchetype)?.label ?? archetype;
}

export function isFrqArchetype(value: string | null | undefined): value is FrqArchetype {
  return FRQ_ARCHETYPE_ORDER.includes(value as FrqArchetype);
}

export function inferFrqArchetypeFromPosition(index: number): FrqArchetype {
  return FRQ_ARCHETYPE_ORDER[Math.max(0, Math.min(index, FRQ_ARCHETYPE_ORDER.length - 1))];
}

