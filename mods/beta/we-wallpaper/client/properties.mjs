import { label } from './labels.mjs';
import { callHost } from './support.mjs';

// The host settings schema supplies Folia's own sliders, switches and colour picker.
const presetHash = value => {
    let hash = 2166136261;
    for (const character of value) hash = Math.imul(hash ^ character.codePointAt(0), 16777619);
    return (hash >>> 0).toString(16);
};

function field(key, definition, value) {
    const text = definition.text === 'ui_browse_properties_scheme_color'
        ? label('主题颜色', 'Scheme colour', 'Warna tema')
        : label(String(definition.text || key), String(definition.text || key));
    const common = { key, label: text, defaultValue: value, order: definition.order || 0 };
    switch (definition.type) {
        case 'bool': return { schema: { ...common, type: 'boolean', defaultValue: Boolean(value) }, encode: value => value };
        case 'slider': return { schema: { ...common, type: 'number', min: Number(definition.min ?? 0), max: Number(definition.max ?? 100), step: definition.precision ? 10 ** -definition.precision : 1, defaultValue: Number(value) }, encode: Number };
        case 'color': {
            const rgb = String(value).trim().split(/\s+/).map(Number);
            const hex = '#' + rgb.slice(0, 3).map(component => Math.round(Math.max(0, Math.min(1, component)) * 255).toString(16).padStart(2, '0')).join('');
            return {
                schema: { ...common, type: 'color', defaultValue: hex },
                encode: next => next === hex ? value : [1, 3, 5].map(index => (parseInt(next.slice(index, index + 2), 16) / 255).toFixed(5)).join(' '),
            };
        }
        case 'combo': {
            const options = (definition.options || []).map(option => ({ value: String(option.value), label: label(String(option.label || option.text || option.value), String(option.label || option.text || option.value)) }));
            if (!options.length) return null;
            return {
                schema: { ...common, type: 'select', defaultValue: String(value), options },
                encode: value => definition.options.find(option => String(option.value) === value).value,
            };
        }
        case 'textinput': case 'file': case 'directory':
            return { schema: { ...common, type: 'text', defaultValue: String(value ?? '') }, encode: String };
        default: return null;
    }
}

export function createPropertySettings(folium) {
    let section;
    let stop;
    let timer;
    let sequence = 0;
    let current = '';
    let pending = {};
    let write = null;

    const flush = () => {
        clearTimeout(timer);
        if (!write || !Object.keys(pending).length) return;
        const patch = pending;
        pending = {};
        write(patch).catch(error => folium.log.error(error.message));
    };
    const clear = () => {
        flush();
        stop?.();
        section?.unregister();
        section = null;
        stop = null;
    };

    return {
        async select(id, presetName = '') {
            const key = id + ':' + presetName;
            if (!id || key === current) return;
            current = key;
            const request = ++sequence;
            const description = await callHost('describe', id, presetName);
            if (request !== sequence) return;
            clear();
            const fields = Object.entries(description.definitions)
                .map(([key, definition]) => field(key, definition, description.baseProperties[key])).filter(Boolean)
                .sort((a, b) => a.schema.order - b.schema.order);
            if (!fields.length) return;
            section = folium.registries.settingsSections.register({
                id: 'properties-' + id + '-' + presetHash(presetName),
                label: label('WE 原属性 · ' + description.title, 'WE properties · ' + description.title, 'Properti WE · ' + description.title),
                settings: fields.map(item => item.schema),
            });
            write = patch => callHost('properties', id, presetName, patch);
            let previous = Object.fromEntries(fields.map(item => [item.schema.key, item.schema.defaultValue]));
            const changed = () => {
                const values = section.settings.get();
                for (const item of fields) {
                    const key = item.schema.key;
                    if (values[key] !== previous[key]) pending[key] = item.encode(values[key]);
                }
                previous = values;
                clearTimeout(timer);
                timer = setTimeout(flush, 180);
            };
            changed();
            stop = section.settings.onChange(changed);
        },
        dispose() { ++sequence; current = ''; clear(); write = null; },
    };
}
