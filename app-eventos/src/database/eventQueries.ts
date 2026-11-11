import { SQLiteDatabase } from 'expo-sqlite';

export type Evento = {
  id: string;
  titulo: string;
  fecha_inicio: string;
  fecha_fin: string;
  ubicacion: string;
  descripcion: string;
};

export async function insertEvent(db: SQLiteDatabase, evento: Evento) {
  const statement = await db.prepareAsync(
    'INSERT INTO eventos (id, titulo, fecha_inicio, fecha_fin, ubicacion, descripcion) VALUES ($id, $titulo, $fechaInicio, $fechaFin, $ubicacion, $descripcion)'
  );
  
  try {
    await statement.executeAsync({
      $id: evento.id,
      $titulo: evento.titulo,
      $fechaInicio: evento.fecha_inicio,
      $fechaFin: evento.fecha_fin,
      $ubicacion: evento.ubicacion,
      $descripcion: evento.descripcion,
    });
  } finally {
    await statement.finalizeAsync();
  }
}

export async function getEventos(db: SQLiteDatabase) {
  const todosLosEventos = await db.getAllAsync('SELECT * FROM eventos');
  return todosLosEventos;
}