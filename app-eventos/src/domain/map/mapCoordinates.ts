import type { MapCoordinates } from './mapTypes';

export const MAP_VIEW_WIDTH = 1000;

export interface CanvasPoint {
  x: number;
  y: number;
}

export interface MapViewport {
  width: number;
  height: number;
}

export function mapCoordinatesToCanvasPoint(coordinates: MapCoordinates): CanvasPoint {
  return {
    x: 100 + coordinates.map_x * 8,
    y: 100 + coordinates.map_y * 4.3,
  };
}

export function canvasPointToMapCoordinates(
  viewportPoint: CanvasPoint,
  pan: CanvasPoint,
  zoom: number,
  viewport: MapViewport,
  viewHeight: number,
): MapCoordinates {
  const scale = Math.min(viewport.width / MAP_VIEW_WIDTH, viewport.height / viewHeight);
  const offsetX = (viewport.width - MAP_VIEW_WIDTH * scale) / 2;
  const offsetY = (viewport.height - viewHeight * scale) / 2;
  const canvasX = (viewportPoint.x - offsetX) / scale;
  const canvasY = (viewportPoint.y - offsetY) / scale;
  const untransformedX =
    (canvasX - pan.x - MAP_VIEW_WIDTH / 2) / zoom + MAP_VIEW_WIDTH / 2;
  const untransformedY = (canvasY - pan.y - viewHeight / 2) / zoom + viewHeight / 2;

  return {
    map_x: (untransformedX - 100) / 8,
    map_y: (untransformedY - 100) / 4.3,
  };
}

export function mapCoordinatesToViewportPoint(
  coordinates: MapCoordinates,
  pan: CanvasPoint,
  zoom: number,
  viewport: MapViewport,
  viewHeight: number,
): CanvasPoint {
  const canvasPoint = mapCoordinatesToCanvasPoint(coordinates);
  const scale = Math.min(viewport.width / MAP_VIEW_WIDTH, viewport.height / viewHeight);
  const offsetX = (viewport.width - MAP_VIEW_WIDTH * scale) / 2;
  const offsetY = (viewport.height - viewHeight * scale) / 2;
  const x = pan.x + MAP_VIEW_WIDTH / 2 + zoom * (canvasPoint.x - MAP_VIEW_WIDTH / 2);
  const y = pan.y + viewHeight / 2 + zoom * (canvasPoint.y - viewHeight / 2);
  return { x: offsetX + x * scale, y: offsetY + y * scale };
}
