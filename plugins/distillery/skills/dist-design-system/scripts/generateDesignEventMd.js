#!/usr/bin/env node
/**
 * generateDesignEventMd.js
 *
 * design-event.yaml をデザインシステム設計書 Markdown に変換する。
 *
 * Usage:
 *   node generateDesignEventMd.js <input-yaml> [output-md]
 *
 *   input-yaml : design-event.yaml のパス
 *   output-md  : 出力先 .md のパス（省略時は入力と同じディレクトリに design-event.md を生成）
 *
 * npm 依存なし。Node.js 18+ 標準モジュールのみ使用。
 */

const fs = require('fs');
const path = require('path');

// ============================================================
// 簡易 YAML パーサー（外部依存なし）
// ============================================================

function parseYaml(text) {
  const lines = text.split('\n');
  return parseNode(lines, 0, -1).value;
}

function parseNode(lines, startIdx, parentIndent) {
  let i = startIdx;
  const result = {};

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');

    if (trimmed === '' || trimmed.trimStart().startsWith('#')) { i++; continue; }

    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;

    const content = trimmed.trimStart();

    if (content.startsWith('- ')) {
      break;
    }

    if (content.includes(':')) {
      const colonIdx = content.indexOf(':');
      const key = content.slice(0, colonIdx).trim();
      const rawValue = content.slice(colonIdx + 1).trim();

      if (rawValue === '' || rawValue === '>' || rawValue === '|') {
        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length) {
          const nextIndent = lines[nextLineIdx].search(/\S/);
          if (nextIndent > indent) {
            const nextContent = lines[nextLineIdx].trimStart();
            if (nextContent.startsWith('- ')) {
              const arr = parseArray(lines, nextLineIdx, indent);
              result[key] = arr.value;
              i = arr.nextIdx;
              continue;
            } else if (rawValue === '>' || rawValue === '|') {
              const scalar = parseFoldedScalar(lines, i + 1, indent);
              result[key] = scalar.value;
              i = scalar.nextIdx;
              continue;
            } else {
              const child = parseNode(lines, i + 1, indent);
              result[key] = child.value;
              i = child.nextIdx;
              continue;
            }
          }
        }
        result[key] = null;
        i++;
        continue;
      }

      result[key] = parseValue(rawValue);
      i++;
      continue;
    }

    i++;
  }

  return { value: result, nextIdx: i };
}

function parseArray(lines, startIdx, parentIndent) {
  let i = startIdx;
  const arr = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');
    if (trimmed === '' || trimmed.trimStart().startsWith('#')) { i++; continue; }

    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;

    const content = trimmed.trimStart();
    if (!content.startsWith('- ')) break;

    const itemContent = content.slice(2).trim();
    const itemIndent = indent;

    if (itemContent.includes(':') && !isQuotedString(itemContent)) {
      const obj = {};
      const colonIdx = itemContent.indexOf(':');
      const k = itemContent.slice(0, colonIdx).trim();
      const v = itemContent.slice(colonIdx + 1).trim();

      if (v === '' || v === '>' || v === '|') {
        const nextLineIdx = findNextNonEmpty(lines, i + 1);
        if (nextLineIdx < lines.length) {
          const nextIndent = lines[nextLineIdx].search(/\S/);
          if (nextIndent > itemIndent) {
            const nextContent = lines[nextLineIdx].trimStart();
            if (nextContent.startsWith('- ')) {
              const sub = parseArray(lines, nextLineIdx, itemIndent);
              obj[k] = sub.value;
              const child = parseNode(lines, sub.nextIdx, itemIndent);
              Object.assign(obj, child.value);
            } else {
              const child = parseNode(lines, i + 1, itemIndent);
              obj[k] = child.value[k] || null;
              delete child.value[k];
              Object.assign(obj, child.value);
            }
            arr.push(obj);
            i = findNextAtOrAbove(lines, i + 1, itemIndent);
            continue;
          }
        }
        obj[k] = null;
      } else {
        obj[k] = parseValue(v);
      }

      const nextLineIdx2 = findNextNonEmpty(lines, i + 1);
      if (nextLineIdx2 < lines.length) {
        const nextIndent2 = lines[nextLineIdx2].search(/\S/);
        const nextContent2 = lines[nextLineIdx2].trimStart();
        if (nextIndent2 > itemIndent && !nextContent2.startsWith('- ')) {
          const child = parseNode(lines, i + 1, itemIndent);
          Object.assign(obj, child.value);
          arr.push(obj);
          i = child.nextIdx;
          continue;
        }
      }

      arr.push(obj);
      i++;
      continue;
    }

    arr.push(parseValue(itemContent));
    i++;
  }

  return { value: arr, nextIdx: i };
}

function parseFoldedScalar(lines, startIdx, parentIndent) {
  let i = startIdx;
  const parts = [];

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.replace(/\s+$/, '');
    if (trimmed === '') { parts.push(''); i++; continue; }
    const indent = line.search(/\S/);
    if (indent <= parentIndent) break;
    parts.push(trimmed.trim());
    i++;
  }

  return { value: parts.join('\n').trim(), nextIdx: i };
}

function parseValue(str) {
  if (str === '' || str === 'null' || str === '~') return null;
  if (str === '[]') return [];
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (/^-?[0-9]+$/.test(str)) return parseInt(str, 10);
  if (/^-?[0-9]*\.[0-9]+$/.test(str)) return parseFloat(str);
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

function isQuotedString(s) {
  return (s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"));
}

function findNextNonEmpty(lines, startIdx) {
  let i = startIdx;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t !== '' && !t.startsWith('#')) return i;
    i++;
  }
  return i;
}

function findNextAtOrAbove(lines, startIdx, maxIndent) {
  let i = startIdx;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '' || t.startsWith('#')) { i++; continue; }
    const indent = lines[i].search(/\S/);
    if (indent <= maxIndent) return i;
    i++;
  }
  return i;
}

// ============================================================
// Markdown 生成ヘルパー
// ============================================================

function esc(text) {
  if (text === null || text === undefined) return '-';
  return String(text).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
}

function renderObjectKeys(obj, indent) {
  if (!obj || typeof obj !== 'object') return [];
  const lines = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${indent}- **${key}**:`);
      lines.push(...renderObjectKeys(value, indent + '  '));
    } else {
      lines.push(`${indent}- **${key}**: ${esc(value)}`);
    }
  }
  return lines;
}

// ============================================================
// Markdown 生成
// ============================================================

function generateMarkdown(data) {
  const lines = [];
  const brand = data.brand || {};
  const portals = data.portals || [];
  const tokens = data.tokens || {};
  const components = data.components || {};
  const screens = data.screens || [];
  const states = data.states || [];
  const nfrDecisions = data.nfr_decisions || [];
  const uiComponents = components.ui || [];
  const domainComponents = components.domain || [];

  const portalCount = portals.length;
  const componentCount = uiComponents.length + domainComponents.length;
  const screenCount = screens.length;

  // ヘッダー
  lines.push(`# Design System: ${esc(brand.name || 'Unnamed')}`);
  lines.push('');

  // ================================================================
  // Overview
  // ================================================================
  lines.push('## Overview');
  lines.push('');
  lines.push('| 項目 | 内容 |');
  lines.push('|------|------|');
  lines.push(`| Event ID | ${esc(data.event_id)} |`);
  lines.push(`| Created At | ${esc(data.created_at)} |`);
  lines.push(`| Source | ${esc(data.source)} |`);
  lines.push(`| Portals | ${portalCount} |`);
  lines.push(`| Components | ${componentCount} |`);
  lines.push(`| Screens | ${screenCount} |`);
  lines.push('');

  // ================================================================
  // Brand
  // ================================================================
  lines.push('## Brand');
  lines.push('');
  lines.push(`- **Name**: ${esc(brand.name)}`);

  // Colors
  const colors = brand.colors || {};
  if (colors.primary) {
    lines.push(`- **Primary Color**: ${esc(colors.primary.name || '')} (${esc(colors.primary.hex)})`);
  }
  if (colors.secondary) {
    lines.push(`- **Secondary Color**: ${esc(colors.secondary.name || '')} (${esc(colors.secondary.hex)})`);
  }

  // Typography
  const typography = brand.typography || {};
  if (typography.sans) lines.push(`- **Sans Font**: ${esc(typography.sans)}`);
  if (typography.mono) lines.push(`- **Mono Font**: ${esc(typography.mono)}`);
  if (typography.scale) {
    const scaleKeys = Object.keys(typography.scale);
    if (scaleKeys.length > 0) {
      lines.push(`- **Type Scale**: ${scaleKeys.join(', ')}`);
    }
  }

  // Voice
  const voice = brand.voice || {};
  if (voice.tone) lines.push(`- **Tone**: ${esc(voice.tone)}`);
  if (voice.principles && voice.principles.length > 0) {
    lines.push(`- **Principles**: ${voice.principles.join(', ')}`);
  }

  // Logo variants
  const logo = brand.logo || {};
  const variants = logo.variants || [];
  if (variants.length > 0) {
    lines.push('- **Logo Variants**:');
    for (const v of variants) {
      lines.push(`  - ${esc(v.name)}: \`${esc(v.path)}\``);
    }
  }

  lines.push('');

  // ================================================================
  // Portals
  // ================================================================
  lines.push('## Portals');
  lines.push('');
  lines.push('| ID | Name | Actor | Primary Color | Screen Count |');
  lines.push('|-----|------|-------|:-------------:|:------------:|');
  for (const portal of portals) {
    const sc = portal.screen_count !== null && portal.screen_count !== undefined ? portal.screen_count : '-';
    lines.push(`| ${esc(portal.id)} | ${esc(portal.name)} | ${esc(portal.actor)} | ${esc(portal.primary_color)} | ${sc} |`);
  }
  lines.push('');

  // ================================================================
  // Design Tokens
  // ================================================================
  lines.push('## Design Tokens');
  lines.push('');

  // Primitive
  lines.push('### Primitive');
  lines.push('');
  const primitive = tokens.primitive || {};
  const colorScales = primitive.colors || {};
  const colorScaleNames = Object.keys(colorScales);
  if (colorScaleNames.length > 0) {
    lines.push(`- **Color Scales**: ${colorScaleNames.join(', ')} (${colorScaleNames.length} scales)`);
  }
  const spacing = primitive.spacing || {};
  const spacingKeys = Object.keys(spacing);
  if (spacingKeys.length > 0) {
    lines.push(`- **Spacing Scale**: ${spacingKeys.map(k => `${k}: ${spacing[k]}`).join(', ')}`);
  }
  if (primitive.radius) {
    const radiusKeys = Object.keys(primitive.radius);
    if (radiusKeys.length > 0) {
      lines.push(`- **Radius**: ${radiusKeys.join(', ')}`);
    }
  }
  if (primitive.shadow) {
    const shadowKeys = Object.keys(primitive.shadow);
    if (shadowKeys.length > 0) {
      lines.push(`- **Shadow**: ${shadowKeys.join(', ')}`);
    }
  }
  if (primitive.font_size) {
    const fontSizeKeys = Object.keys(primitive.font_size);
    if (fontSizeKeys.length > 0) {
      lines.push(`- **Font Size**: ${fontSizeKeys.join(', ')}`);
    }
  }
  if (primitive.duration) {
    const durationKeys = Object.keys(primitive.duration);
    if (durationKeys.length > 0) {
      lines.push(`- **Duration**: ${durationKeys.join(', ')}`);
    }
  }
  lines.push('');

  // Semantic
  lines.push('### Semantic');
  lines.push('');
  const semantic = tokens.semantic || {};
  for (const [key, value] of Object.entries(semantic)) {
    lines.push(`- **${key}**: ${esc(value)}`);
  }
  lines.push('');

  // Component tokens
  lines.push('### Component');
  lines.push('');
  const componentTokens = tokens.component || {};
  const componentTokenGroups = Object.keys(componentTokens);
  if (componentTokenGroups.length > 0) {
    for (const group of componentTokenGroups) {
      lines.push(`- **${group}**: ${typeof componentTokens[group] === 'object' ? Object.keys(componentTokens[group]).join(', ') : esc(componentTokens[group])}`);
    }
  } else {
    lines.push('- (none)');
  }
  lines.push('');

  // Dark Mode Overrides
  lines.push('### Dark Mode Overrides');
  lines.push('');
  const darkOverrides = tokens.dark_overrides || {};
  if (Object.keys(darkOverrides).length === 0) {
    lines.push('- (none defined)');
  } else {
    const darkSemantic = darkOverrides.semantic || {};
    if (Object.keys(darkSemantic).length > 0) {
      lines.push('**Semantic overrides:**');
      lines.push('');
      for (const [key, value] of Object.entries(darkSemantic)) {
        lines.push(`- **${key}**: ${esc(value)}`);
      }
    }
    const darkComponent = darkOverrides.component || {};
    if (Object.keys(darkComponent).length > 0) {
      lines.push('');
      lines.push('**Component overrides:**');
      lines.push('');
      for (const group of Object.keys(darkComponent)) {
        lines.push(`- **${group}**: ${typeof darkComponent[group] === 'object' ? Object.keys(darkComponent[group]).join(', ') : esc(darkComponent[group])}`);
      }
    }
  }
  lines.push('');

  // ================================================================
  // Components
  // ================================================================
  lines.push('## Components');
  lines.push('');

  // UI Components
  lines.push('### UI Components');
  lines.push('');
  lines.push('| Name | Variants | Sizes |');
  lines.push('|------|----------|-------|');
  for (const comp of uiComponents) {
    const v = (comp.variants || []).join(', ') || '-';
    const s = (comp.sizes || []).join(', ') || '-';
    lines.push(`| ${esc(comp.name)} | ${v} | ${s} |`);
  }
  lines.push('');

  // Domain Components
  lines.push('### Domain Components');
  lines.push('');
  lines.push('| Name | Description | Screens |');
  lines.push('|------|-------------|---------|');
  for (const comp of domainComponents) {
    const s = (comp.screens || []).join(', ') || '-';
    lines.push(`| ${esc(comp.name)} | ${esc(comp.description)} | ${s} |`);
  }
  lines.push('');

  // ================================================================
  // Screen Mapping
  // ================================================================
  lines.push('## Screen Mapping');
  lines.push('');

  // Group screens by portal
  const screensByPortal = {};
  for (const screen of screens) {
    const portalId = screen.portal || 'unknown';
    if (!screensByPortal[portalId]) screensByPortal[portalId] = [];
    screensByPortal[portalId].push(screen);
  }

  for (const [portalId, portalScreens] of Object.entries(screensByPortal)) {
    const portal = portals.find(p => p.id === portalId);
    const portalName = portal ? portal.name : portalId;
    lines.push(`### ${esc(portalName)} (${esc(portalId)})`);
    lines.push('');
    lines.push('| Name | Route | Components |');
    lines.push('|------|-------|------------|');
    for (const screen of portalScreens) {
      const comps = (screen.components || []).join(', ') || '-';
      lines.push(`| ${esc(screen.name)} | ${esc(screen.route)} | ${comps} |`);
    }
    lines.push('');
  }

  // ================================================================
  // State Mapping
  // ================================================================
  lines.push('## State Mapping');
  lines.push('');

  for (const stateModel of states) {
    lines.push(`### ${esc(stateModel.model)}`);
    lines.push('');
    lines.push('| State | Label | Color | Actions |');
    lines.push('|-------|-------|:-----:|---------|');
    for (const entry of (stateModel.entries || [])) {
      let actionsStr = '-';
      if (entry.actions && typeof entry.actions === 'object') {
        const actionPairs = Object.entries(entry.actions).map(([k, v]) => `${k}: ${v}`);
        actionsStr = actionPairs.join(', ') || '-';
      }
      lines.push(`| ${esc(entry.state)} | ${esc(entry.label)} | ${esc(entry.color)} | ${actionsStr} |`);
    }
    lines.push('');
  }

  // ================================================================
  // NFR Design Decisions
  // ================================================================
  lines.push('## NFR Design Decisions');
  lines.push('');

  if (nfrDecisions.length === 0) {
    lines.push('- (none defined)');
  } else {
    lines.push('| NFR | Decision |');
    lines.push('|-----|----------|');
    for (const d of nfrDecisions) {
      lines.push(`| ${esc(d.nfr)} | ${esc(d.decision)} |`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

// ============================================================
// Main
// ============================================================

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node generateDesignEventMd.js <input-yaml> [output-md]');
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: File not found: ${resolvedInput}`);
    process.exit(1);
  }

  const outputPath = process.argv[3]
    ? path.resolve(process.argv[3])
    : path.join(path.dirname(resolvedInput), 'design-event.md');

  const yamlText = fs.readFileSync(resolvedInput, 'utf-8');
  const data = parseYaml(yamlText);

  const markdown = generateMarkdown(data);
  fs.writeFileSync(outputPath, markdown, 'utf-8');

  const portals = data.portals || [];
  const components = data.components || {};
  const screens = data.screens || [];
  const states = data.states || [];
  const uiCount = (components.ui || []).length;
  const domainCount = (components.domain || []).length;

  console.log(`Generated: ${outputPath}`);
  console.log(`  Portals: ${portals.length}, Components: ${uiCount + domainCount} (UI: ${uiCount}, Domain: ${domainCount}), Screens: ${screens.length}, State Models: ${states.length}`);
}

main();
