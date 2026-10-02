import { json, serverError, type Env } from './_shared/env';

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const { results } = await env.DB
      .prepare('SELECT * FROM uploads ORDER BY id DESC LIMIT 200')
      .all();
    return json({ uploads: results });
  } catch (err) {
    return serverError(`Could not read the upload history: ${err instanceof Error ? err.message : String(err)}`);
  }
};
