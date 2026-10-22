export type Room = 'sala' | 'dormitorio' | 'cocina' | 'entrada';
export type Access = 'entrada' | 'lateral' | 'jardin';
export type NetworkZone = 'sala' | 'dormitorio' | 'terraza';
export type NetworkLayout = 'router' | 'distribuida';
export type Obstacle = 'abierto' | 'muros' | 'plantas';
export const roomLabels: Record<Room, string> = {
  sala: 'Sala',
  dormitorio: 'Dormitorio',
  cocina: 'Cocina',
  entrada: 'Entrada',
};
export const lightPresets: Record<string, Room[]> = {
  llegar: ['sala', 'entrada'],
  descansar: ['sala', 'dormitorio'],
  salir: [],
};
export const securityViews: Record<
  Access,
  { label: string; cone: string; camera: string; blind: string }
> = {
  entrada: {
    label: 'Entrada principal',
    cone: 'M374 298 288 194 466 194Z',
    camera: 'translate(374 298)',
    blind: 'M282 196h45v99h-45Z',
  },
  lateral: {
    label: 'Acceso lateral',
    cone: 'M472 150 316 62 316 281Z',
    camera: 'translate(472 150)',
    blind: 'M283 44h38v142h-38Z',
  },
  jardin: {
    label: 'Jardín',
    cone: 'M44 112 261 48 261 181Z',
    camera: 'translate(44 112)',
    blind: 'M48 197h66v99H48Z',
  },
};
export function lightingSummary(zones: ReadonlySet<Room>) {
  const active = Object.keys(roomLabels)
    .filter((key) => zones.has(key as Room))
    .map((key) => roomLabels[key as Room]);
  return {
    title: active.length
      ? `${active.length} ${active.length === 1 ? 'ambiente encendido' : 'ambientes encendidos'}. A tu manera.`
      : 'Todo en pausa.',
    text: active.length
      ? `${active.join(', ')}. Tocá otra luz para personalizar la escena.`
      : 'Todas las luces del ejemplo están apagadas. Una escena también puede simplificar la salida.',
    item: active.length
      ? `Iluminación por zonas: ${active.join(', ')}`
      : 'Escena de apagado al salir',
  };
}
export function networkAssessment(
  layout: NetworkLayout,
  zone: NetworkZone,
  obstacle: Obstacle,
) {
  if (obstacle === 'plantas')
    return {
      title: 'Otra planta cambia la conversación.',
      text:
        layout === 'router'
          ? 'Un router en este piso puede quedar lejos del otro nivel. Revisaríamos materiales y un enlace entre plantas.'
          : 'Acercar un punto de acceso al otro nivel es una opción a evaluar, junto al cableado y los materiales.',
    };
  if (layout === 'distribuida')
    return {
      title: 'La red se acerca a tu rutina.',
      text:
        obstacle === 'muros'
          ? 'Distribuir puntos permite pensar en ambos lados de los muros. Sus ubicaciones se validan en el lugar.'
          : `En ${zone === 'terraza' ? 'la terraza' : `el ambiente ${zone === 'sala' ? 'social' : 'de descanso'}`}, acercar un punto de acceso es una alternativa de diseño; no asegura una señal determinada.`,
    };
  if (obstacle === 'muros')
    return {
      title: 'El muro también cuenta.',
      text: 'La separación entre ambientes puede afectar el alcance. Antes de agregar equipos conviene revisar posición y materiales.',
    };
  return zone === 'sala'
    ? {
        title: 'Un punto de partida cercano.',
        text: 'La zona de uso está junto al router en este ejemplo. Un espacio abierto puede permitir un diseño sencillo, sujeto a revisión.',
      }
    : {
        title: 'Empezá por dónde lo usás.',
        text: `${zone === 'terraza' ? 'La terraza está' : 'El dormitorio está'} lejos del router en este ejemplo. La distribución merece una revisión.`,
      };
}
