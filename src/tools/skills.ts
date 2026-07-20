// src/tools/skills.ts
// Skill system: carga SKILL.md para tareas especializadas

import * as fs from 'fs';
import * as path from 'path';

interface Skill {
  name: string;
  description: string;
  content: string;
  triggers: string[];
}

let loadedSkills: Skill[] = [];

export function loadSkills(dir?: string): Skill[] {
  loadedSkills = [];
  const skillsDir = dir || path.join(process.cwd(), '.jarvis', 'skills');
  const userSkillsDir = path.join(process.env.USERPROFILE || '~', '.jarvis', 'skills');

  for (const d of [skillsDir, userSkillsDir]) {
    try {
      if (!fs.existsSync(d)) continue;
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillPath = path.join(d, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillPath)) continue;
        const content = fs.readFileSync(skillPath, 'utf8');
        const skill = parseSkill(entry.name, content);
        loadedSkills.push(skill);
      }
    } catch {}
  }

  return loadedSkills;
}

function parseSkill(name: string, content: string): Skill {
  const firstLine = content.split('\n')[0] || name;
  const triggers: string[] = [];
  const triggerMatch = content.match(/triggers:\s*\[(.*?)\]/i);
  if (triggerMatch) {
    triggers.push(...triggerMatch[1].split(',').map(t => t.trim().replace(/['"]/g, '')));
  }

  return {
    name,
    description: firstLine.replace(/^#\s*/, '').trim(),
    content: content.slice(0, 5000),
    triggers,
  };
}

export function getRelevantSkills(userMessage: string): Skill[] {
  const lower = userMessage.toLowerCase();
  return loadedSkills.filter(s =>
    s.triggers.some(t => lower.includes(t.toLowerCase())) ||
    lower.includes(s.name.toLowerCase()),
  );
}

export function buildSkillsContext(userMessage: string): string {
  const relevant = getRelevantSkills(userMessage);
  if (relevant.length === 0) return '';
  return relevant.map(s =>
    `=== SKILL: ${s.name} ===\n${s.content}`
  ).join('\n\n');
}

export function getAllSkills(): Skill[] {
  return loadedSkills;
}
