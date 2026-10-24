import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("src/data/courses.json", "utf-8"));

type PrereqNode = string | { all?: PrereqNode[]; any?: PrereqNode[] };

interface Course {
    id: string;
    title: string;
    credits: number;
    prereqs?: PrereqNode;
}

interface Group {
    id: string;
    name: string;
    rule: "all" | "pick" | "credits";
    count?: number;
    credits?: number;
    courses: string[];
}

interface CourseDataset {
    external?: string[];
    courses: Course[];
    groups?: Group[];
}

/**
 * Recursively extract and validate all prerequisite course IDs from nested structures,
 * checking for malformed nodes.
 */
function extractPrereqIds(node: PrereqNode | undefined, errors: string[], context: string): string[] {
    const ids: string[] = [];
    if (!node) return ids;

    if (typeof node === 'string') {
        ids.push(node);
    } else if (typeof node === 'object' && node !== null) {
        const keys = Object.keys(node);
        for (const key of keys) {
            if (key !== 'all' && key !== 'any') {
                errors.push(`[Malformed Node] Course ${context} has invalid prerequisite key: "${key}" (expected "all" or "any")`);
            }
        }
        if (node.all) {
            for (const item of node.all) {
                ids.push(...extractPrereqIds(item, errors, context));
            }
        }
        if (node.any) {
            for (const item of node.any) {
                ids.push(...extractPrereqIds(item, errors, context));
            }
        }
    } else {
        errors.push(`[Malformed Node] Course ${context} has invalid prerequisite node type.`);
    }
    return ids;
}

function validateCourses(dataset: CourseDataset) {
    const courses = dataset.courses || [];
    const externalIds = dataset.external || [];
    const groups = dataset.groups || [];

    let hasError = false;
    const definedIds = new Set<string>();
    const graph = new Map<string, string[]>();
    const nodeErrors: string[] = [];

    // === Duplicate Course IDs Check ===
    const seenCourseIds = new Set<string>();
    for (const course of courses) {
        if (seenCourseIds.has(course.id)) {
            console.log(`[!] ERROR: Duplicate course ID found in 'courses': ${course.id}`);
            hasError = true;
        }
        seenCourseIds.add(course.id);
        definedIds.add(course.id);
    }

    // === ID in both lists check ===
    const externalSet = new Set<string>();
    for (const extId of externalIds) {
        if (definedIds.has(extId)) {
            console.log(`[!] ERROR: ID '${extId}' is defined in both 'courses' and 'external'!`);
            hasError = true;
        }
        if (externalSet.has(extId)) {
            console.log(`[!] ERROR: Duplicate entry in 'external' list: ${extId}`);
            hasError = true;
        }
        externalSet.add(extId);
        definedIds.add(extId);
    }

    const missingPrereqs = new Map<string, string[]>();

    // Walk each course's prerequisite tree
    for (const course of courses) {
        const prereqList = extractPrereqIds(course.prereqs, nodeErrors, course.id);
        graph.set(course.id, prereqList);

        const missing = prereqList.filter(id => !definedIds.has(id));
        if (missing.length > 0) {
            missingPrereqs.set(course.id, missing);
        }
    }

    // === Report 0: Malformed Node Errors ===
    console.log("=== 0. Malformed Prerequisite Node Check ===");
    if (nodeErrors.length > 0) {
        hasError = true;
        for (const err of nodeErrors) {
            console.log(`   * ${err}`);
        }
        console.log("\n");
    } else {
        console.log("   [V] All prerequisite nodes are correctly formed.\n");
    }

    // === Report 1: Missing Prerequisites ===
    console.log("=== 1. Missing Prerequisite Check ===");
    if (missingPrereqs.size > 0) {
        hasError = true;
        for (const [courseId, missing] of missingPrereqs.entries()) {
            console.log(`   * ${courseId} references non-existent IDs: ${[...new Set(missing)].join(', ')}`);
        }
        console.log("\n");
    } else {
        console.log("   [V] All referenced prerequisite IDs exist in the dataset.\n");
    }

    // === Report 2: Group Course Validation & Rule Runtime Checks ===
    console.log("=== 2. Group Course & Rule Validation Check ===");
    const missingGroupCourses = new Map<string, string[]>();
    const groupRuleErrors: string[] = [];

    for (const group of groups) {
        // Runtime checks for pick and credits rules
        if (group.rule === "pick" && typeof group.count !== "number") {
            groupRuleErrors.push(`Group '${group.id}' has rule 'pick' but is missing a valid numeric 'count'.`);
        }
        if (group.rule === "credits" && typeof group.credits !== "number") {
            groupRuleErrors.push(`Group '${group.id}' has rule 'credits' but is missing a valid numeric 'credits' value.`);
        }

        const missingInGroup: string[] = [];
        for (const entry of group.courses || []) {
            if (typeof entry !== "string") {
                continue;
            }

            const parts = entry.split("+").map(p => p.trim());

            for (const part of parts) {
                if (!definedIds.has(part)) {
                    missingInGroup.push(part);
                }
            }
        }
        if (missingInGroup.length > 0) {
            missingGroupCourses.set(group.id, missingInGroup);
        }
    }

    if (groupRuleErrors.length > 0 || missingGroupCourses.size > 0) {
        hasError = true;
        for (const err of groupRuleErrors) {
            console.log(`   * [Rule Error] ${err}`);
        }
        for (const [groupId, missing] of missingGroupCourses.entries()) {
            console.log(`   * Group '${groupId}' references unknown IDs: ${[...new Set(missing)].join(', ')}`);
        }
        console.log("\n");
    } else {
        console.log("   [V] All group rules and referenced group courses are valid.\n");
    }

    // === Report 3: Cycle Detection ===
    console.log("=== 3. Circular Dependency (Loop) Check ===");
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    function dfs(node: string, path: string[]): boolean {
        visited.add(node);
        recStack.add(node);
        path.push(node);

        try {
            const neighbors = graph.get(node) || [];
            for (const neighbor of neighbors) {
                if (!definedIds.has(neighbor)) continue;

                if (!visited.has(neighbor)) {
                    if (dfs(neighbor, path)) return true;
                } else if (recStack.has(neighbor)) {
                    const cycleStartIndex = path.indexOf(neighbor);
                    const cyclePath = [...path.slice(cycleStartIndex), neighbor];
                    cycles.push(cyclePath);
                    return true;
                }
            }
        } finally {
            path.pop();
            recStack.delete(node);
        }
        return false;
    }

    for (const course of courses) {
        if (!visited.has(course.id)) {
            dfs(course.id, []);
        }
    }

    if (cycles.length > 0) {
        hasError = true;
        console.log("   [!] ERROR: Circular dependency loops detected!");
        for (const cycle of cycles) {
            console.log(`   * Loop path: ${cycle.join(' -> ')}`);
        }
    } else {
        console.log("   [V] Success: No circular dependency loops found.\n");
    }

    // === Exit Code Configuration ===
    if (hasError) {
        process.exitCode = 1;
        console.log("Validation failed with errors.");
    } else {
        console.log("All validation checks passed successfully!");
    }
}

validateCourses(data);
