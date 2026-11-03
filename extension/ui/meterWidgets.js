import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import {meterValue, meterSeverity, meterColor, unicodeSegments, compactTokens} from './meterModel.js';
import {pairedReadings, panelDescription} from './panelComponents.js';

export function providerMeters(result, style, path, whiteIcons, display) {
  const brand = result.id;
  const iconName = whiteIcons && ['claude', 'antigravity'].includes(brand)
    ? `${brand}-white` : brand;
  const box = new St.BoxLayout({style_class: 'ai-provider-meters',
    y_align: Clutter.ActorAlign.CENTER, accessible_name: panelDescription(result, display)});
  if (display.icon) box.add_child(new St.Icon({
    gicon: Gio.icon_new_for_string(`${path}/icons/${iconName}.svg`),
    icon_size: 14, style_class: `ai-brand ai-brand-${brand}`,
    y_align: Clutter.ActorAlign.CENTER,
  }));
  if (result.id === 'opencode' && display.activity) box.add_child(new St.Label({
    text: ['ok', 'stale'].includes(result.status) ? `${compactTokens(result.totalTokens ?? 0)} / 7d` : '-',
    y_align: Clutter.ActorAlign.CENTER}));
  for (const {name, orientation, variant} of display.meters) {
    if (variant) {
      box.add_child(pairedMeter(result, variant));
      continue;
    }
    const vertical = orientation === 'vertical';
    const value = meterValue(result, name);
    if (value === null) {
      box.add_child(new St.Label({text: '-', accessible_name: `${name}: unavailable`,
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

function pairedMeter(result, variant) {
  const readings = pairedReadings(result);
  if (variant === 'percent' || variant === 'reset') {
    const lines = readings.map(({label, percent, reset}) => {
      const value = variant === 'reset' ? reset : percent === null ? null : `${Math.round(percent)}%`;
      return `${label}  ${value ?? '-'}`;
    });
    return new St.Label({text: lines.join('\n'), style: 'font-size: 8px; font-weight: bold;',
      y_align: Clutter.ActorAlign.CENTER});
  }

  const width = {horizontal: 28, vertical: 13, rings: 20}[variant];
  const area = new St.DrawingArea({width, height: 20, y_align: Clutter.ActorAlign.CENTER});
  area.connect('repaint', actor => {
    const cr = actor.get_context();
    try {
      const [w, h] = actor.get_surface_size();
      cr.scale(w / width, h / 20);
      const fg = actor.get_theme_node().get_foreground_color();
      readings.forEach(({percent}, index) => {
        cr.setLineWidth(variant === 'rings' ? 2.4 : 3.5);
        const stroke = fraction => {
          if (variant === 'rings') {
            cr.arc(10, 10, 8 - index * 3.6, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * fraction);
          } else if (variant === 'vertical') {
            const x = 3 + 7 * index;
            cr.moveTo(x, 18);
            cr.lineTo(x, 18 - 16 * fraction);
          } else {
            const y = 6 + 8 * index;
            cr.moveTo(1, y);
            cr.lineTo(1 + 26 * fraction, y);
          }
          cr.stroke();
        };
        cr.setSourceRGBA(fg.red / 255, fg.green / 255, fg.blue / 255, percent === null ? 0.55 : 0.22);
        cr.setDash(percent === null ? [1, 2] : [], 0);
        stroke(1);
        if (percent > 0) {
          const color = parseInt(meterColor(percent).slice(1), 16);
          cr.setSourceRGB((color >> 16) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255);
          stroke(percent / 100);
        }
      });
    } finally {
      cr.$dispose();
    }
  });
  return area;
}
