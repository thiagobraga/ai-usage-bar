import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import {meterValue, meterSeverity, meterColor, meterOrientation, unicodeSegments, usageSummary} from './meterModel.js';

export function providerMeters(result, style, orientation, path) {
  const vertical = meterOrientation(style, orientation) === 'vertical';
  const box = new St.BoxLayout({style_class: 'ai-provider-meters',
    y_align: Clutter.ActorAlign.CENTER, accessible_name: usageSummary(result)});
  box.add_child(new St.Icon({
    gicon: Gio.icon_new_for_string(`${path}/icons/${result.id}.svg`),
    icon_size: 16, style_class: `ai-brand ai-brand-${result.id}`,
    y_align: Clutter.ActorAlign.CENTER,
  }));
  const meters = new St.BoxLayout({vertical: !vertical,
    style_class: `ai-meters ${vertical ? 'vertical' : 'horizontal'}`,
    y_align: Clutter.ActorAlign.CENTER});
  for (const name of ['Session', 'Weekly']) {
    const value = meterValue(result, name);
    if (style === 'unicode') {
      const text = unicodeSegments(value, vertical ? 3 : 5);
      meters.add_child(new St.Label({
        text: vertical && value !== null ? [...text].reverse().join('\n') : text,
        style_class: `ai-unicode ${vertical ? 'vertical' : 'horizontal'}${value === null ? ' ai-unknown' : ''}`,
        y_align: Clutter.ActorAlign.CENTER,
      }));
    } else if (value === null) {
      meters.add_child(new St.Label({text: '—', style_class: 'ai-unknown',
        y_align: Clutter.ActorAlign.CENTER}));
    } else {
      const track = new St.BoxLayout({vertical,
        style_class: `ai-meter-track ${vertical ? 'vertical' : 'horizontal'}`});
      const fill = new St.Widget({style_class: `ai-meter-fill ${meterSeverity(value)}`,
        visible: value > 0});
      fill.set_style((vertical ? `height: ${18 * value / 100}px; width: 4px;` :
        `width: ${28 * value / 100}px; height: 4px;`) + ` background-color: ${meterColor(value)};`);
      if (vertical) track.add_child(new St.Widget({y_expand: true}));
      track.add_child(fill);
      meters.add_child(track);
    }
  }
  box.add_child(meters);
  if (result.status === 'stale') {
    box.add_child(new St.Label({text: '~', style_class: 'ai-stale',
      y_align: Clutter.ActorAlign.CENTER}));
  }
  return box;
}
