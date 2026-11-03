import {orientationFor} from './meterModel.js';
import {providerMeters} from './meterWidgets.js';

export function componentPreview(result, choice, settings, path) {
  const orientation = orientationFor(choice.id, settings.get_strv('panel-orientations'),
    settings.get_string('meter-orientation'));
  const meters = [];
  if (choice.kind === 'pair') meters.push({variant: choice.variant});
  if (choice.kind === 'meter') meters.push({name: choice.name, orientation});
  return providerMeters(result, settings.get_string('meter-style'), path,
    settings.get_boolean('white-icons'), {
      icon: choice.kind === 'icon', activity: choice.kind === 'activity', meters,
    });
}
