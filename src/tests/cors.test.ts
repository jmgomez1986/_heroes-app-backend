import { describe, it, expect, vi, afterEach } from 'vitest';
import type { CorsOptions } from 'cors';

// cors.ts evalua su ambiente AL MOMENTO DE IMPORTARSE (module load):
// allowNoOrigin queda congelado con lo que hubiera en ese instante.
// Vitest fuerza NODE_ENV=test, asi que la rama falsa del if es
// inalcanzable... salvo que se RE-IMPORTA el modulo con el ambiente
// stubbeado (vi.resetModules + import dinamico): la tecnica para
// probar configuraciones que se calculan al cargar
const loadCorsConf = async (
  env: Record<string, string>,
): Promise<CorsOptions> => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  const { corsConf } = await import('../config/cors');
  return corsConf;
};

// La firma del callback del origin function de cors
type OriginFn = (
  origin: string | undefined,
  callback: (err: Error | null, ok?: boolean) => void,
) => void;

const originFnOf = (conf: CorsOptions): OriginFn => conf.origin as OriginFn;

afterEach(() => {
  // Limpieza: sin esto, el NODE_ENV stubbeado se filtraria a otros tests
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('corsConf origin', () => {
  it('fails fast when FRONTEND_URL is not defined', async () => {
    // Arrange + Act: cargar el modulo SIN FRONTEND_URL. La validacion
    // fail-fast (patron de config/db.ts) rechaza el arranque en el
    // import mismo: el deploy lo detecta, no el front roto de madrugada
    await expect(loadCorsConf({ NODE_ENV: 'test' })).rejects.toThrow(
      'FRONTEND_URL no definida: revisá tu archivo .env y que dotenv esté cargado',
    );
  });

  it('allows no-origin clients when allowNoOrigin is on', async () => {
    // Arrange: NODE_ENV=test -> allowNoOrigin true -> undefined entra
    // a la whitelist (clientes sin Origin: Postman, curl, health checks).
    // FRONTEND_URL stubbeada: la validacion fail-fast la exige
    const conf = await loadCorsConf({
      NODE_ENV: 'test',
      FRONTEND_URL: 'http://localhost:5173',
    });
    const callback = vi.fn();

    // Act
    originFnOf(conf)(undefined, callback);

    // Assert
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('allows the whitelisted frontend origin', async () => {
    // Arrange: FRONTEND_URL stubbeado: ese origin es el unico string
    // de la whitelist
    const conf = await loadCorsConf({
      NODE_ENV: 'test',
      FRONTEND_URL: 'http://localhost:5173',
    });
    const callback = vi.fn();

    // Act
    originFnOf(conf)('http://localhost:5173', callback);

    // Assert
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects an unknown origin with the CORS error', async () => {
    // Arrange: cualquier origin fuera de la whitelist (FRONTEND_URL
    // stubbeada por la validacion fail-fast)
    const conf = await loadCorsConf({
      NODE_ENV: 'test',
      FRONTEND_URL: 'http://localhost:5173',
    });
    const callback = vi.fn();

    // Act
    originFnOf(conf)('http://evil-site.com', callback);

    // Assert: el error que cors middlewarea a Express (hoy llega al
    // errorHandler global como 500). Se lee el arg: el mensaje exacto
    expect(callback).toHaveBeenCalledTimes(1);
    const [err] = callback.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Error de CORS');
    // Contrato con el errorHandler: el status viaja adjunto
    expect((err as Error & { status?: number }).status).toBe(403);
  });

  it('rejects no-origin clients when allowNoOrigin is off', async () => {
    // Arrange: la rama que vitest no alcanza: NODE_ENV=development y
    // sin --api en argv -> la whitelist NO incluye undefined. FRONTEND_URL
    // stubbeada a proposito: si quedara undefined, quedaria en la
    // whitelist por si misma (bug latente del config, ver nota abajo)
    const conf = await loadCorsConf({
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://localhost:5173',
    });
    const callback = vi.fn();

    // Act: un cliente sin Origin en produccion
    originFnOf(conf)(undefined, callback);

    // Assert: rechazado
    expect(callback).toHaveBeenCalledTimes(1);
    const [err] = callback.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('Error de CORS');
  });
});
