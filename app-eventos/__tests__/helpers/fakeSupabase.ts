/**
 * Doble de prueba de `src/lib/supabase` para la cola de sincronización: imita la tabla
 * `eventos` de Supabase en memoria, sin red real.
 *
 * - `online = false`: `ensureSession` y las consultas fallan como sin conexión.
 * - `failNextUpsert()`: la siguiente subida falla (corte de red a mitad de sincronización).
 * - El "servidor" asigna `updated_at` con su propio reloj, como el trigger de Supabase,
 *   e ignora el que envíe el cliente.
 */
type Row = Record<string, unknown> & { id: string; updated_at: string };
type Result = { data: Row[] | null; error: Error | null };

class FakeEventosRemote {
  online = true;
  readonly rows = new Map<string, Row>();
  readonly upserts: Record<string, unknown>[][] = [];
  private shouldFailUpsert = false;
  private clock = Date.parse('2026-11-20T09:00:00.000Z');

  reset(): void {
    this.online = true;
    this.shouldFailUpsert = false;
    this.rows.clear();
    this.upserts.length = 0;
  }

  failNextUpsert(): void {
    this.shouldFailUpsert = true;
  }

  /** Cambio hecho por otro dispositivo directamente en el servidor. */
  writeFromOtherDevice(row: Record<string, unknown> & { id: string }): void {
    this.rows.set(row.id, { ...row, updated_at: this.tick() });
  }

  upsert(rows: Record<string, unknown>[]): { error: Error | null } {
    if (!this.online) return { error: new Error('Network request failed') };
    if (this.shouldFailUpsert) {
      this.shouldFailUpsert = false;
      return { error: new Error('Network request failed') };
    }
    this.upserts.push(rows);
    for (const row of rows) {
      const id = row.id as string;
      this.rows.set(id, { ...this.rows.get(id), ...row, id, updated_at: this.tick() });
    }
    return { error: null };
  }

  select(cursor: string | null, limit: number): Result {
    if (!this.online) return { data: null, error: new Error('Network request failed') };
    const data = [...this.rows.values()]
      .filter((row) => cursor === null || row.updated_at > cursor)
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
      .slice(0, limit)
      .map((row) => ({ ...row }));
    return { data, error: null };
  }

  private tick(): string {
    this.clock += 1000;
    return new Date(this.clock).toISOString();
  }
}

export const mockEventosRemote = new FakeEventosRemote();

class QueryBuilder implements PromiseLike<Result> {
  private cursor: string | null = null;
  private max = Number.POSITIVE_INFINITY;

  select(): this {
    return this;
  }

  order(): this {
    return this;
  }

  limit(count: number): this {
    this.max = count;
    return this;
  }

  gt(_column: string, value: string): this {
    this.cursor = value;
    return this;
  }

  upsert(rows: Record<string, unknown>[]): Promise<{ error: Error | null }> {
    return Promise.resolve(mockEventosRemote.upsert(rows));
  }

  then<TResult1 = Result, TResult2 = never>(
    onfulfilled?: ((value: Result) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(mockEventosRemote.select(this.cursor, this.max)).then(
      onfulfilled,
      onrejected,
    );
  }
}

/** Sustituto del módulo `src/lib/supabase` (se usa con `jest.mock`). */
export const fakeSupabaseModule = {
  ensureSession: async (): Promise<void> => {
    if (!mockEventosRemote.online) throw new Error('Network request failed');
  },
  supabase: {
    from: (table: string) => {
      if (table !== 'eventos') throw new Error(`Tabla no simulada: ${table}`);
      return new QueryBuilder();
    },
  },
};
