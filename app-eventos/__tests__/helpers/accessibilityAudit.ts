import { StyleSheet } from 'react-native';
import {
  contrastRatio,
  isLargeText,
  WCAG_AA_MINIMUM,
  type ContrastUse,
} from '../../src/domain/accessibility/contrast';

/**
 * Auditoría de accesibilidad sobre el árbol renderizado por React Native Testing Library.
 * Trabaja con los elementos nativos ("host"): así revisa lo que de verdad se pinta.
 */
export interface HostNode {
  type: string;
  props: Record<string, unknown>;
  parent: HostNode | null;
  children: (HostNode | string)[];
}

/** Fondo de la app cuando ningún contenedor define uno (pantallas y hojas son claras). */
const DEFAULT_BACKGROUND = '#FFFFFF';
/** Color de texto por defecto de React Native. */
const DEFAULT_TEXT_COLOR = '#000000';
const DEFAULT_FONT_SIZE = 14;

function walk(node: HostNode | string, visit: (node: HostNode) => void): void {
  if (typeof node === 'string') return;
  visit(node);
  for (const child of node.children) walk(child, visit);
}

function style(node: HostNode): Record<string, unknown> {
  return (StyleSheet.flatten(node.props.style as never) ?? {}) as Record<string, unknown>;
}

function isOpaque(color: unknown): color is string {
  if (typeof color !== 'string') return false;
  if (color === 'transparent') return false;
  try {
    contrastRatio(color, '#000000');
    return true;
  } catch {
    return false;
  }
}

/** Fondo efectivo: el primer fondo opaco del propio elemento o de sus contenedores. */
function backgroundOf(node: HostNode | null): string {
  for (let current = node; current; current = current.parent) {
    const background = style(current).backgroundColor;
    if (isOpaque(background)) return background;
  }
  return DEFAULT_BACKGROUND;
}

/** Valor de texto heredado de los `<Text>` anidados (como hace React Native). */
function inheritedTextStyle(node: HostNode, key: 'color' | 'fontSize' | 'fontWeight'): unknown {
  for (let current: HostNode | null = node; current && current.type === 'Text'; current = current.parent) {
    const value = style(current)[key];
    if (value !== undefined) return value;
  }
  return undefined;
}

function describe(node: HostNode): string {
  const own = node.children.filter((child): child is string => typeof child === 'string').join('');
  const label = (node.props.accessibilityLabel as string | undefined) ?? (node.props.placeholder as string);
  return JSON.stringify(own || label || node.props.testID || node.type);
}

function isDecorative(node: HostNode): boolean {
  for (let current: HostNode | null = node; current; current = current.parent) {
    if (
      current.props.accessibilityElementsHidden === true ||
      current.props.importantForAccessibility === 'no-hide-descendants'
    ) {
      return true;
    }
  }
  return false;
}

/** WCAG excluye de los requisitos de contraste los controles inactivos (desactivados). */
function isDisabled(node: HostNode): boolean {
  for (let current: HostNode | null = node; current; current = current.parent) {
    const state = current.props.accessibilityState as { disabled?: boolean } | undefined;
    if (state?.disabled === true) return true;
  }
  return false;
}

export function isInteractive(node: HostNode): boolean {
  return node.type === 'TextInput' || 'onClick' in node.props || 'onResponderRelease' in node.props;
}

/** Elementos interactivos sin `accessibilityLabel` (o sin `accessibilityRole` si son pulsables). */
export function findUnlabeledInteractive(root: HostNode): string[] {
  const problems: string[] = [];
  walk(root, (node) => {
    if (!isInteractive(node)) return;
    const label = node.props.accessibilityLabel;
    if (typeof label !== 'string' || label.trim().length === 0) {
      problems.push(`${node.type} ${describeInteractive(node)} sin accessibilityLabel`);
    }
    if (node.type !== 'TextInput' && typeof node.props.accessibilityRole !== 'string') {
      problems.push(`${node.type} ${describeInteractive(node)} sin accessibilityRole`);
    }
  });
  return problems;
}

function describeInteractive(node: HostNode): string {
  const texts: string[] = [];
  walk(node, (child) => {
    for (const text of child.children) if (typeof text === 'string') texts.push(text);
  });
  return JSON.stringify(texts.join(' ').trim() || node.props.placeholder || node.props.testID || '?');
}

export interface ContrastIssue {
  element: string;
  use: ContrastUse;
  foreground: string;
  background: string;
  ratio: number;
}

function check(
  issues: ContrastIssue[],
  element: string,
  use: ContrastUse,
  foreground: unknown,
  background: string,
): void {
  if (!isOpaque(foreground)) return;
  const ratio = contrastRatio(foreground, background);
  if (ratio < WCAG_AA_MINIMUM[use]) {
    issues.push({ element, use, foreground, background, ratio: Math.round(ratio * 100) / 100 });
  }
}

/**
 * Pares color/fondo que no cumplen WCAG 2.1 AA:
 * - cada texto visible frente a su fondo (1.4.3: 4,5:1, o 3:1 si es grande);
 * - los iconos de texto decorativos (ocultos al lector) frente a su fondo (1.4.11: 3:1);
 * - el texto, el placeholder y el borde de los campos de texto (1.4.3 y 1.4.11);
 * - el borde de los controles pulsables que lo tienen (1.4.11).
 * Los controles desactivados quedan fuera, como permite WCAG.
 */
export function findContrastIssues(root: HostNode): ContrastIssue[] {
  const issues: ContrastIssue[] = [];
  walk(root, (node) => {
    if (node.type === 'Text') {
      const ownText = node.children.some((child) => typeof child === 'string' && child.trim().length > 0);
      if (!ownText || isDisabled(node)) return;
      const color = inheritedTextStyle(node, 'color') ?? DEFAULT_TEXT_COLOR;
      const fontSize = Number(inheritedTextStyle(node, 'fontSize') ?? DEFAULT_FONT_SIZE);
      const fontWeight = inheritedTextStyle(node, 'fontWeight') as string | number | undefined;
      const use: ContrastUse = isDecorative(node)
        ? 'nonText'
        : isLargeText(fontSize, fontWeight)
          ? 'largeText'
          : 'text';
      check(issues, `Texto ${describe(node)}`, use, color, backgroundOf(node.parent));
      return;
    }

    if (!isInteractive(node) || isDisabled(node)) return;
    const own = style(node);
    const outside = backgroundOf(node.parent);
    const inside = backgroundOf(node);

    if (node.type === 'TextInput') {
      check(issues, `Campo ${describe(node)}`, 'text', own.color ?? DEFAULT_TEXT_COLOR, inside);
      check(issues, `Placeholder ${describe(node)}`, 'text', node.props.placeholderTextColor, inside);
    }

    // 1.4.11: el control debe distinguirse de lo que lo rodea, por su borde o por su relleno.
    const hasBorder = Number(own.borderWidth ?? 0) > 0 && isOpaque(own.borderColor);
    if (hasBorder) {
      const borderVisible = contrastRatio(own.borderColor as string, outside) >= WCAG_AA_MINIMUM.nonText;
      const fillVisible = contrastRatio(inside, outside) >= WCAG_AA_MINIMUM.nonText;
      if (!borderVisible && !fillVisible) {
        check(issues, `Borde de ${node.type} ${describe(node)}`, 'nonText', own.borderColor, outside);
      }
    }
  });
  return issues;
}

export function formatContrastIssues(issues: ContrastIssue[]): string[] {
  return issues.map(
    (issue) =>
      `${issue.element}: ${issue.foreground} sobre ${issue.background} = ${issue.ratio}:1 ` +
      `(mínimo ${WCAG_AA_MINIMUM[issue.use]}:1, ${issue.use})`,
  );
}
