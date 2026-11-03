import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup?version=3.0';
import { debugLog, describeError } from '../core/debug.js';
import { parseCodexJsonl } from './usageData.js';

const PRIORITY = GLib.PRIORITY_DEFAULT;
export class UsageError extends Error {
  constructor(code, detail = '') { super(code); this.code = code; this.detail = detail; }
}

// One deadline covers all work in each operation, including DNS and local I/O.
export class UsageIO {
  constructor() { this.pending = new Set(); this.destroyed = false; }
  async run(callback, deadline = GLib.get_monotonic_time() + 4000000) {
    if (this.destroyed) throw new UsageError('cancelled');
    const remainingMs = Math.floor((deadline - GLib.get_monotonic_time()) / 1000);
    if (remainingMs <= 0) throw new UsageError('timeout');
    const cancellable = new Gio.Cancellable();
    this.pending.add(cancellable);
    let timedOut = false;
    const timer = GLib.timeout_add(PRIORITY, remainingMs, () => {
      timedOut = true;
      cancellable.cancel();
      return GLib.SOURCE_REMOVE;
    });
    try {
      const result = await callback(cancellable);
      if (cancellable.is_cancelled()) throw new UsageError('cancelled');
      return result;
    }
    catch (error) {
      if (cancellable.is_cancelled()) throw new UsageError(timedOut ? 'timeout' : 'cancelled');
      if (error.matches?.(Gio.io_error_quark(), Gio.IOErrorEnum.TIMED_OUT)) throw new UsageError('timeout');
      if (error instanceof UsageError) throw error;
      throw new UsageError('unavailable', describeError(error));
    } finally {
      if (!timedOut) GLib.source_remove(timer);
      this.pending.delete(cancellable);
    }
  }
  destroy() {
    this.destroyed = true;
    for (const cancellable of this.pending) cancellable.cancel();
  }
}

export function asyncCall(object, method, finish, args) {
  return new Promise((resolve, reject) => object[method](...args, (source, result) => {
    try { resolve(source[finish](result)); } catch (error) { reject(error); }
  }));
}
async function close(stream) {
  try { await asyncCall(stream, 'close_async', 'close_finish', [PRIORITY, null]); } catch { /* Best effort. */ }
}
// truncate: stop quietly at maxBytes (for tails of files that may still grow) instead of failing.
async function read(stream, cancellable, maxBytes, truncate = false) {
  const chunks = [];
  let length = 0;
  while (length <= maxBytes) {
    const bytes = await asyncCall(stream, 'read_bytes_async', 'read_bytes_finish',
      [Math.min(65536, maxBytes + 1 - length), PRIORITY, cancellable]);
    let chunk = bytes.get_data();
    if (!chunk.length) break;
    if (length + chunk.length > maxBytes) {
      if (!truncate) throw new UsageError('too-large');
      chunk = chunk.subarray(0, maxBytes - length);
      length = maxBytes;
      if (chunk.length) chunks.push(chunk);
      break;
    }
    length += chunk.length;
    chunks.push(chunk);
  }
  const all = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(all);
}
export async function readJson(path, cancellable) {
  let stream;
  try {
    stream = await asyncCall(Gio.File.new_for_path(path), 'read_async', 'read_finish', [PRIORITY, cancellable]);
    return JSON.parse(await read(stream, cancellable, 65536));
  } catch (error) {
    if (error.matches?.(Gio.io_error_quark(), Gio.IOErrorEnum.NOT_FOUND)) throw new UsageError('missing');
    if (error instanceof SyntaxError) throw new UsageError('invalid-credentials');
    throw error;
  } finally { if (stream) await close(stream); }
}
// GJS throws for codes missing from Soup.Status (e.g. 429); the number is in the message.
function reasonPhrase(message) {
  try { return message.get_reason_phrase() ?? ''; } catch { return ''; }
}
function httpStatus(message) {
  try { return message.get_status(); }
  catch (error) {
    const code = Number(/^(\d+) is not a valid value/.exec(error?.message ?? '')?.[1]);
    if (code) return code;
    throw error;
  }
}
// A non-null body sends a JSON POST instead of a GET.
export async function getUsage(url, headers, cancellable, body = null) {
  const session = new Soup.Session({timeout: 4});
  const message = Soup.Message.new(body === null ? 'GET' : 'POST', url);
  message.set_flags(Soup.MessageFlags.NO_REDIRECT);
  if (body !== null) message.set_request_body_from_bytes('application/json',
    new GLib.Bytes(new TextEncoder().encode(JSON.stringify(body))));
  for (const [name, value] of Object.entries(headers)) message.request_headers.replace(name, value);
  message.request_headers.replace('Accept', 'application/json');
  let stream;
  try {
    stream = await asyncCall(session, 'send_async', 'send_finish', [message, PRIORITY, cancellable]);
    const status = httpStatus(message);
    debugLog('http', message.get_method(), url, '->', status, reasonPhrase(message));
    if (status === 401 || status === 403) throw new UsageError('auth-error', `HTTP ${status}`);
    if (status !== 200) throw new UsageError(status === 429 ? 'rate-limited' : 'unavailable',
      `HTTP ${status} ${reasonPhrase(message)}`.trim());
    try { return JSON.parse(await read(stream, cancellable, 1024 * 1024)); }
    catch (error) {
      if (error instanceof SyntaxError) throw new UsageError('invalid-response');
      throw error;
    }
  } finally { if (stream) await close(stream); session.abort(); }
}
export function configDir(variable, fallback) {
  return GLib.getenv(variable) || GLib.build_filenamev([GLib.get_home_dir(), fallback]);
}
export function tokenExpiry(token) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const data = JSON.parse(new TextDecoder().decode(GLib.base64_decode(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '='))));
    return typeof data.exp === 'number' ? data.exp * 1000 : undefined;
  } catch { return undefined; }
}

// At most 2048 directory entries, 12 tails of 256 KiB, and four seconds.
// No synchronous history reads; seeking only positions an already-open local fd.
export async function latestCodexObservation(root, cancellable) {
  let entriesLeft = 2048;
  const files = [];
  async function walk(path, depth) {
    if (depth > 4 || entriesLeft <= 0) return;
    let enumerator;
    try {
      enumerator = await asyncCall(Gio.File.new_for_path(path), 'enumerate_children_async', 'enumerate_children_finish',
        ['standard::name,standard::type,time::modified', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, PRIORITY, cancellable]);
      const entries = [];
      while (entriesLeft > 0) {
        const batch = await asyncCall(enumerator, 'next_files_async', 'next_files_finish', [Math.min(128, entriesLeft), PRIORITY, cancellable]);
        if (!batch.length) break;
        entriesLeft -= batch.length;
        entries.push(...batch);
      }
      entries.sort((a, b) => b.get_name().localeCompare(a.get_name()));
      const dirs = [];
      for (const entry of entries) {
        const child = GLib.build_filenamev([path, entry.get_name()]);
        if (entry.get_file_type() === Gio.FileType.DIRECTORY) dirs.push(child);
        else if (entry.get_file_type() === Gio.FileType.REGULAR && entry.get_name().endsWith('.jsonl'))
          files.push({path: child, modified: entry.get_attribute_uint64('time::modified')});
      }
      for (const dir of dirs.slice(0, 3)) await walk(dir, depth + 1);
    } catch (error) {
      if (cancellable.is_cancelled()) throw error;
    } finally { if (enumerator) await close(enumerator); }
  }
  await walk(root, 0);
  files.sort((a, b) => b.modified - a.modified);
  let latest = null;
  for (const file of files.slice(0, 12)) {
    let stream;
    try {
      stream = await asyncCall(Gio.File.new_for_path(file.path), 'read_async', 'read_finish', [PRIORITY, cancellable]);
      const info = await asyncCall(stream, 'query_info_async', 'query_info_finish', ['standard::size', PRIORITY, cancellable]);
      const start = Math.max(0, info.get_size() - 256 * 1024);
      stream.seek(start, GLib.SeekType.SET, cancellable);
      let text = await read(stream, cancellable, 256 * 1024, true);
      if (start > 0) {
        const newline = text.indexOf('\n');
        text = newline < 0 ? '' : text.slice(newline + 1);
      }
      const observation = parseCodexJsonl(text);
      if (observation && (!latest || observation.lastUpdated > latest.lastUpdated)) latest = observation;
    } catch (error) {
      if (cancellable.is_cancelled()) throw error;
    } finally { if (stream) await close(stream); }
  }
  return latest;
}
