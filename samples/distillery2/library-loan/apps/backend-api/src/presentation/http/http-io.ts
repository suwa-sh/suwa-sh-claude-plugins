import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Problem } from './problem';

/** リクエスト本文の上限 (AssumptionRecord A-009)。 */
const MAX_BODY_BYTES = 64 * 1024;

export class BodyTooLarge extends Error {}

export async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw new BodyTooLarge();
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString('utf8');
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function sendProblem(res: ServerResponse, problem: Problem): void {
  const payload = JSON.stringify(problem);
  res.writeHead(problem.status, {
    'content-type': 'application/problem+json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}
