// Registered components are bundled locally by the guest Vite build.
import '@material/web/button/filled-button.js';
import '@material/web/button/outlined-button.js';
import '@material/web/textfield/outlined-text-field.js';
import '@material/web/select/outlined-select.js';
import '@material/web/select/select-option.js';
import '@material/web/checkbox/checkbox.js';
import '@material/web/progress/linear-progress.js';

await Promise.all(['md-filled-button', 'md-outlined-button', 'md-outlined-text-field',
 'md-outlined-select', 'md-select-option', 'md-checkbox', 'md-linear-progress'].map(name => customElements.whenDefined(name)));
