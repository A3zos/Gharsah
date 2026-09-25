// Token colors for SVG art (fill/stroke attributes). Never a raw hex in a component.
import { tokens } from '../../styles/tokens.generated';

export const C = tokens.colors;
export type ColorName = keyof typeof C;
