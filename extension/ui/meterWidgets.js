import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import {meterValue, meterSeverity, meterColor, unicodeSegments, compactTokens} from './meterModel.js';
import {panelDescription} from './panelComponents.js';

export function providerMeters(result, style, path, whiteIcons, display) {
  const brand = result.id === 'opencode-openai' ? 'opencode' : result.id;
  const iconName = whiteIcons && ['claude', 'antigravity'].includes(brand)
    ? `${brand}-white` : brand;
  const box = new St.BoxLayout({style_class: 'ai-provider-meters',
    y_align: Clutter.ActorAlign.CENTER, accessible_name: panelDescription(result, display)});
  if (display.icon) box.add_child(new St.Icon({
    gicon: Gio.icon_new_for_string(`${path}/icons/${iconName}.svg`),
    icon_size: 14, style_class: `ai-brand ai-brand-${brand}`,
    y_align: Clutter.ActorAlign.CENTER,
  }));
  if (result.id === 'opencode') {
    if (display.activity) box.add_child(new St.Label({text: ['ok', 'stale'].includes(result.status)
      ? `${compactTokens(result.totalTokens ?? 0)} / 7d` : '—',
    y_align: Clutter.ActorAlign.CENTER}));
    return box;
  }
  for (const {name, orientation} of display.meters) {
    const vertical = orientation === 'vertical';
    const value = meterValue(result, name);
    if (value === null) {
      box.add_child(new St.Label({text: '—', accessible_name: `${name}: unavailable`,
        y_align: Clutter.ActorAlign.CENTER}));
      continue;
    }
    if (style === 'unicode') {
      const text = unicodeSegments(value, vertical ? 3 : 5);
      box.add_child(new St.Label({
        text: vertical ? [...text].reverse().join('\n') : text,
        style_class: `ai-unicode ${vertical ? 'vertical' : 'horizontal'}`,
          accessible_name: `${name}: ${value}% used`,
        y_align: Clutter.ActorAlign.CENTER,
      }));
    } else {
      const track = new St.Widget({layout_manager: new Clutter.FixedLayout(),
        width: vertical ? 4 : 28, height: vertical ? 18 : 4,
        style_class: `ai-meter-track ${vertical ? 'vertical' : 'horizontal'}`,
          accessible_name: `${name}: ${value}% used`,
        y_align: Clutter.ActorAlign.CENTER});
      const fill = new St.Widget({style_class: `ai-meter-fill ${meterSeverity(value)}`,
        visible: value > 0});
      if (value > 0) {
        // Whole pixels, and size/radius in the inline style: fills of different
        // lengths must not share a theme node or St reuses stale corner geometry.
        const length = Math.max(1, Math.round((vertical ? 18 : 28) * value / 100));
        const radius = Math.min(2, Math.floor(length / 2));
        fill.set_size(vertical ? 4 : length, vertical ? length : 4);
        if (vertical) fill.set_position(0, 18 - length);
        fill.set_style(`width: ${vertical ? 4 : length}px; height: ${vertical ? length : 4}px; ` +
          `border-radius: ${radius}px; background-color: ${meterColor(value)};`);
      }
      track.add_child(fill);
      box.add_child(track);
    }
  }
  return box;
}
