import fs from "node:fs";
import path from "node:path";

export type SkillInfo = {
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
        return {name: folderName, description: "", content: raw.trim()};

    const [, frontmatter, body] = frontmatterMatch as unknown as [string, string, string];
    const fields: Record<string, string> = {};
    for (const line of frontmatter.split(/\r?\n/)) {
        const fieldMatch = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
        if (fieldMatch != null)
            fields[fieldMatch[1]!.toLowerCase()] = fieldMatch[2]!.trim();
    }

    return {
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
