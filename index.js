/**
 * Host half of the Font Studio bundle.
 *
 * Everything the feature does is browser-side: it reads and writes the Client
 * theme service (`fontSizes` / `fontFamilies` / token overrides) and adds a
 * Settings section. The Host only has to exist so the Loader owns the entry and
 * the Client artifact gets published to the Web shell.
 */
export function apply() {}
