import fs from "node:fs";
import path from "node:path";

export type SkillInfo = {
    /** The Skill's directory name under the Skills directory - stable identity, independent of the display `name`. */
    folderName: string,
    name: string,
    description: string,
    content: string
};

function parseSkillFile(filePath: string, folderName: string): SkillInfo | undefined {
    let raw: string;
    try {
        raw = fs.readFileSync(filePath, "utf-8");
    } catch {
        return undefined;
    }

    const frontmatterMatch = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
    if (frontmatterMatch == null)
        return {folderName, name: folderName, description: "", content: raw.trim()};

    const [, frontmatter, body] = frontmatterMatch as unknown as [string, string, string];
    const fields: Record<string, string> = {};
    for (const line of frontmatter.split(/\r?\n/)) {
        const fieldMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
        if (fieldMatch != null)
            fields[fieldMatch[1]!.toLowerCase()] = fieldMatch[2]!.trim();
    }

    return {
        folderName,
        name: fields["name"] || folderName,
        description: fields["description"] ?? "",
        content: body.trim()
    };
}

/** Scans `directory` for Skill folders (each containing a SKILL.md), returning one entry per valid skill. */
export function loadSkills(directory: string): SkillInfo[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(directory, {withFileTypes: true});
    } catch {
        return [];
    }

    const skills: SkillInfo[] = [];
    for (const entry of entries) {
        if (!entry.isDirectory())
            continue;

        const skillFilePath = path.join(directory, entry.name, "SKILL.md");
        if (!fs.existsSync(skillFilePath))
            continue;

        const skill = parseSkillFile(skillFilePath, entry.name);
        if (skill != null)
            skills.push(skill);
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function slugify(name: string): string {
    const slug = name.toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
    return slug === "" ? "skill" : slug;
}

function skillFileContent(skill: {name: string, description: string, content: string}): string {
    return `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n${skill.content}\n`;
}

/**
 * Resolves `folderName` to a path under `directory`, rejecting anything that would escape it
 * (e.g. `../../etc`) - `folderName` comes from the renderer over RPC and must not be trusted as
 * a safe path segment, since a compromised renderer (e.g. via XSS in rendered markdown/tool output)
 * could otherwise use `updateSkillFile`/`deleteSkillFile` to write or delete arbitrary files.
 */
function resolveSkillDir(directory: string, folderName: string): string {
    if (folderName === "" || folderName === "." || folderName === ".." || folderName.includes("/") || folderName.includes("\\"))
        throw new Error("不正なSkillフォルダ名です");

    const baseReal = fs.realpathSync(directory);
    const candidate = path.resolve(baseReal, folderName);
    const rel = path.relative(baseReal, candidate);
    if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel))
        throw new Error("不正なSkillフォルダ名です");

    return candidate;
}

/** Creates a new Skill folder under `directory`, auto-suffixing the folder name (`-2`, `-3`, ...) on collision. */
export function createSkillFile(directory: string, skill: {name: string, description: string, content: string}): void {
    const baseSlug = slugify(skill.name);
    let folderName = baseSlug;
    let suffix = 2;
    while (fs.existsSync(path.join(directory, folderName)))
        folderName = `${baseSlug}-${suffix++}`;

    const skillDir = path.join(directory, folderName);
    fs.mkdirSync(skillDir, {recursive: true});
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillFileContent(skill));
}

/** Overwrites an existing Skill's SKILL.md in place; the folder (its stable identity) is never renamed. */
export function updateSkillFile(
    directory: string, folderName: string, skill: {name: string, description: string, content: string}
): void {
    const skillDir = resolveSkillDir(directory, folderName);
    const skillFilePath = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillFilePath))
        throw new Error(`Skill "${folderName}" が見つかりません`);

    fs.writeFileSync(skillFilePath, skillFileContent(skill));
}

export function deleteSkillFile(directory: string, folderName: string): void {
    const skillDir = resolveSkillDir(directory, folderName);
    if (!fs.existsSync(skillDir))
        throw new Error(`Skill "${folderName}" が見つかりません`);

    fs.rmSync(skillDir, {recursive: true, force: true});
}
