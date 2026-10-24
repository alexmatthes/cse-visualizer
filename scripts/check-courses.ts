import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("src/data/courses.json", "utf-8"));

type PrereqNode = string | { all?: PrereqNode[]; any?: PrereqNode[] };

interface Course {
    id: string;
    title: string;
    credits: string;
    prereqs?: PrereqNode;
}

interface CourseDataset {
    external?: string[];
    courses: Course[];
}

/**
 * Recursively extract all prerequisite course IDs from nested 'all' / 'any' structures.
 */
function extractPrereqIds(node: PrereqNode | undefined): string[] {
    const ids: string[] = [];
    if (!node) return ids;

    if (typeof node === 'string') {
        ids.push(node);
    } else {
        if (node.all) {
            for (const item of node.all) {
                ids.push(...extractPrereqIds(item));
            }
        }
        if (node.any) {
            for (const item of node.any) {
                ids.push(...extractPrereqIds(item));
            }
        }
    }
    return ids;
}

function validateCourses(dataset: CourseDataset) {
    const courses = dataset.courses || [];
    const externalIds = dataset.external || [];

    const definedIds = new Set<string>();
    const graph = new Map<string, string[]>();

    // 1. Collect every course ID from both 'courses' and 'external'
    for (const course of courses) {
        definedIds.add(course.id);
    }
    for (const extId of externalIds) {
        definedIds.add(extId);
    }

    const missingPrereqs = new Map<string, string[]>();

    // 2. Walk each course's prerequisite tree and check existence
    for (const course of courses) {
        const prereqList = extractPrereqIds(course.prereqs);
        graph.set(course.id, prereqList);

        const missing = prereqList.filter(id => !definedIds.has(id));
        if (missing.length > 0) {
            missingPrereqs.set(course.id, missing);
        }
    }

    // === Report 1: Missing Prerequisites ===
    console.log("=== 1. Missing Prerequisite Check ===");
    if (missingPrereqs.size > 0) {
        for (const [courseId, missing] of missingPrereqs.entries()) {
            console.log(`   * ${courseId} references non-existent IDs: ${[...new Set(missing)].join(', ')}`);
        }
        console.log("\n");
    } else {
        console.log("   [V] All referenced prerequisite IDs exist in the dataset (courses or external).\n");
    }

    // === Report 2: Cycle Detection (DFS) ===
    console.log("=== 2. Circular Dependency (Loop) Check ===");
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    function dfs(node: string, path: string[]) {
        visited.add(node);
        recStack.add(node);
        path.push(node);

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

        path.pop();
        recStack.delete(node);
        return false;
    }

    // Only run cycle detection on actual full courses defined in the JSON
    for (const course of courses) {
        if (!visited.has(course.id)) {
            dfs(course.id, []);
        }
    }

    if (cycles.length > 0) {
        console.log("   [!] ERROR: Circular dependency loops detected!");
        for (const cycle of cycles) {
            console.log(`   * Loop path: ${cycle.join(' -> ')}`);
        }
    } else {
        console.log("   [V] Success: No circular dependency loops found.");
    }
}

validateCourses(data);
