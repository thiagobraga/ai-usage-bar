import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { UsageError } from '../shared/usageIO.js';

function dataHome() {
  return GLib.getenv('XDG_DATA_HOME') || GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share']);
}

// OpenCode keeps provider sign-ins here; also the only credential file for 1.x.
export function openCodeAuthPath() {
  return GLib.build_filenamev([dataHome(), 'opencode', 'auth.json']);
}

// Path to the opencode executable, or null when it is not installed.
export function findOpenCode(cancellable) {
  const executable = GLib.find_program_in_path('opencode') ||
    GLib.build_filenamev([GLib.get_home_dir(), '.opencode', 'bin', 'opencode']);
  return Gio.File.new_for_path(executable).query_exists(cancellable) ? executable : null;
}

// Runs a command and returns stdout, throwing UsageError('unavailable') on failure or oversized output.
export async function runCommand(args, cancellable, maxBytes) {
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
  if (!process.get_successful() || output.length > maxBytes) throw new UsageError('unavailable');
  return output;
}
