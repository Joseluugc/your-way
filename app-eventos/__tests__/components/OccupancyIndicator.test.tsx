import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import OccupancyIndicator from '../../src/components/OccupancyIndicator';
import type { OccupancyLevel } from '../../src/domain/map/mapTypes';

// El icono es decorativo y está oculto al lector de pantalla: se consulta incluyendo ocultos.
const HIDDEN = { includeHiddenElements: true };

const CASES: [OccupancyLevel, string, string][] = [
  ['available', 'Disponible', '✓'],
  ['medium', 'Ocupación media', '!'],
  ['full', 'Completo', '✕'],
  ['unavailable', 'Sin datos', '?'],
];

describe('[US-03.2] [US-06.3] semáforo de aforo (OccupancyIndicator)', () => {
  it.each(CASES)('[US-03.2] nivel %s muestra el texto "%s" y el icono %s', async (level, label, icon) => {
    await render(<OccupancyIndicator level={level} showLabel />);

    expect(screen.getByText(label)).toBeOnTheScreen();
    expect(screen.getByTestId(`occupancy-icon-${level}`, HIDDEN)).toHaveTextContent(icon);
    expect(screen.getByLabelText(`Aforo: ${label}`)).toBeOnTheScreen();
  });

  it('[US-03.2] sin showLabel muestra solo el icono, pero sigue anunciando el nivel', async () => {
    await render(<OccupancyIndicator level="full" />);

    expect(screen.queryByText('Completo')).toBeNull();
    expect(screen.getByTestId('occupancy-icon-full', HIDDEN)).toHaveTextContent('✕');
    expect(screen.getByLabelText('Aforo: Completo')).toBeOnTheScreen();
  });

  it('[US-03.2] los cuatro niveles se distinguen sin depender del color', async () => {
    const icons: string[] = [];
    for (const [level] of CASES) {
      const { unmount } = await render(<OccupancyIndicator level={level} />);
      icons.push(String(screen.getByTestId(`occupancy-icon-${level}`, HIDDEN).props.children));
      await unmount();
    }
    expect(new Set(icons).size).toBe(4);
  });
});
