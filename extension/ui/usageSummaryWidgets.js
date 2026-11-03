import St from 'gi://St';
import Clutter from 'gi://Clutter';
import {meterColor} from './meterModel.js';
import {providerSummary} from './usageSummary.js';

const CENTER = Clutter.ActorAlign.CENTER;
const FULL_TURN = 2 * Math.PI;
const START = -Math.PI / 2;

function label(text, styleClass, properties = {}) {
  return new St.Label({text, style_class: styleClass, ...properties});
}

function track(cr, area) {
  const {red, green, blue} = area.get_theme_node().get_foreground_color();
  cr.setSourceRGBA(red / 255, green / 255, blue / 255, 0.17);
}

function fill(cr, value) {
  const color = meterColor(value);
  const channels = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
  cr.setSourceRGBA(...channels, 1);
}

function ringGraphic(summary) {
  const graphic = new St.Widget({layout_manager: new Clutter.BinLayout(),
    style: 'width: 76px; height: 76px;', x_align: CENTER});
  if (summary.rings.length) {
    const area = new St.DrawingArea({x_expand: true, y_expand: true});
    area.connect('repaint', () => {
      const [width, height] = area.get_surface_size();
      const size = Math.min(width, height);
      const cr = area.get_context();
      try {
        // rings = [5h, weekly]: 5h is the thicker outer ring, weekly the thinner inner one.
        summary.rings.forEach((value, index) => {
          const outer = index === 0;
          const radius = size * (outer ? 0.465 : 0.375);
          cr.setLineWidth(size * (outer ? 0.064 : 0.041));
          track(cr, area);
          cr.arc(width / 2, height / 2, radius, START, START + FULL_TURN);
          cr.stroke();
          if (value > 0) {
            fill(cr, value);
            cr.arc(width / 2, height / 2, radius, START, START + FULL_TURN * value / 100);
            cr.stroke();
          }
        });
      } finally {
        cr.$dispose();
      }
    });
    graphic.add_child(area);
  }
  const center = new St.BoxLayout({vertical: true, x_align: CENTER, y_align: CENTER});
  center.add_child(label(summary.value, 'ai-summary-value', {x_align: CENTER}));
  center.add_child(label(summary.secondary, 'ai-summary-unit', {x_align: CENTER}));
  graphic.add_child(center);
  return graphic;
}

export function buildSummaryCard(result) {
  const summary = providerSummary(result);
  const card = new St.BoxLayout({vertical: true, style_class: 'ai-summary-card'});
  card.add_child(ringGraphic(summary));
  card.add_child(label(result.label, 'ai-summary-title', {x_align: CENTER}));
  return card;
}

function progress(percent) {
  const area = new St.DrawingArea({style: 'height: 4px;', x_expand: true});
  area.connect('repaint', () => {
    const [width, height] = area.get_surface_size();
    const cr = area.get_context();
    try {
      track(cr, area);
      cr.rectangle(0, 0, width, height);
      cr.fill();
      if (percent > 0) {
        fill(cr, percent);
        cr.rectangle(0, 0, width * percent / 100, height);
        cr.fill();
      }
    } finally {
      cr.$dispose();
    }
  });
  return area;
}

export function buildUsageDetails(result) {
  const summary = providerSummary(result);
  const details = new St.BoxLayout({vertical: true, style_class: 'ai-usage-details'});
  const heading = new St.BoxLayout();
  heading.add_child(label(summary.heading, 'ai-detail-heading', {x_expand: true}));
  const meta = [result.plan, summary.status].filter(Boolean).join(' · ');
  if (meta) heading.add_child(label(meta, 'ai-summary-caption'));
  details.add_child(heading);
  addRows(details, summary);
  if (summary.quota) {
    details.add_child(label(summary.quota.heading, 'ai-detail-heading'));
    addRows(details, summary.quota);
  }
  return details;
}

function addRows(details, section) {
  for (const row of section.rows) {
    const box = new St.BoxLayout({vertical: true, style_class: 'ai-detail-row'});
    const line = new St.BoxLayout({style: 'spacing: 8px;'});
    line.add_child(label(row.label, 'ai-detail-name', {x_expand: true}));
    line.add_child(label(row.value, 'ai-detail-value'));
    box.add_child(line);
    if (row.percent !== undefined) box.add_child(progress(row.percent));
    box.add_child(label(row.reset, 'ai-summary-caption'));
    details.add_child(box);
  }
  if (!section.rows.length) details.add_child(label(section.empty, 'ai-summary-caption'));
}
