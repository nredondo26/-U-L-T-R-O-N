import * as fs from 'fs';
import * as path from 'path';
import { log } from '../shared/logger';

export interface SkillDefinition {
  name: string;
  description: string;
  triggerPatterns: string[];
  instructions: string;
  tools?: string[];
  filePath: string;
}

export class SkillsLoader {
  private skills: Map<string, SkillDefinition> = new Map();
  private dirs: string[];

  constructor(dirs: string[]) {
    this.dirs = dirs;
  }

  async loadAll(): Promise<number> {
    let count = 0;
    for (const dir of this.dirs) {
      const fullPath = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
      count += this.loadFromDirectory(fullPath);
    }
    log.info(`SkillsLoader: loaded ${count} skills`);
    return count;
  }

  private loadFromDirectory(dir: string): number {
    if (!fs.existsSync(dir)) return 0;

    let count = 0;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const skillDir = path.join(dir, entry.name);
          const skillFile = path.join(skillDir, 'SKILL.md');
          if (fs.existsSync(skillFile)) {
            const skill = this.parseSkillFile(skillFile, entry.name);
            if (skill) {
              this.skills.set(skill.name, skill);
              count++;
            }
          }
        }
      }
    } catch (e) {
      log.warn('Failed to load skills from directory', { dir, error: String(e) });
    }
    return count;
  }

  private parseSkillFile(filePath: string, dirName: string): SkillDefinition | null {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const nameMatch = content.match(/^#\s*(.+)$/m);
      const descMatch = content.match(/^>\s*(.+)$/m);

      const name = nameMatch ? nameMatch[1].trim() : dirName;
      const description = descMatch ? descMatch[1].trim() : '';

      const triggerPatterns: string[] = [];
      const triggerSection = content.match(/##\s*Triggers?\s*\n([\s\S]*?)(?:\n##|$)/i);
      if (triggerSection) {
        const lines = triggerSection[1].split('\n').filter((l) => l.trim().startsWith('-'));
        for (const line of lines) {
          const pattern = line.replace(/^-\s*/, '').trim();
          if (pattern) triggerPatterns.push(pattern);
        }
      }

      const instructions = content;
      return { name, description, triggerPatterns, instructions, filePath };
    } catch {
      return null;
    }
  }

  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  findSkillByInput(input: string): SkillDefinition | undefined {
    const lower = input.toLowerCase();
    for (const skill of this.skills.values()) {
      for (const pattern of skill.triggerPatterns) {
        if (lower.includes(pattern.toLowerCase())) {
          return skill;
        }
      }
    }
    return undefined;
  }

  getAllSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  getSystemPrompt(): string {
    if (this.skills.size === 0) return '';

    const lines: string[] = ['## Available Skills'];
    for (const skill of this.skills.values()) {
      lines.push(`- ${skill.name}: ${skill.description}`);
    }
    return lines.join('\n');
  }

  getSkillInstructions(skillName: string): string | null {
    const skill = this.skills.get(skillName);
    return skill?.instructions || null;
  }
}
