import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { selectOpenAIAuth } from './opencodeAuthData.js';
import { UsageError, asyncCall, readJson } from '../usageIO.js';

// `opencode debug paths db` costs a subprocess; the path does not change while the Shell runs.
let cachedDbPath = null;

async function command(args, cancellable) {
  const process = Gio.Subprocess.new(args,
    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_SILENCE);
  let output;
  try {
    [, output] = await new Promise((resolve, reject) => process.communicate_utf8_async(
      null, cancellable, (_source, result) => {
        try { resolve(process.communicate_utf8_finish(result)); } catch (error) { reject(error); }
      }));
  } finally {
    if (!process.get_if_exited()) process.force_exit();
  }
  if (!process.get_successful() || output.length > 131072) throw new UsageError('unavailable');
  return output;
}

function legacyPath() {
  return GLib.build_filenamev([GLib.getenv('XDG_DATA_HOME') ||
    GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share']), 'opencode', 'auth.json']);
}

function credential(source) {
  const {credential: selected, issue} = selectOpenAIAuth(source);
  if (issue === 'unsupported-auth' || issue === 'expired') throw new UsageError(issue);
  return selected ?? null;
}

// Returns the database credential (or null when V2 has none, never falling back to a stale
// auth.json), or undefined when this install cannot be V2 (no binary, OpenCode 1.x) so the
// caller may try auth.json.
async function databaseCredential(cancellable) {
  const executable = GLib.find_program_in_path('opencode') ||
    GLib.build_filenamev([GLib.get_home_dir(), '.opencode', 'bin', 'opencode']);
  if (!Gio.File.new_for_path(executable).query_exists(cancellable)) return undefined;
  let path = cachedDbPath;
  if (!path) {
    try { path = (await command([executable, 'debug', 'paths', 'db'], cancellable)).trim(); }
    catch (error) {
      // OpenCode 1.x has no `debug paths db`; it keeps the sign-in in auth.json.
      if (error instanceof UsageError && error.code === 'unavailable' &&
          /^v?1\./.test((await command([executable, '--version'], cancellable)).trim())) return undefined;
      throw error;
    }
    if (!GLib.path_is_absolute(path) || path.includes('\n')) throw new UsageError('invalid-response');
    cachedDbPath = path;
  }
  let info;
  try {
    info = await asyncCall(Gio.File.new_for_path(path), 'query_info_async', 'query_info_finish',
      ['standard::type', Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS, GLib.PRIORITY_DEFAULT, cancellable]);
  } catch (error) {
    if (!error.matches?.(Gio.io_error_quark(), Gio.IOErrorEnum.NOT_FOUND)) throw error;
    return null;
  }
  if (info.get_file_type() !== Gio.FileType.REGULAR) throw new UsageError('invalid-credentials');
  const sqlite = GLib.find_program_in_path('sqlite3');
  if (!sqlite) throw new UsageError('missing-dependency');
  const output = await command([sqlite, '-readonly', '-json', path,
    "SELECT active, value FROM credential WHERE integration_id = 'openai' ORDER BY active DESC, time_created DESC LIMIT 1"], cancellable);
  let rows;
  try { rows = JSON.parse(output || '[]'); } catch { throw new UsageError('invalid-credentials'); }
  return credential(rows);
}

export async function readOpenCodeAuth(cancellable) {
  const fromDatabase = await databaseCredential(cancellable);
  if (fromDatabase !== undefined) return fromDatabase;
  // Older OpenCode versions keep the OAuth sign-in in auth.json instead.
  try { return credential(await readJson(legacyPath(), cancellable)); }
  catch (error) { if (error instanceof UsageError && error.code === 'missing') return null; throw error; }
}
