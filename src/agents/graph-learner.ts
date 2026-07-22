// src/agents/graph-learner.ts
// Aprendizaje automatico por grafos: analiza codigo, crea nodos y relaciones en el vault
// Reduce tokens al reutilizar conocimiento ya indexado

import * as fs from 'fs';
import * as path from 'path';
import { ObsidianVault } from '../memory/vault';
import * as fileTools from '../tools/file';
import { log } from '../shared/logger';

interface GraphNode {
  id: string;
  type: 'class' | 'function' | 'file' | 'concept' | 'error' | 'pattern';
  name: string;
  file: string;
  summary: string;
  tags: string[];
}

interface GraphEdge {
  source: string;
  target: string;
  relation: 'imports' | 'calls' | 'extends' | 'contains' | 'related' | 'fixes';
}

export class GraphLearner {
  private vault: ObsidianVault;
  private projectDir: string;

  constructor(vault: ObsidianVault, projectDir: string) {
    this.vault = vault;
    this.projectDir = projectDir;
  }

  async indexFile(filePath: string): Promise<{ nodes: number; edges: number }> {
    try {
      const content = fileTools.readFile(filePath, this.projectDir);
      const ext = path.extname(filePath);

      const nodes = this.extractDefinitions(content, filePath, ext);
      const edges = this.buildEdges(nodes, content);

      for (const node of nodes) {
        const nodeContent = this.buildNodeNote(node);
        this.vault.writeNote(this.slugify(node.id), nodeContent);
      }

      const fileNote = this.buildFileNote(filePath, nodes, content);
      this.vault.writeNote(this.slugify('file_' + filePath), fileNote);

      const edgeContent = this.buildEdgeNotes(edges);
      if (edgeContent) {
        this.vault.writeNote(this.slugify('edges_' + filePath), edgeContent);
      }

      return { nodes: nodes.length, edges: edges.length };
    } catch (e: unknown) {
      log.warn('graph-learner: indexFile error', { error: e instanceof Error ? e.message : String(e), file: filePath });
      return { nodes: 0, edges: 0 };
    }
  }

  async indexProject(): Promise<{ files: number; nodes: number }> {
    const files = fileTools.listFiles('.', this.projectDir, 5)
      .filter(f => /\.(ts|tsx|js|jsx|py|kt|java|rs|go)$/.test(f));

    let totalNodes = 0;
    for (const file of files.slice(0, 200)) {
      const result = await this.indexFile(file);
      totalNodes += result.nodes;
    }

    return { files: files.length, nodes: totalNodes };
  }

  searchGraph(query: string, maxResults = 10): string[] {
    const notes = this.vault.searchNotes(query);
    if (notes.length === 0) return [];

    const visited = new Set<string>();
    const results: string[] = [];

    for (const note of notes.slice(0, maxResults)) {
      if (visited.has(note.name)) continue;
      visited.add(note.name);

      results.push(`- [[${note.name}]]: ${note.excerpt}`);

      for (const link of note.links.slice(0, 10)) {
        const cleanLink = link.split('|')[0].trim();
        if (!visited.has(cleanLink)) {
          visited.add(cleanLink);
          const linked = this.vault.readNote(cleanLink);
          if (linked) {
            results.push(`  → [[${cleanLink}]]: ${linked.excerpt}`.slice(0, 150));
          }
        }
      }
    }

    return results.slice(0, maxResults);
  }

  buildGraphContext(query: string): string {
    const results = this.searchGraph(query);
    if (results.length === 0) {
      const indexNotes = this.vault.searchNotes('file_');
      if (indexNotes.length === 0) {
        return '(grafo vacio — usa /index para analizar el proyecto)';
      }
      return '(sin resultados en el grafo para esta consulta)';
    }
    return `Grafo de conocimiento (${results.length} nodos):\n${results.join('\n')}`;
  }

  // ---- PARSING ----

  private extractDefinitions(content: string, filePath: string, ext: string): GraphNode[] {
    const nodes: GraphNode[] = [];
    const lines = content.split('\n');
    const fileName = path.basename(filePath);

    nodes.push({
      id: `file_${filePath}`,
      type: 'file',
      name: fileName,
      file: filePath,
      summary: `${fileName} (${lines.length} lineas)`,
      tags: ['file', ext.replace('.', '')],
    });

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (/\.(ts|tsx|js|jsx)$/.test(ext)) {
        const classMatch = line.match(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
        if (classMatch) {
          nodes.push({ id: `class_${classMatch[1]}`, type: 'class', name: classMatch[1], file: filePath, summary: `class ${classMatch[1]} (linea ${i + 1})`, tags: ['class'] });
        }

        const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
        if (funcMatch) {
          nodes.push({ id: `func_${funcMatch[1]}`, type: 'function', name: funcMatch[1], file: filePath, summary: `function ${funcMatch[1]} (linea ${i + 1})`, tags: ['function'] });
        }

        const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
        if (arrowMatch) {
          nodes.push({ id: `func_${arrowMatch[1]}`, type: 'function', name: arrowMatch[1], file: filePath, summary: `arrow function ${arrowMatch[1]} (linea ${i + 1})`, tags: ['function', 'arrow'] });
        }

        const interfaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
        if (interfaceMatch) {
          nodes.push({ id: `interface_${interfaceMatch[1]}`, type: 'class', name: interfaceMatch[1], file: filePath, summary: `interface ${interfaceMatch[1]} (linea ${i + 1})`, tags: ['interface'] });
        }
      }

      if (ext === '.py') {
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch) {
          nodes.push({ id: `class_${classMatch[1]}`, type: 'class', name: classMatch[1], file: filePath, summary: `class ${classMatch[1]} (linea ${i + 1})`, tags: ['class', 'python'] });
        }
        const funcMatch = line.match(/def\s+(\w+)/);
        if (funcMatch) {
          nodes.push({ id: `func_${funcMatch[1]}`, type: 'function', name: funcMatch[1], file: filePath, summary: `def ${funcMatch[1]} (linea ${i + 1})`, tags: ['function', 'python'] });
        }
      }

      if (ext === '.kt') {
        const classMatch = line.match(/(?:data\s+)?class\s+(\w+)/);
        if (classMatch) {
          nodes.push({ id: `class_${classMatch[1]}`, type: 'class', name: classMatch[1], file: filePath, summary: `class ${classMatch[1]} (linea ${i + 1})`, tags: ['class', 'kotlin'] });
        }
        const funcMatch = line.match(/(?:suspend\s+)?fun\s+(\w+)/);
        if (funcMatch) {
          nodes.push({ id: `func_${funcMatch[1]}`, type: 'function', name: funcMatch[1], file: filePath, summary: `fun ${funcMatch[1]} (linea ${i + 1})`, tags: ['function', 'kotlin'] });
        }
        const ifaceMatch = line.match(/interface\s+(\w+)/);
        if (ifaceMatch) {
          nodes.push({ id: `interface_${ifaceMatch[1]}`, type: 'class', name: ifaceMatch[1], file: filePath, summary: `interface ${ifaceMatch[1]} (linea ${i + 1})`, tags: ['interface', 'kotlin'] });
        }
      }
    }

    return nodes;
  }

  private buildEdges(nodes: GraphNode[], content: string): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const fileNode = nodes.find(n => n.type === 'file');
    const fileId = fileNode?.id || '';

    if (fileNode) {
      for (const node of nodes) {
        if (node.type !== 'file') {
          edges.push({ source: fileNode.id, target: node.id, relation: 'contains' });
        }
      }
    }

    const importLines = content.match(/import\s+.*?from\s+['"](.+?)['"]/g);
    if (importLines) {
      for (const imp of importLines) {
        const fromMatch = imp.match(/from\s+['"](.+?)['"]/);
        if (fromMatch) {
          edges.push({ source: fileId, target: `file_${fromMatch[1]}`, relation: 'imports' });
        }
      }
    }

    return edges;
  }

  private buildEdgeNotes(edges: GraphEdge[]): string {
    if (edges.length === 0) return '';
    const links: string[] = [];
    for (const e of edges) {
      const sourceSlug = this.slugify(e.source);
      const targetSlug = this.slugify(e.target);
      links.push(`- [[${sourceSlug}]] → [[${targetSlug}]] (${e.relation})`);
    }
    return [
      '---',
      'tipo: edges',
      `total: ${edges.length}`,
      '---',
      '',
      '# Relaciones',
      ...links,
    ].join('\n');
  }

  private buildNodeNote(node: GraphNode): string {
    return [
      '---',
      `tipo: ${node.type}`,
      `archivo: ${node.file}`,
      `tags: [${node.tags.join(', ')}]`,
      '---',
      '',
      `# ${node.name}`,
      '',
      `${node.summary}`,
      '',
      `Archivo: [[${this.slugify('file_' + node.file)}]]`,
    ].join('\n');
  }

  private buildFileNote(filePath: string, nodes: GraphNode[], _content: string): string {
    const fileName = path.basename(filePath);
    const fileNodes = nodes.filter(n => n.type !== 'file');

    return [
      '---',
      'tipo: file',
      `ruta: ${filePath}`,
      '---',
      '',
      `# ${fileName}`,
      '',
      `Ruta: \`${filePath}\``,
      '',
      '## Contenido',
      ...fileNodes.map(n => `- [[${this.slugify(n.id)}]] — ${n.summary}`),
    ].join('\n');
  }

  private slugify(text: string): string {
    return text.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_').slice(0, 80);
  }
}
