/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { generatePlanImage, PlanData } from './planImage';

describe('generatePlanImage', () => {
  beforeEach(() => {
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag !== 'canvas') throw new Error('only canvas supported in test');
        const ctx: any = {
          fillStyle: '',
          strokeStyle: '',
          lineWidth: 0,
          globalAlpha: 1,
          textBaseline: '',
          beginPath: () => { },
          moveTo: () => { },
          lineTo: () => { },
          stroke: () => { },
          fillRect: () => { },
          fillText: () => { },
          strokeRect: () => { },
          arc: () => { },
          font: '',
          textAlign: '',
          save: () => { },
          restore: () => { },
          translate: () => { },
          rotate: () => { },
          measureText: () => ({ width: 40 }),
        };
        return {
          width: 0,
          height: 0,
          getContext: () => ctx,
          toDataURL: () => 'data:image/png;base64,TEST',
        };
      }
    } as any;
  });

  it('retorna una imagen base64 a partir del plan', () => {
    const plan: PlanData = {
      effective_board: { width: 300, height: 180 },
      placements: [{ x: 10, y: 10, w: 50, h: 30 }],
      cuts: [{ orientation: 'vertical', x0: 0, y0: 0, x1: 300, y1: 0 }],
      features: [{ type: 'note', text: 'Prueba', x: 20, y: 20 }]
    };
    const img = generatePlanImage(plan, 800, 600);
    expect(img.startsWith('data:image/png;base64')).toBe(true);
  });
});
